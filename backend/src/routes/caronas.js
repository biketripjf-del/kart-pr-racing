// Caronas JF → Volta Redonda (Brunner 14/10 21:43 BRT: "faz a tela de caronas"; msg do Emmanuel no grupo:
// "serão sugeridos grupos para o deslocamento"). Quem tem carro oferece vagas; quem precisa entra num carro.
// Identidade = link pessoal do piloto (X-Piloto). Sem ele, só se vê. A organização (login) mexe em tudo.
import { Router } from 'express';
import Joi from 'joi';
import { q } from '../db.js';
import { ah } from '../async.js';
import { ehAdmin } from '../auth.js';
import { EVENTO_ATUAL, pilotoDoToken, pilotosDoEvento } from './ficha.js';

const router = Router();

const oferta = Joi.object({
  vagas: Joi.number().integer().min(1).max(6).required(),
  saida_local: Joi.string().trim().max(80).allow('', null),
  saida_hora: Joi.string().trim().max(20).allow('', null),
  obs: Joi.string().trim().max(200).allow('', null),
  motorista_id: Joi.number().integer().allow(null), // só a organização escolhe o motorista
});

async function quadro() {
  const ev = EVENTO_ATUAL();
  const pilotos = (await pilotosDoEvento()).filter((p) => p.piloto_id != null);
  const nomeDe = new Map(pilotos.map((p) => [p.piloto_id, p.nome]));
  const ids = pilotos.map((p) => p.piloto_id);
  const fotos = new Map();
  if (ids.length) {
    const { rows } = await q(`SELECT id, foto_em FROM pilotos WHERE foto IS NOT NULL AND id IN (${ids.map((_, i) => `$${i + 1}`).join(',')})`, ids);
    for (const r of rows) fotos.set(r.id, r.foto_em ? new Date(r.foto_em).getTime() : null);
  }
  const cartao = (id) => ({ id, nome: nomeDe.get(id) || '?', foto_v: fotos.get(id) ?? null });
  const { rows: cs } = await q('SELECT * FROM caronas WHERE evento = $1 ORDER BY id', [ev]);
  const { rows: ps } = cs.length
    ? await q(`SELECT carona_id, piloto_id FROM carona_passageiros WHERE carona_id IN (${cs.map((_, i) => `$${i + 1}`).join(',')}) ORDER BY criado_em`, cs.map((c) => c.id))
    : { rows: [] };
  const caronas = cs.map((c) => ({
    id: c.id, motorista: cartao(c.motorista_id), vagas: c.vagas, saida_local: c.saida_local, saida_hora: c.saida_hora, obs: c.obs,
    passageiros: ps.filter((p) => p.carona_id === c.id).map((p) => cartao(p.piloto_id)),
  }));
  const ocupados = new Set([...cs.map((c) => c.motorista_id), ...ps.map((p) => p.piloto_id)]);
  return { evento: ev, caronas, sem_carona: pilotos.filter((p) => !ocupados.has(p.piloto_id)).map((p) => cartao(p.piloto_id)) };
}

// em que carro esse piloto já está (motorista ou passageiro) neste evento
async function ondeEsta(pilotoId) {
  const { rows } = await q(
    `SELECT c.id FROM caronas c LEFT JOIN carona_passageiros p ON p.carona_id = c.id
     WHERE c.evento = $1 AND (c.motorista_id = $2 OR p.piloto_id = $2) LIMIT 1`, [EVENTO_ATUAL(), pilotoId]
  );
  return rows[0]?.id || null;
}

router.get('/', ah(async (req, res) => {
  const eu = await pilotoDoToken(req);
  res.set('Cache-Control', 'no-store');
  res.json({ ...(await quadro()), eu: eu ? { id: eu.id } : null, admin: ehAdmin(req) });
}));

// oferecer carona (o motorista é quem abriu o link; a organização pode cadastrar por alguém)
router.post('/', ah(async (req, res) => {
  const { error, value: v } = oferta.validate(req.body || {}, { stripUnknown: true });
  if (error) return res.status(400).json({ erro: 'dados_invalidos', detalhe: error.message });
  const admin = ehAdmin(req);
  const eu = await pilotoDoToken(req);
  const motorista = admin && v.motorista_id ? v.motorista_id : eu?.id;
  if (!motorista) return res.status(401).json({ erro: 'abra_seu_link' });
  if (await ondeEsta(motorista)) return res.status(409).json({ erro: 'ja_esta_em_um_carro' });
  const { rows } = await q(
    'INSERT INTO caronas (evento, motorista_id, vagas, saida_local, saida_hora, obs) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [EVENTO_ATUAL(), motorista, v.vagas, v.saida_local || null, v.saida_hora || null, v.obs || null]
  );
  res.status(201).json({ ok: true, id: rows[0].id });
}));

async function carona(id) {
  const { rows } = await q('SELECT * FROM caronas WHERE id = $1 AND evento = $2', [Number(id), EVENTO_ATUAL()]);
  return rows[0] || null;
}
const lotacao = async (id) => Number((await q('SELECT count(*)::int AS n FROM carona_passageiros WHERE carona_id = $1', [id])).rows[0].n);

// motorista (ou organização) ajusta vagas/saída
router.patch('/:id', ah(async (req, res) => {
  const c = await carona(req.params.id);
  if (!c) return res.status(404).json({ erro: 'nao_encontrado' });
  const eu = await pilotoDoToken(req);
  if (!ehAdmin(req) && eu?.id !== c.motorista_id) return res.status(403).json({ erro: 'so_o_motorista' });
  const { error, value: v } = oferta.validate({ vagas: c.vagas, ...req.body }, { stripUnknown: true });
  if (error) return res.status(400).json({ erro: 'dados_invalidos', detalhe: error.message });
  if (v.vagas < await lotacao(c.id)) return res.status(409).json({ erro: 'vagas_menor_que_passageiros' });
  await q('UPDATE caronas SET vagas=$2, saida_local=$3, saida_hora=$4, obs=$5 WHERE id=$1',
    [c.id, v.vagas, v.saida_local ?? c.saida_local, v.saida_hora ?? c.saida_hora, v.obs ?? c.obs]);
  res.json({ ok: true });
}));

// motorista (ou organização) desfaz o carro — os passageiros voltam pra "sem carona"
router.delete('/:id', ah(async (req, res) => {
  const c = await carona(req.params.id);
  if (!c) return res.status(404).json({ erro: 'nao_encontrado' });
  const eu = await pilotoDoToken(req);
  if (!ehAdmin(req) && eu?.id !== c.motorista_id) return res.status(403).json({ erro: 'so_o_motorista' });
  await q('DELETE FROM carona_passageiros WHERE carona_id = $1', [c.id]);
  await q('DELETE FROM caronas WHERE id = $1', [c.id]);
  res.json({ ok: true });
}));

// entrar num carro (o próprio piloto; a organização pode colocar alguém com piloto_id)
router.post('/:id/entrar', ah(async (req, res) => {
  const c = await carona(req.params.id);
  if (!c) return res.status(404).json({ erro: 'nao_encontrado' });
  const admin = ehAdmin(req);
  const eu = await pilotoDoToken(req);
  const quem = admin && req.body?.piloto_id ? Number(req.body.piloto_id) : eu?.id;
  if (!quem) return res.status(401).json({ erro: 'abra_seu_link' });
  if (await ondeEsta(quem)) return res.status(409).json({ erro: 'ja_esta_em_um_carro' });
  if (await lotacao(c.id) >= c.vagas) return res.status(409).json({ erro: 'carro_cheio' });
  await q('INSERT INTO carona_passageiros (carona_id, piloto_id) VALUES ($1, $2)', [c.id, quem]);
  res.json({ ok: true });
}));

// sair do carro (o próprio passageiro, o motorista tirando alguém, ou a organização)
router.post('/:id/sair', ah(async (req, res) => {
  const c = await carona(req.params.id);
  if (!c) return res.status(404).json({ erro: 'nao_encontrado' });
  const eu = await pilotoDoToken(req);
  const quem = req.body?.piloto_id ? Number(req.body.piloto_id) : eu?.id;
  if (!quem) return res.status(401).json({ erro: 'abra_seu_link' });
  const pode = ehAdmin(req) || eu?.id === quem || eu?.id === c.motorista_id;
  if (!pode) return res.status(403).json({ erro: 'sem_permissao' });
  const { rowCount } = await q('DELETE FROM carona_passageiros WHERE carona_id = $1 AND piloto_id = $2', [c.id, quem]);
  res.json({ ok: rowCount === 1 });
}));

export default router;
