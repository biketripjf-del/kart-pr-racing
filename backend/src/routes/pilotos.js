import { Router } from 'express';
import Joi from 'joi';
import rateLimit from 'express-rate-limit';
import { q } from '../db.js';
import { exigirAdmin } from '../auth.js';
import { ah } from '../async.js';

const router = Router();

const limiteCadastro = rateLimit({
  windowMs: 60 * 60 * 1000, // 1h
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'muitas_tentativas' },
});

const schemaCadastro = Joi.object({
  nome: Joi.string().trim().min(2).max(120).required(),
  apelido: Joi.string().trim().max(60).allow('', null),
  whatsapp: Joi.string().trim().max(30).allow('', null),
  data_nascimento: Joi.string().isoDate().allow('', null),
  peso_kg: Joi.number().min(30).max(250).allow(null),
  experiencia: Joi.string().valid('nunca', 'casual', 'frequente').allow('', null),
  empresa: Joi.string().trim().max(120).allow('', null),
  indicado_por: Joi.string().trim().max(120).allow('', null),
  respostas: Joi.object().unknown(true).default({}),
  consentimento: Joi.boolean().valid(true).required(),
  // opcional: já inscreve o piloto na etapa informada
  etapa_id: Joi.number().integer().allow(null),
});

// Cadastro público de piloto
router.post('/', limiteCadastro, ah(async (req, res) => {
  const { error, value } = schemaCadastro.validate(req.body || {}, { stripUnknown: true });
  if (error) return res.status(400).json({ erro: 'dados_invalidos', detalhe: error.message });

  const { rows } = await q(
    `INSERT INTO pilotos
       (nome, apelido, whatsapp, data_nascimento, peso_kg, experiencia, empresa, indicado_por, respostas, consentimento, consentimento_em)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,now())
     RETURNING id, nome, apelido`,
    [value.nome, value.apelido || null, value.whatsapp || null, value.data_nascimento || null,
     value.peso_kg ?? null, value.experiencia || null, value.empresa || null,
     value.indicado_por || null, value.respostas || {}]
  );
  const piloto = rows[0];

  // inscreve na etapa (se veio) — pagamento fica pendente por padrão
  if (value.etapa_id) {
    await q(
      `INSERT INTO inscricoes (etapa_id, piloto_id, valor_centavos)
       SELECT $1::int, $2::int, valor_centavos FROM etapas WHERE id = $1::int
       ON CONFLICT (etapa_id, piloto_id) DO NOTHING`,
      [value.etapa_id, piloto.id]
    );
  }
  res.status(201).json({ ok: true, piloto });
}));

// pública: a foto do piloto (data URL gravado pela ficha → imagem)
router.get('/:id/foto', ah(async (req, res) => {
  const { rows } = await q('SELECT foto FROM pilotos WHERE id = $1 AND ativo', [req.params.id]);
  const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(rows[0]?.foto || '');
  if (!m) return res.status(404).json({ erro: 'sem_foto' });
  res.set('Content-Type', m[1]);
  res.set('Cache-Control', 'public, max-age=86400'); // a URL leva ?v=<foto_em>: foto nova = URL nova
  res.send(Buffer.from(m[2], 'base64'));
}));

// ---- admin ----
// lista SEM a foto (é o campo pesado); a ficha inteira vem junto pra organização conferir
router.get('/', exigirAdmin, ah(async (req, res) => {
  const { rows } = await q(
    `SELECT p.id, p.nome, p.apelido, p.whatsapp, p.data_nascimento, p.peso_kg, p.altura_cm, p.cidade, p.instagram,
       p.emergencia_nome, p.emergencia_tel, p.tipo_sanguineo, p.camiseta, p.experiencia, p.empresa, p.indicado_por,
       p.consentimento, p.ativo, p.criado_em, p.ficha_em, p.foto_em, (p.foto IS NOT NULL) AS tem_foto,
       COALESCE(r.n, 0) AS etapas_correu
     FROM pilotos p LEFT JOIN (SELECT piloto_id, COUNT(*) AS n FROM resultados GROUP BY piloto_id) r ON r.piloto_id = p.id
     WHERE p.ativo ORDER BY p.nome`
  );
  res.json(rows);
}));

router.patch('/:id', exigirAdmin, ah(async (req, res) => {
  const campos = ['nome', 'apelido', 'whatsapp', 'data_nascimento', 'peso_kg', 'altura_cm', 'cidade', 'instagram', 'emergencia_nome',
    'emergencia_tel', 'tipo_sanguineo', 'camiseta', 'experiencia', 'empresa', 'indicado_por', 'ativo'];
  const sets = [];
  const vals = [];
  for (const c of campos) {
    if (c in (req.body || {})) { vals.push(req.body[c]); sets.push(`${c} = $${vals.length}`); }
  }
  if (!sets.length) return res.status(400).json({ erro: 'nada_pra_atualizar' });
  vals.push(req.params.id);
  const { rows } = await q(`UPDATE pilotos SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
  if (!rows[0]) return res.status(404).json({ erro: 'nao_encontrado' });
  res.json(rows[0]);
}));

export default router;
