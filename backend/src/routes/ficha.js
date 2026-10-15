// Ficha do piloto, preenchida por ELE no próprio app (/ficha). Pedido do Brunner 14/10/2026: "um formulario do
// proprio app para cada um preencher dados como nome, telefone, peso, altura, data de nascimento e outros dados
// (...) como foto de perfil".
// Acesso (14/10 21:43, "a ficha do piloto nao pode ser publica"): só pelo LINK PESSOAL do piloto (token secreto,
// cabeçalho X-Piloto). A organização distribui os links pelo painel; nada de escolher nome numa lista aberta.
// Dados pessoais (telefone, nascimento, peso, altura, emergência, sangue) só saem pro admin.
import { Router } from 'express';
import Joi from 'joi';
import rateLimit from 'express-rate-limit';
import { q } from '../db.js';
import { ah } from '../async.js';
import crypto from 'crypto';
import { normalizar } from '../aoVivo.js';
import { exigirAdmin } from '../auth.js';

const router = Router();
export const EVENTO_ATUAL = () => process.env.EVENTO_ATUAL || 'copa-3';
const FOTO_MAX = 400_000; // caracteres do data URL (~290 KB de jpeg) — o celular reduz pra 512 px antes

const limite = rateLimit({ windowMs: 15 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false, message: { erro: 'muitas_tentativas' } });

const opc = (j) => j.allow('', null);
const schema = Joi.object({
  nome: Joi.string().trim().min(3).max(120).required(),
  apelido: opc(Joi.string().trim().max(40)),
  whatsapp: Joi.string().trim().min(10).max(30).required(),
  data_nascimento: opc(Joi.string().isoDate()),
  peso_kg: Joi.number().min(30).max(250).allow(null),
  altura_cm: Joi.number().integer().min(120).max(230).allow(null),
  cidade: opc(Joi.string().trim().max(80)),
  instagram: opc(Joi.string().trim().max(60)),
  emergencia_nome: opc(Joi.string().trim().max(80)),
  emergencia_tel: opc(Joi.string().trim().max(30)),
  tipo_sanguineo: opc(Joi.string().valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'não sei')),
  camiseta: opc(Joi.string().valid('PP', 'P', 'M', 'G', 'GG', 'XG')),
  experiencia: opc(Joi.string().valid('nunca', 'casual', 'frequente')),
  empresa: opc(Joi.string().trim().max(120)),
  foto: opc(Joi.string().max(FOTO_MAX).pattern(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)),
  consentimento: Joi.boolean().valid(true).required(),
});

export async function pilotosDoEvento() {
  const { rows } = await q('SELECT estado FROM ao_vivo WHERE slug = $1', [EVENTO_ATUAL()]);
  return rows[0]?.estado?.pilotos || [];
}

// pública: quem pode preencher (os pilotos do evento atual) + se já preencheu
router.get('/lista', ah(async (req, res) => {
  const doEvento = (await pilotosDoEvento()).filter((p) => p.piloto_id != null);
  const ids = doEvento.map((p) => p.piloto_id);
  const { rows } = ids.length
    ? await q(`SELECT id, apelido, (ficha_em IS NOT NULL) AS tem_ficha, (foto IS NOT NULL) AS tem_foto, foto_em
               FROM pilotos WHERE id IN (${ids.map((_, i) => `$${i + 1}`).join(',')})`, ids)
    : { rows: [] };
  const porId = new Map(rows.map((r) => [r.id, r]));
  const lista = doEvento.map((p) => ({
    id: p.piloto_id, nome: p.nome, apelido: porId.get(p.piloto_id)?.apelido || null,
    tem_ficha: !!porId.get(p.piloto_id)?.tem_ficha, tem_foto: !!porId.get(p.piloto_id)?.tem_foto,
    foto_v: porId.get(p.piloto_id)?.foto_em ? new Date(porId.get(p.piloto_id).foto_em).getTime() : null,
  })).sort((a, b) => normalizar(a.nome).localeCompare(normalizar(b.nome)));
  res.json({ evento: EVENTO_ATUAL(), pilotos: lista });
}));

// ---------- link pessoal ----------
// O piloto é reconhecido pelo token do link dele (cabeçalho X-Piloto). Sem token não há leitura nem escrita de ficha.
export async function pilotoDoToken(req) {
  const t = String(req.headers['x-piloto'] || '').trim();
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(t)) return null;
  const { rows } = await q('SELECT id, nome FROM pilotos WHERE ficha_token = $1 AND ativo', [t]);
  return rows[0] || null;
}
const novoToken = () => crypto.randomBytes(15).toString('base64url'); // 20 caracteres, 120 bits

// quem sou eu (o app usa pra saber se o link do celular ainda vale)
router.get('/eu', limite, ah(async (req, res) => {
  const eu = await pilotoDoToken(req);
  if (!eu) return res.status(401).json({ erro: 'link_invalido' });
  const { rows } = await q(
    `SELECT id, nome, apelido, whatsapp, data_nascimento, peso_kg, altura_cm, cidade, instagram, emergencia_nome, emergencia_tel,
            tipo_sanguineo, camiseta, experiencia, empresa, (ficha_em IS NOT NULL) AS tem_ficha, (foto IS NOT NULL) AS tem_foto, foto_em
     FROM pilotos WHERE id = $1`, [eu.id]
  );
  const p = rows[0];
  // nome de exibição = como ele está no evento atual
  const doEvento = (await pilotosDoEvento()).find((x) => x.piloto_id === p.id);
  res.set('Cache-Control', 'no-store');
  res.json({
    ...p, nome_evento: doEvento?.nome || p.nome,
    data_nascimento: p.data_nascimento ? new Date(p.data_nascimento).toISOString().slice(0, 10) : '',
    foto_v: p.foto_em ? new Date(p.foto_em).getTime() : null,
  });
}));

// preencher/editar a PRÓPRIA ficha
router.post('/eu', limite, ah(async (req, res) => {
  const eu = await pilotoDoToken(req);
  if (!eu) return res.status(401).json({ erro: 'link_invalido' });
  const { error, value: v } = schema.validate(req.body || {}, { stripUnknown: true });
  if (error) return res.status(400).json({ erro: 'dados_invalidos', detalhe: error.message });
  const vals = [
    v.nome, v.apelido || null, v.whatsapp, v.data_nascimento || null, v.peso_kg ?? null, v.altura_cm ?? null,
    v.cidade || null, v.instagram ? v.instagram.replace(/^@/, '') : null, v.emergencia_nome || null, v.emergencia_tel || null,
    v.tipo_sanguineo || null, v.camiseta || null, v.experiencia || null, v.empresa || null, eu.id,
  ];
  await q(
    `UPDATE pilotos SET nome=$1, apelido=$2, whatsapp=$3, data_nascimento=$4, peso_kg=$5, altura_cm=$6, cidade=$7,
       instagram=$8, emergencia_nome=$9, emergencia_tel=$10, tipo_sanguineo=$11, camiseta=$12, experiencia=$13, empresa=$14,
       consentimento=true, consentimento_em=COALESCE(consentimento_em, now()), ficha_em=now()
     WHERE id=$15`, vals
  );
  // foto: só troca se veio uma nova ('' apaga)
  if (v.foto !== undefined && v.foto !== null) {
    await q('UPDATE pilotos SET foto=$1, foto_em=CASE WHEN $1::text IS NULL THEN NULL ELSE now() END WHERE id=$2', [v.foto || null, eu.id]);
  }
  res.json({ ok: true, id: eu.id });
}));

// admin: o link pessoal de cada piloto do evento (cria o que falta)
router.get('/admin/links', exigirAdmin, ah(async (req, res) => {
  const doEvento = (await pilotosDoEvento()).filter((p) => p.piloto_id != null);
  const out = [];
  for (const p of doEvento) {
    let { rows } = await q('SELECT id, whatsapp, ficha_token, (ficha_em IS NOT NULL) AS tem_ficha FROM pilotos WHERE id = $1', [p.piloto_id]);
    let r = rows[0];
    if (!r) continue;
    if (!r.ficha_token) {
      const t = novoToken();
      await q('UPDATE pilotos SET ficha_token = $2 WHERE id = $1 AND ficha_token IS NULL', [r.id, t]);
      ({ rows } = await q('SELECT id, whatsapp, ficha_token, (ficha_em IS NOT NULL) AS tem_ficha FROM pilotos WHERE id = $1', [r.id]));
      r = rows[0];
    }
    out.push({ id: r.id, nome: p.nome, whatsapp: r.whatsapp || null, tem_ficha: r.tem_ficha, token: r.ficha_token });
  }
  out.sort((a, b) => normalizar(a.nome).localeCompare(normalizar(b.nome)));
  res.set('Cache-Control', 'no-store');
  res.json({ evento: EVENTO_ATUAL(), pilotos: out });
}));

// admin: troca o link (o antigo para de funcionar na hora)
router.post('/admin/:id/novo-link', exigirAdmin, ah(async (req, res) => {
  const t = novoToken();
  const { rowCount } = await q('UPDATE pilotos SET ficha_token = $2 WHERE id = $1', [Number(req.params.id), t]);
  if (!rowCount) return res.status(404).json({ erro: 'nao_encontrado' });
  res.json({ ok: true, token: t });
}));

export default router;
