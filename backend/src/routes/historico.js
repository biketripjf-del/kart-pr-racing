// Histórico público: ranking do campeonato, eventos e números de cada piloto — tudo calculado na leitura a partir
// dos eventos gravados (src/historico.js). Dados pessoais da ficha NÃO saem daqui: só nome, apelido e foto.
import { Router } from 'express';
import { q } from '../db.js';
import { ah } from '../async.js';
import { rankingCampeonato, classificacaoDoEvento, numerosDoPiloto, rankingRitmo, recordesPorTracado } from '../historico.js';
import { simular, matematicaDoTitulo } from '../simulacao.js';

const router = Router();

async function eventos() {
  const { rows } = await q('SELECT slug, estado FROM ao_vivo');
  return rows;
}

async function cartoes(ids) {
  const lista = [...new Set(ids.filter((x) => x != null))];
  if (!lista.length) return new Map();
  const { rows } = await q(
    `SELECT id, nome, apelido, foto_em, (foto IS NOT NULL) AS tem_foto FROM pilotos WHERE id IN (${lista.map((_, i) => `$${i + 1}`).join(',')})`,
    lista
  );
  return new Map(rows.map((r) => [r.id, { apelido: r.apelido, foto_v: r.tem_foto && r.foto_em ? new Date(r.foto_em).getTime() : null }]));
}

// ?ano=2024 · ?ano=todos (história inteira) · sem ano = o ano mais recente
router.get('/ranking', ah(async (req, res) => {
  const r = rankingCampeonato(await eventos(), { ano: req.query.ano });
  const c = await cartoes(r.tabela.map((l) => l.piloto_id));
  r.tabela = r.tabela.map((l) => ({ ...l, ...(c.get(l.piloto_id) || {}) }));
  res.set('Cache-Control', 'no-store');
  res.json(r);
}));

router.get('/ritmo', ah(async (req, res) => {
  const r = rankingRitmo(await eventos());
  const c = await cartoes([...r.tabela, ...r.poucas].map((l) => l.piloto_id));
  r.tabela = r.tabela.map((l) => ({ ...l, ...(c.get(l.piloto_id) || {}) }));
  r.poucas = r.poucas.map((l) => ({ ...l, ...(c.get(l.piloto_id) || {}) }));
  res.set('Cache-Control', 'no-store');
  res.json(r);
}));

router.get('/recordes', ah(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(recordesPorTracado(await eventos()));
}));

// classificação de cada edição (aba Eventos do ranking, 19/10). O nome exibido é o mesmo do ranking (o da folha mais
// recente: "Manoel" de 2020 sai Emmanuel Pacheco); o da folha fica em nome_folha.
router.get('/eventos', ah(async (req, res) => {
  const evs = (await eventos()).filter((e) => !e.estado.teste);
  const nomeAtual = new Map(rankingCampeonato(evs, { ano: 'todos' }).tabela.map((l) => [l.chave, l.piloto]));
  const lista = evs.map((e) => classificacaoDoEvento(e)).sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const c = await cartoes(lista.flatMap((ev) => ev.linhas.map((l) => l.piloto_id)));
  for (const ev of lista) {
    const doCampeao = ev.campeao != null ? ev.linhas.find((l) => l.piloto === ev.campeao) : null;
    ev.linhas = ev.linhas.map((l) => ({ ...l, piloto: nomeAtual.get(l.chave) || l.piloto, nome_folha: l.piloto, ...(c.get(l.piloto_id) || {}) }));
    if (doCampeao) ev.campeao = nomeAtual.get(doCampeao.chave) || ev.campeao;
  }
  res.set('Cache-Control', 'no-store');
  res.json(lista);
}));

// todos os pilotos que aparecem em algum evento (página /pilotos)
router.get('/pilotos', ah(async (req, res) => {
  const evs = (await eventos()).filter((e) => !e.estado.teste);
  const r = rankingCampeonato(evs);
  const posRanking = new Map(r.tabela.map((l) => [l.chave, l.pos]));
  const correu = new Set(rankingCampeonato(evs, { ano: 'todos' }).tabela.map((l) => l.chave));
  const vistos = new Map();
  for (const e of evs) {
    for (const p of e.estado.pilotos || []) {
      if (p.piloto_id == null || vistos.has(p.piloto_id)) continue;
      vistos.set(p.piloto_id, { piloto_id: p.piloto_id, nome: p.nome, ranking: posRanking.get(`id:${p.piloto_id}`) ?? null, ano: r.ano, temporada: r.nome || `temporada ${r.ano}`, ja_correu: correu.has(`id:${p.piloto_id}`) });
    }
  }
  const c = await cartoes([...vistos.keys()]);
  const lista = [...vistos.values()].map((p) => ({ ...p, ...(c.get(p.piloto_id) || {}) }))
    .sort((a, b) => (a.ranking ?? 999) - (b.ranking ?? 999) || a.nome.localeCompare(b.nome));
  res.set('Cache-Control', 'no-store');
  res.json(lista);
}));

router.get('/piloto/:id', ah(async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await q('SELECT id, nome, apelido, cidade, instagram, foto_em, (foto IS NOT NULL) AS tem_foto FROM pilotos WHERE id = $1 AND ativo', [id]);
  if (!rows[0]) return res.status(404).json({ erro: 'nao_encontrado' });
  const evs = await eventos();
  // nome de exibição = como ele aparece no evento mais recente
  const nomeNoEvento = evs.filter((e) => !e.estado.teste).sort((a, b) => String(b.estado.data).localeCompare(String(a.estado.data)))
    .map((e) => (e.estado.pilotos || []).find((p) => p.piloto_id === id)?.nome).find(Boolean);
  const r = rankingCampeonato(evs);
  const noRanking = r.tabela.find((l) => l.piloto_id === id);
  const h = rankingCampeonato(evs, { ano: 'todos' });
  const naHistoria = h.tabela.find((l) => l.piloto_id === id);
  const p = rows[0];
  res.set('Cache-Control', 'no-store');
  res.json({
    piloto: {
      id: p.id, nome: nomeNoEvento || p.nome, apelido: p.apelido, cidade: p.cidade, instagram: p.instagram,
      foto_v: p.tem_foto && p.foto_em ? new Date(p.foto_em).getTime() : null,
    },
    ranking: noRanking ? { ano: r.ano, nome: r.nome, pos: noRanking.pos, de: r.tabela.length, total: noRanking.total, parcial: r.parcial } : null,
    ranking_historia: naHistoria ? { pos: naHistoria.pos, de: h.tabela.length, total: naHistoria.total } : null,
    numeros: numerosDoPiloto(evs, `id:${id}`),
  });
}));

// Simulador da última etapa (19/10, "1+2 go"): nada é gravado. GET = matemática do título; POST = "e se…" com os
// ajustes { ajustes: { [nome]: { b1, b2, final } } } (posições de 1 a 14). Sem etapa pela frente = 404.
const posicao = (v) => (v == null || v === '' ? null : Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 14 ? Number(v) : undefined);
router.get('/titulo', ah(async (req, res) => {
  const m = matematicaDoTitulo((await eventos()).filter((e) => !e.estado.teste));
  if (!m) return res.status(404).json({ erro: 'sem_etapa' });
  const c = await cartoes(m.linhas.map((l) => l.piloto_id));
  m.linhas = m.linhas.map((l) => ({ ...l, ...(c.get(l.piloto_id) || {}) }));
  res.set('Cache-Control', 'no-store');
  res.json(m);
}));
router.post('/simular', ah(async (req, res) => {
  const bruto = req.body?.ajustes || {};
  if (typeof bruto !== 'object' || Array.isArray(bruto) || Object.keys(bruto).length > 28) return res.status(400).json({ erro: 'ajustes_invalidos' });
  const ajustes = {};
  for (const [nome, a] of Object.entries(bruto)) {
    const v = { b1: posicao(a?.b1), b2: posicao(a?.b2), final: posicao(a?.final) };
    if (Object.values(v).includes(undefined)) return res.status(400).json({ erro: 'posicao_invalida', piloto: nome });
    ajustes[String(nome)] = v;
  }
  const s = simular((await eventos()).filter((e) => !e.estado.teste), ajustes);
  if (!s) return res.status(404).json({ erro: 'sem_etapa' });
  const c = await cartoes(s.ranking.tabela.map((l) => l.piloto_id));
  s.ranking.tabela = s.ranking.tabela.map((l) => ({ ...l, ...(c.get(l.piloto_id) || {}) }));
  res.set('Cache-Control', 'no-store');
  res.json(s);
}));

export default router;
