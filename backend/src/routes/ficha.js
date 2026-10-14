// Ficha do piloto, preenchida por ELE no próprio app (/ficha). Pedido do Brunner 14/10/2026: "um formulario do
// proprio app para cada um preencher dados como nome, telefone, peso, altura, data de nascimento e outros dados
// (...) como foto de perfil".
// Acesso: o piloto escolhe o próprio nome na lista do evento. 1ª vez preenche livre; daí em diante, editar
// exige o WhatsApp que ele cadastrou (sem isso, qualquer um trocaria a foto do outro).
// Dados pessoais (telefone, nascimento, peso, altura, emergência, sangue) só saem pro admin.
import { Router } from 'express';
import Joi from 'joi';
import rateLimit from 'express-rate-limit';
import { q } from '../db.js';
import { ah } from '../async.js';
import { normalizar } from '../aoVivo.js';

const router = Router();
export const EVENTO_ATUAL = () => process.env.EVENTO_ATUAL || 'copa-3';
const FOTO_MAX = 400_000; // caracteres do data URL (~290 KB de jpeg) — o celular reduz pra 512 px antes
const soDigitos = (s) => String(s || '').replace(/\D/g, '');
const mesmoTelefone = (a, b) => soDigitos(a).slice(-8).length === 8 && soDigitos(a).slice(-8) === soDigitos(b).slice(-8);

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
  confirmacao: opc(Joi.string().max(30)), // WhatsApp já cadastrado (só pra editar)
});

async function pilotosDoEvento() {
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

// pública: o que a tela precisa pra abrir a ficha de alguém (sem dado pessoal)
router.get('/:id', ah(async (req, res) => {
  const { rows } = await q(
    `SELECT id, nome, apelido, (ficha_em IS NOT NULL) AS tem_ficha, (foto IS NOT NULL) AS tem_foto, foto_em FROM pilotos WHERE id = $1 AND ativo`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ erro: 'nao_encontrado' });
  res.json({ ...rows[0], foto_v: rows[0].foto_em ? new Date(rows[0].foto_em).getTime() : null });
}));

// pública: abre a ficha já preenchida pra editar — só com o WhatsApp dela
router.post('/:id/abrir', limite, ah(async (req, res) => {
  const { rows } = await q(
    `SELECT id, nome, apelido, whatsapp, data_nascimento, peso_kg, altura_cm, cidade, instagram, emergencia_nome, emergencia_tel,
            tipo_sanguineo, camiseta, experiencia, empresa, ficha_em FROM pilotos WHERE id = $1 AND ativo`, [req.params.id]
  );
  const p = rows[0];
  if (!p) return res.status(404).json({ erro: 'nao_encontrado' });
  if (!p.ficha_em || !mesmoTelefone(req.body?.confirmacao, p.whatsapp)) return res.status(403).json({ erro: 'confirme_o_whatsapp' });
  const { ficha_em, ...ficha } = p;
  res.json({ ...ficha, data_nascimento: p.data_nascimento ? new Date(p.data_nascimento).toISOString().slice(0, 10) : '' });
}));

// pública: preencher/editar a ficha
router.post('/:id', limite, ah(async (req, res) => {
  const { error, value: v } = schema.validate(req.body || {}, { stripUnknown: true });
  if (error) return res.status(400).json({ erro: 'dados_invalidos', detalhe: error.message });
  const { rows } = await q('SELECT id, whatsapp, ficha_em FROM pilotos WHERE id = $1 AND ativo', [req.params.id]);
  const atual = rows[0];
  if (!atual) return res.status(404).json({ erro: 'nao_encontrado' });
  if (atual.ficha_em && atual.whatsapp && !mesmoTelefone(v.confirmacao, atual.whatsapp)) {
    return res.status(403).json({ erro: 'confirme_o_whatsapp', detalhe: 'Essa ficha já foi preenchida. Digite o WhatsApp cadastrado nela para editar.' });
  }
  const vals = [
    v.nome, v.apelido || null, v.whatsapp, v.data_nascimento || null, v.peso_kg ?? null, v.altura_cm ?? null,
    v.cidade || null, v.instagram ? v.instagram.replace(/^@/, '') : null, v.emergencia_nome || null, v.emergencia_tel || null,
    v.tipo_sanguineo || null, v.camiseta || null, v.experiencia || null, v.empresa || null, req.params.id,
  ];
  await q(
    `UPDATE pilotos SET nome=$1, apelido=$2, whatsapp=$3, data_nascimento=$4, peso_kg=$5, altura_cm=$6, cidade=$7,
       instagram=$8, emergencia_nome=$9, emergencia_tel=$10, tipo_sanguineo=$11, camiseta=$12, experiencia=$13, empresa=$14,
       consentimento=true, consentimento_em=COALESCE(consentimento_em, now()), ficha_em=now()
     WHERE id=$15`, vals
  );
  // foto: só troca se veio uma nova ('' apaga)
  if (v.foto !== undefined && v.foto !== null) {
    await q('UPDATE pilotos SET foto=$1, foto_em=CASE WHEN $1::text IS NULL THEN NULL ELSE now() END WHERE id=$2', [v.foto || null, req.params.id]);
  }
  res.json({ ok: true });
}));

export default router;
