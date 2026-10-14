// Fotos e vídeos do dia, enviados pelos próprios pilotos (/midia). Pedido do Brunner 14/10/2026: juntar o material
// de todo mundo pro marketing. O arquivo ORIGINAL vai inteiro pro disco (MIDIA_DIR = volume /data na Railway),
// sem compressão: é matéria-prima do videomaker. O envio é o corpo cru da requisição (sem multipart), em streaming.
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { q } from '../db.js';
import { ah } from '../async.js';
import { exigirAdmin } from '../auth.js';
import { EVENTO_ATUAL } from './ficha.js';

const router = Router();
export const MIDIA_DIR = () => process.env.MIDIA_DIR || path.resolve('midia-local');
export const MAX_BYTES = 500 * 1024 * 1024; // 500 MB por arquivo (vídeo 4K de 1-2 min)
const TIPOS = /^(image\/(jpeg|png|heic|heif|webp)|video\/(mp4|quicktime|webm|3gpp|x-m4v))$/;
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/heif': 'heif', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/3gpp': '3gp', 'video/x-m4v': 'm4v' };
const limite = rateLimit({ windowMs: 60 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false, message: { erro: 'muitos_envios' } });
const texto = (v, n) => String(v || '').trim().slice(0, n);

const publico = (m) => ({
  id: m.id, autor: m.autor, piloto_id: m.piloto_id, tipo: m.tipo, mime: m.mime, bytes: Number(m.bytes), legenda: m.legenda,
  tem_thumb: !!m.tem_thumb, criado_em: m.criado_em, evento: m.evento,
});

router.get('/', ah(async (req, res) => {
  const { rows } = await q(`SELECT id, autor, piloto_id, tipo, mime, bytes, legenda, evento, criado_em, (thumb IS NOT NULL) AS tem_thumb
    FROM midias WHERE NOT oculto ORDER BY id DESC LIMIT 500`);
  res.set('Cache-Control', 'no-store');
  res.json(rows.map(publico));
}));

// envio: PUT /api/midia?autor=...&piloto_id=...&legenda=...&nome=... · corpo = o arquivo · Content-Type = tipo do arquivo
router.put('/', limite, ah(async (req, res) => {
  const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (!TIPOS.test(mime)) return res.status(415).json({ erro: 'tipo_nao_aceito', detalhe: 'Só foto (jpg, png, heic) ou vídeo (mp4, mov).' });
  const tamanho = Number(req.headers['content-length'] || 0);
  if (tamanho > MAX_BYTES) return res.status(413).json({ erro: 'grande_demais', detalhe: 'Máximo 500 MB por arquivo.' });
  const autor = texto(req.query.autor, 80);
  if (autor.length < 2) return res.status(400).json({ erro: 'falta_autor' });
  const pilotoId = Number(req.query.piloto_id) || null;
  fs.mkdirSync(MIDIA_DIR(), { recursive: true });
  const arquivo = `${Date.now()}-${crypto.randomBytes(5).toString('hex')}.${EXT[mime]}`;
  const destino = path.join(MIDIA_DIR(), arquivo);
  let bytes = 0;
  let estourou = false;
  await new Promise((ok, falha) => {
    const out = fs.createWriteStream(destino);
    req.on('data', (c) => { bytes += c.length; if (bytes > MAX_BYTES && !estourou) { estourou = true; req.unpipe(out); out.destroy(); ok(); } });
    req.on('aborted', () => { out.destroy(); falha(new Error('envio_interrompido')); });
    out.on('error', falha);
    out.on('finish', ok);
    req.pipe(out);
  }).catch((e) => { fs.rmSync(destino, { force: true }); throw e; });
  if (estourou || bytes === 0) {
    fs.rmSync(destino, { force: true });
    return res.status(estourou ? 413 : 400).json({ erro: estourou ? 'grande_demais' : 'arquivo_vazio' });
  }
  const { rows } = await q(
    `INSERT INTO midias (evento, piloto_id, autor, tipo, mime, nome_orig, arquivo, bytes, legenda)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [EVENTO_ATUAL(), pilotoId, autor, mime.startsWith('video') ? 'video' : 'foto', mime, texto(req.query.nome, 200) || null, arquivo, bytes, texto(req.query.legenda, 300) || null]
  );
  res.status(201).json({ ok: true, id: rows[0].id, bytes });
}));

// miniatura feita no celular (jpeg pequeno em data URL), mandada logo depois do arquivo
router.post('/:id/thumb', limite, ah(async (req, res) => {
  const t = String(req.body?.thumb || '');
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(t) || t.length > 150_000) return res.status(400).json({ erro: 'thumb_invalida' });
  const { rowCount } = await q('UPDATE midias SET thumb = $2 WHERE id = $1 AND thumb IS NULL', [Number(req.params.id), t]);
  res.json({ ok: rowCount === 1 });
}));

router.get('/:id/thumb', ah(async (req, res) => {
  const { rows } = await q('SELECT thumb FROM midias WHERE id = $1 AND NOT oculto', [Number(req.params.id)]);
  const t = rows[0]?.thumb;
  if (!t) return res.status(404).end();
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.type('image/jpeg').send(Buffer.from(t.split(',')[1], 'base64'));
}));

// o arquivo original (sendFile responde Range: o vídeo toca e avança no celular)
router.get('/:id/arquivo', ah(async (req, res) => {
  const { rows } = await q('SELECT arquivo, mime, nome_orig FROM midias WHERE id = $1 AND NOT oculto', [Number(req.params.id)]);
  const m = rows[0];
  if (!m) return res.status(404).json({ erro: 'nao_encontrado' });
  const caminho = path.join(MIDIA_DIR(), m.arquivo);
  if (!fs.existsSync(caminho)) return res.status(410).json({ erro: 'arquivo_sumiu' });
  if (req.query.baixar) res.attachment(m.nome_orig || m.arquivo);
  res.set('Cache-Control', 'public, max-age=86400');
  res.type(m.mime).sendFile(caminho);
}));

// organização: esconder (não apaga o arquivo — o marketing ainda pode querer)
router.patch('/:id', exigirAdmin, ah(async (req, res) => {
  const { rowCount } = await q('UPDATE midias SET oculto = $2 WHERE id = $1', [Number(req.params.id), !!req.body?.oculto]);
  res.json({ ok: rowCount === 1 });
}));

// organização: lista completa com o nome do arquivo no disco (pra eu juntar o material do marketing)
router.get('/admin/tudo', exigirAdmin, ah(async (req, res) => {
  const { rows } = await q('SELECT id, autor, tipo, mime, nome_orig, arquivo, bytes, legenda, oculto, criado_em FROM midias ORDER BY id');
  res.json({ total_bytes: rows.reduce((s, r) => s + Number(r.bytes), 0), midias: rows });
}));

export default router;
