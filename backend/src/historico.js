// Histórico, ranking e números do piloto — tudo derivado dos EVENTOS gravados em `ao_vivo`.
// Pedido do Brunner 14/10/2026: "historico para começarmos a computar os resultados a partir dessa. talvez
// até da última (...) da última vez foram 4 corridas. mesmo esquema de pontos."
// Funções PURAS: recebem [{ slug, estado }] e devolvem tabelas. Nada aqui toca o banco.
//
// Dois formatos de evento:
//  - 'copa3' (padrão): 4 baterias em 2 grupos + final (src/aoVivo.js). Classificação do evento = ordem da
//    FINAL, e depois de quem não foi pra final, a soma das baterias.
//  - 'corridas': lista livre de corridas (17/07/2026: 4 corridas, cada piloto em 2). Classificação = soma das
//    posições, menor vence; corrida que faltou = 14. Enquanto faltar folha, ordena pela MÉDIA e marca parcial.
//
// Ranking do campeonato, "mesmo esquema": a colocação no evento é o número de pontos (1º = 1); menor soma
// vence; quem não correu o evento leva (nº de classificados naquele evento + 1).
import { calcularQuadro, resultadoDaSessao, normalizar, POSICAO_DE_QUEM_FALTA } from './aoVivo.js';

const menor = (a, b) => (a == null ? b : b == null ? a : Math.min(a, b));
const chaveDe = (p, nome) => (p?.piloto_id != null ? `id:${p.piloto_id}` : `nome:${normalizar(nome)}`);

function indicePilotos(estado) {
  const m = new Map();
  for (const p of estado.pilotos || []) m.set(p.nome, p);
  return m;
}

// ---------- participações: 1 linha por piloto por corrida ----------
export function participacoesDoEvento({ slug, estado }) {
  const pil = indicePilotos(estado);
  const base = { evento: slug, titulo: estado.titulo, data: estado.data };
  const out = [];
  const push = (sess, l) => {
    const p = pil.get(l.piloto);
    out.push({
      ...base, sessao: sess.codigo, sessao_nome: sess.nome, tipo: sess.tipo, tracado: sess.tracado || estado.tracado || null,
      hora: sess.hora || null, n_pilotos: sess.n,
      piloto: l.piloto, piloto_id: p?.piloto_id ?? null, chave: chaveDe(p, l.piloto),
      pos: l.ausente ? null : l.pos_oficial, ausente: !!l.ausente, kart: l.kart ?? null,
      mv_ms: l.mv_ms ?? null, voltas: l.voltas ?? null,
    });
  };
  if (estado.formato === 'corridas') {
    for (const c of estado.corridas || []) {
      const res = resultadoDaSessao(c.linhas || [], [], { contarAusentes: false });
      for (const l of res) push({ codigo: c.codigo, nome: c.nome, tipo: 'corrida', tracado: c.tracado, hora: c.hora, n: res.length }, l);
    }
    return out;
  }
  const q = calcularQuadro(estado);
  for (const s of Object.values(q.sessoes)) {
    const n = s.resultado.filter((l) => !l.ausente).length;
    for (const l of s.resultado) push({ codigo: s.codigo, nome: s.nome, tipo: s.tipo, n }, l);
  }
  return out;
}

// ---------- classificação final de UM evento ----------
export function classificacaoDoEvento({ slug, estado }) {
  const pil = indicePilotos(estado);
  const linha = (nome, extra) => ({ piloto: nome, piloto_id: pil.get(nome)?.piloto_id ?? null, chave: chaveDe(pil.get(nome), nome), ...extra });

  if (estado.formato === 'corridas') {
    const previstas = estado.corridas_previstas || (estado.corridas || []).length;
    const porPiloto = estado.corridas_por_piloto || null;
    const lancadas = (estado.corridas || []).filter((c) => (c.linhas || []).length);
    const completa = lancadas.length >= previstas;
    const acc = new Map();
    for (const p of participacoesDoEvento({ slug, estado })) {
      if (p.ausente) continue;
      const a = acc.get(p.piloto) || { soma: 0, n: 0, mv: null };
      a.soma += p.pos; a.n += 1; a.mv = menor(a.mv, p.mv_ms);
      acc.set(p.piloto, a);
    }
    const tab = [...acc].map(([nome, a]) => {
      const faltou = completa && porPiloto ? Math.max(0, porPiloto - a.n) : 0;
      return linha(nome, { corridas: a.n, pontos: a.soma + faltou * POSICAO_DE_QUEM_FALTA, media: a.soma / a.n, mv_ms: a.mv });
    });
    tab.sort(completa
      ? (x, y) => x.pontos - y.pontos || (x.mv_ms ?? Infinity) - (y.mv_ms ?? Infinity)
      : (x, y) => x.media - y.media || y.corridas - x.corridas || (x.mv_ms ?? Infinity) - (y.mv_ms ?? Infinity));
    tab.forEach((l, i) => { l.pos = i + 1; });
    return {
      slug, titulo: estado.titulo, data: estado.data, formato: 'corridas', completa, linhas: tab,
      criterio: completa ? 'soma das posições (menor vence)' : `parcial: ${lancadas.length} de ${previstas} corridas lançadas — ordem pela média de posição`,
    };
  }

  const q = calcularQuadro(estado);
  const final = q.final.classificacao;
  const naFinal = new Set(final.map((l) => l.piloto));
  const resto = q.geral.tabela.filter((l) => l.correu && !naFinal.has(l.piloto));
  const linhas = [
    ...final.map((l) => linha(l.piloto, { na_final: true, baterias: l.baterias })),
    ...resto.map((l) => linha(l.piloto, { na_final: false, baterias: l.total })),
  ];
  linhas.forEach((l, i) => { l.pos = i + 1; });
  const completa = !!q.final.campeao;
  return {
    slug, titulo: estado.titulo, data: estado.data, formato: 'copa3', completa, linhas,
    campeao: q.final.campeao,
    criterio: completa ? 'final decide o pódio; depois da final, a soma das baterias'
      : linhas.length ? 'parcial: o evento ainda não terminou' : 'ainda não correu',
  };
}

// ---------- ranking do campeonato ----------
// eventos: [{ slug, estado }] — evento de teste (estado.teste) não entra.
export function rankingCampeonato(eventos) {
  const validos = eventos.filter((e) => !e.estado.teste)
    .map((e) => classificacaoDoEvento(e))
    .filter((c) => c.linhas.length)
    .sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const pilotos = new Map();
  for (const c of validos) {
    for (const l of c.linhas) {
      if (!pilotos.has(l.chave)) pilotos.set(l.chave, { chave: l.chave, piloto: l.piloto, piloto_id: l.piloto_id, por_evento: {} });
      const p = pilotos.get(l.chave);
      p.por_evento[c.slug] = l.pos;
      if (l.piloto_id != null) p.piloto_id = l.piloto_id;
    }
  }
  const tabela = [...pilotos.values()].map((p) => {
    let total = 0; let melhor = null; let disputados = 0;
    const colunas = validos.map((c) => {
      const pos = p.por_evento[c.slug];
      if (pos != null) { disputados++; melhor = menor(melhor, pos); total += pos; return { evento: c.slug, pos, pontos: pos }; }
      const pontos = c.linhas.length + 1;
      total += pontos;
      return { evento: c.slug, pos: null, pontos };
    });
    return { piloto: p.piloto, piloto_id: p.piloto_id, chave: p.chave, total, melhor_colocacao: melhor, eventos_disputados: disputados, colunas };
  });
  tabela.sort((a, b) => a.total - b.total || a.melhor_colocacao - b.melhor_colocacao
    || b.eventos_disputados - a.eventos_disputados || a.piloto.localeCompare(b.piloto));
  tabela.forEach((l, i) => { l.pos = i + 1; });
  return {
    eventos: validos.map((c) => ({ slug: c.slug, titulo: c.titulo, data: c.data, completa: c.completa, n: c.linhas.length, criterio: c.criterio })),
    parcial: validos.some((c) => !c.completa),
    regra: 'Colocação no evento = pontos (1º = 1). Menor soma vence. Quem não correu um evento leva o nº de classificados dele + 1.',
    tabela,
  };
}

// ---------- números do piloto ----------
export function numerosDoPiloto(eventos, chave) {
  const validos = eventos.filter((e) => !e.estado.teste);
  const corridas = validos.flatMap((e) => participacoesDoEvento(e)).filter((p) => p.chave === chave)
    .sort((a, b) => String(a.data).localeCompare(String(b.data)) || String(a.hora || a.sessao).localeCompare(String(b.hora || b.sessao)));
  const correu = corridas.filter((c) => !c.ausente);
  const voltasRapidas = {};
  for (const c of correu) {
    if (c.mv_ms == null) continue;
    const k = c.tracado || 'traçado não informado';
    if (!voltasRapidas[k] || c.mv_ms < voltasRapidas[k].mv_ms) voltasRapidas[k] = { mv_ms: c.mv_ms, evento: c.evento, sessao: c.sessao_nome, data: c.data };
  }
  const eventosDoPiloto = validos.map((e) => {
    const c = classificacaoDoEvento(e);
    const l = c.linhas.find((x) => x.chave === chave);
    return l ? { slug: c.slug, titulo: c.titulo, data: c.data, pos: l.pos, de: c.linhas.length, completa: c.completa, campeao: c.campeao === l.piloto } : null;
  }).filter(Boolean);
  const soma = correu.reduce((s, c) => s + c.pos, 0);
  return {
    corridas_disputadas: correu.length,
    faltas: corridas.length - correu.length,
    vitorias: correu.filter((c) => c.pos === 1).length,
    podios: correu.filter((c) => c.pos <= 3).length,
    melhor_posicao: correu.length ? Math.min(...correu.map((c) => c.pos)) : null,
    media_posicao: correu.length ? Math.round((soma / correu.length) * 10) / 10 : null,
    voltas_completadas: correu.reduce((s, c) => s + (c.voltas || 0), 0),
    finais: correu.filter((c) => c.tipo === 'final').length,
    titulos: eventosDoPiloto.filter((e) => e.campeao).length,
    melhor_volta_por_tracado: voltasRapidas,
    eventos: eventosDoPiloto,
    corridas,
  };
}
