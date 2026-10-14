// Sorteio dos grupos AO VIVO. Leitura pública (a tela /sorteio pergunta de 2 em 2 s); agendar/cancelar = admin.
// O servidor é o operador: `avancar()` roda a cada 2 s (e a cada leitura) — começa na hora marcada, e depois do
// último nome grava os grupos no evento sozinho. Ninguém precisa estar com a tela aberta.
import { Router } from 'express';
import crypto from 'crypto';
import { q } from '../db.js';
import { exigirAdmin } from '../auth.js';
import { ah } from '../async.js';
import { montarOrdem, fotografia, decidir, aplicarGrupos, PASSO_MS } from '../sorteio.js';

const router = Router();
const ms = (t) => (t ? new Date(t).getTime() : null);
const comoFoto = (r) => r && {
  ...r, agendadoMs: ms(r.agendado_para), iniciadoMs: ms(r.iniciado_em),
  agendado_para: r.agendado_para ? new Date(r.agendado_para).toISOString() : null,
};

async function ultimo(evento) {
  const { rows } = await q(
    `SELECT * FROM sorteios WHERE evento = $1 AND status <> 'cancelado' ORDER BY id DESC LIMIT 1`, [evento]
  );
  return comoFoto(rows[0]);
}

async function estadoDoEvento(slug) {
  const { rows } = await q('SELECT estado, versao FROM ao_vivo WHERE slug = $1', [slug]);
  return rows[0] || null;
}

// Um passo do operador para UM sorteio. Toda escrita é condicional ao estado lido: duas chamadas ao mesmo
// tempo (o laço + uma leitura) não começam duas vezes nem gravam os grupos em dobro.
export async function passo(s, agora = Date.now()) {
  const acao = decidir(s, agora);
  if (acao === 'comecar') {
    const ev = await estadoDoEvento(s.evento);
    const nomes = (ev?.estado?.pilotos || []).map((p) => p.nome);
    if (nomes.length < 2) return 'sem_pilotos';
    const semente = crypto.randomBytes(8).toString('hex');
    const ordem = montarOrdem(nomes, semente, (s.cabecas || []).filter((c) => nomes.includes(c)));
    await q(
      `UPDATE sorteios SET semente = $2, participantes = $3::jsonb, ordem = $4::jsonb, iniciado_em = $5
       WHERE id = $1 AND ordem IS NULL AND status = 'agendado'`,
      [s.id, semente, JSON.stringify(nomes), JSON.stringify(ordem), new Date(agora).toISOString()]
    );
    return acao;
  }
  if (acao === 'concluir') {
    await q(`UPDATE sorteios SET status = 'concluido', concluido_em = $2 WHERE id = $1 AND status = 'agendado'`, [s.id, new Date(agora).toISOString()]);
    return passo({ ...s, status: 'concluido' }, agora);
  }
  if (acao === 'aplicar') {
    const ev = await estadoDoEvento(s.evento);
    if (!ev) return 'sem_evento';
    const novo = aplicarGrupos(ev.estado, s.ordem);
    const { rows } = await q(
      `UPDATE ao_vivo SET estado = $2::jsonb, versao = versao + 1, atualizado_em = now() WHERE slug = $1 AND versao = $3 RETURNING versao`,
      [s.evento, JSON.stringify(novo), ev.versao]
    );
    if (!rows[0]) return 'versao_mudou'; // tenta de novo no próximo passo
    await q('UPDATE sorteios SET aplicado = true WHERE id = $1', [s.id]);
    console.log(`[sorteio] ${s.evento}: grupos gravados (evento versão ${rows[0].versao})`);
    return acao;
  }
  return acao;
}

export async function avancar(agora = Date.now()) {
  const { rows } = await q(`SELECT * FROM sorteios WHERE status = 'agendado' OR (status = 'concluido' AND NOT aplicado)`);
  for (const r of rows) await passo(comoFoto(r), agora);
}

let laco = null;
export function iniciarLaco() {
  if (laco) return;
  let rodando = false;
  laco = setInterval(async () => {
    if (rodando) return;
    rodando = true;
    try { await avancar(); } catch (e) { console.error('[sorteio] passo falhou:', e.message); } finally { rodando = false; }
  }, 2000);
  laco.unref?.();
}

// pública: a tela do sorteio
router.get('/:evento', ah(async (req, res) => {
  let s = await ultimo(req.params.evento);
  if (!s) return res.status(404).json({ erro: 'sem_sorteio' });
  if (decidir(s, Date.now()) !== 'nada') { await passo(s); s = await ultimo(req.params.evento); }
  const ev = await estadoDoEvento(req.params.evento);
  const idDe = new Map((ev?.estado?.pilotos || []).map((p) => [p.nome, p.piloto_id ?? null]));
  const f = fotografia(s, Date.now());
  f.revelados = f.revelados.map((r) => ({ ...r, piloto_id: idDe.get(r.nome) ?? null }));
  f.inscritos = (ev?.estado?.pilotos || []).length;
  f.titulo = ev?.estado?.titulo || null;
  res.set('Cache-Control', 'no-store');
  res.json(f);
}));

// admin: agenda (substitui o agendado anterior do mesmo evento)
router.post('/:evento', exigirAdmin, ah(async (req, res) => {
  const { agendado_para, passo_ms, cabecas } = req.body || {};
  const quando = ms(agendado_para);
  if (!quando) return res.status(400).json({ erro: 'agendado_para_invalido' });
  const passoMs = Number(passo_ms) || PASSO_MS;
  if (passoMs < 1000 || passoMs > 60000) return res.status(400).json({ erro: 'passo_invalido' });
  const ev = await estadoDoEvento(req.params.evento);
  if (!ev) return res.status(404).json({ erro: 'evento_nao_encontrado' });
  const vivo = await ultimo(req.params.evento);
  if (vivo && vivo.status === 'agendado' && vivo.ordem) return res.status(409).json({ erro: 'sorteio_em_andamento' });
  await q(`UPDATE sorteios SET status = 'cancelado' WHERE evento = $1 AND status = 'agendado'`, [req.params.evento]);
  const { rows } = await q(
    `INSERT INTO sorteios (evento, agendado_para, passo_ms, cabecas) VALUES ($1, $2, $3, $4::jsonb) RETURNING id`,
    [req.params.evento, new Date(quando).toISOString(), passoMs, JSON.stringify(Array.isArray(cabecas) ? cabecas : [])]
  );
  res.status(201).json({ ok: true, id: rows[0].id, agendado_para: new Date(quando).toISOString(), inscritos: (ev.estado.pilotos || []).length });
}));

// admin: cancela o agendado (não desfaz sorteio já concluído)
router.delete('/:evento', exigirAdmin, ah(async (req, res) => {
  const { rowCount } = await q(`UPDATE sorteios SET status = 'cancelado' WHERE evento = $1 AND status = 'agendado'`, [req.params.evento]);
  res.json({ ok: true, cancelados: rowCount });
}));

export default router;
