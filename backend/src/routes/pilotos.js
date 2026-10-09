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

// ---- admin ----
router.get('/', exigirAdmin, ah(async (req, res) => {
  const { rows } = await q(
    `SELECT p.*,
       (SELECT COUNT(*) FROM resultados r WHERE r.piloto_id = p.id) AS etapas_correu
     FROM pilotos p WHERE p.ativo ORDER BY p.nome`
  );
  res.json(rows);
}));

router.patch('/:id', exigirAdmin, ah(async (req, res) => {
  const campos = ['nome', 'apelido', 'whatsapp', 'data_nascimento', 'peso_kg', 'experiencia', 'empresa', 'indicado_por', 'ativo'];
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
