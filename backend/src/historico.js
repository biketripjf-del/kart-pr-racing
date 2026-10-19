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
//    Com `copa: true` (1ª Copa 2020, 2ª Copa 2024) o 1º do evento completo é o campeão (vira título no piloto).
//
// Ranking do campeonato, "mesmo esquema": a colocação no evento é o número de pontos (1º = 1); menor soma
// vence; quem não correu o evento leva (nº de classificados naquele evento + 1).
import { calcularQuadro, resultadoDaSessao, normalizar, POSICAO_DE_QUEM_FALTA } from './aoVivo.js';

const menor = (a, b) => (a == null ? b : b == null ? a : Math.min(a, b));
// o mesmo piloto (mesmo piloto_id) pode ter nomes diferentes nas folhas — "Guilherme" em 2020, "Guilherme Teixeira"
// depois (19/10): nas tabelas vale o nome da folha MAIS RECENTE, seja qual for a ordem em que os eventos chegam.
const nomeRecente = (a, nome, data) => { if (a._data == null || String(data) >= a._data) { a.piloto = nome; a._data = String(data); } };
const chaveDe = (p, nome) => (p?.piloto_id != null ? `id:${p.piloto_id}` : `nome:${normalizar(nome)}`);

function indicePilotos(estado) {
  const m = new Map();
  for (const p of estado.pilotos || []) m.set(p.nome, p);
  return m;
}

// ---------- índice de ritmo (Brunner 19/10: GO) ----------
// Melhor volta do piloto ÷ melhor volta daquela corrida × 100: 100 = o mais rápido da corrida, 101,5 = 1,5% mais lento.
// Compara edições, traçados e dias diferentes na mesma régua. Corrida com menos de 3 voltas válidas não mede ritmo
// (com 1 ou 2 pilotos o "mais rápido" não diz nada).
export const MIN_VOLTAS_RITMO = 3;
function melhorDaSessao(res) {
  const mvs = res.filter((l) => !l.ausente && l.mv_ms != null).map((l) => l.mv_ms);
  return mvs.length >= MIN_VOLTAS_RITMO ? Math.min(...mvs) : null;
}
function ritmoDaVolta(mv, melhor) {
  return mv != null && melhor ? Math.round((mv / melhor) * 10000) / 100 : null;
}
const media2 = (xs) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null);

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
      ritmo: ritmoDaVolta(l.mv_ms, sess.melhor),
    });
  };
  if (estado.formato === 'corridas') {
    for (const c of estado.corridas || []) {
      const res = resultadoDaSessao(c.linhas || [], [], { contarAusentes: false });
      const melhor = melhorDaSessao(res);
      for (const l of res) push({ codigo: c.codigo, nome: c.nome, tipo: 'corrida', tracado: c.tracado, hora: c.hora, n: res.length, melhor }, l);
    }
    return out;
  }
  const q = calcularQuadro(estado);
  for (const s of Object.values(q.sessoes)) {
    const n = s.resultado.filter((l) => !l.ausente).length;
    const melhor = melhorDaSessao(s.resultado);
    for (const l of s.resultado) push({ codigo: s.codigo, nome: s.nome, tipo: s.tipo, n, melhor }, l);
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
    // campeão OFICIAL (19/10/2026, Brunner sobre a 2ª Copa: "foi o guilherme"): a folha não traz a regra de 2024 e a
    // soma com "faltou = 14" dava outro. O fato informado pela organização vence a conta; o resto segue a soma.
    const oficial = completa && estado.campeao_oficial ? tab.findIndex((l) => l.piloto === estado.campeao_oficial) : -1;
    if (oficial > 0) tab.unshift(...tab.splice(oficial, 1));
    tab.forEach((l, i) => { l.pos = i + 1; });
    return {
      slug, titulo: estado.titulo, data: estado.data, formato: 'corridas', completa, linhas: tab,
      // edição da Copa guardada como lista de corridas (1ª e 2ª): completa, o 1º é o campeão e conta título
      campeao: estado.copa && completa ? tab[0]?.piloto ?? null : null,
      criterio: completa ? (oficial >= 0 ? 'campeão oficial informado pela organização; demais pela soma das posições' : 'soma das posições (menor vence)') : `parcial: ${lancadas.length} de ${previstas} corridas lançadas — ordem pela média de posição`,
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
// Pontuação estilo F1 (Brunner 19/10/2026: "go, 11º em diante leva 1 ponto + F1, falta zero"): mais pontos vence.
// Quem faltou leva 0 e não perde nada além disso; corrida avulsa (formato 'corridas' sem copa: 17/07, 09/01) vale metade.
// Antes era "colocação = pontos, menor soma vence, faltou = classificados + 1": quem não estava em 2020 carregava a falta
// pra sempre e cada folha antiga que chegava empurrava todo mundo.
export const PONTOS_F1 = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const PONTOS_DO_11_EM_DIANTE = 1;
export const PESO_AVULSA = 0.5;
export const pontosDaPosicao = (pos, peso = 1) => (PONTOS_F1[pos - 1] ?? PONTOS_DO_11_EM_DIANTE) * peso;

// Temporada (Brunner 19/10: "a copa é por ano, não por todas da história"; "deixa a opção de ver por toda história,
// mas o padrão é a do ano"): `ano` = só os eventos daquele ano; 'todos' = a história inteira. Sem `ano` = o ano mais
// recente com corrida lançada. O NOME exibido vem de todos os anos ("Manoel" de 2020 segue saindo Emmanuel Pacheco).
export const anoDe = (c) => String(c.data || '').slice(0, 4);

export function rankingCampeonato(eventos, { ano } = {}) {
  const todos = eventos.filter((e) => !e.estado.teste)
    .map((e) => ({ ...classificacaoDoEvento(e), avulsa: e.estado.formato === 'corridas' && !e.estado.copa }))
    .filter((c) => c.linhas.length)
    .sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const anos = [...new Set(todos.map(anoDe))].sort().reverse();
  const temporada = ano === 'todos' ? null : (ano && anos.includes(String(ano)) ? String(ano) : anos[0] ?? null);
  const validos = temporada ? todos.filter((c) => anoDe(c) === temporada) : todos;
  const nomes = new Map();
  for (const c of todos) for (const l of c.linhas) nomeRecente(nomes.get(l.chave) || nomes.set(l.chave, {}).get(l.chave), l.piloto, c.data);
  const pilotos = new Map();
  for (const c of validos) {
    for (const l of c.linhas) {
      if (!pilotos.has(l.chave)) pilotos.set(l.chave, { chave: l.chave, piloto: l.piloto, piloto_id: l.piloto_id, por_evento: {} });
      const p = pilotos.get(l.chave);
      p.piloto = nomes.get(l.chave).piloto;
      p.por_evento[c.slug] = l.pos;
      if (l.piloto_id != null) p.piloto_id = l.piloto_id;
    }
  }
  const tabela = [...pilotos.values()].map((p) => {
    let total = 0; let melhor = null; let disputados = 0;
    const colunas = validos.map((c) => {
      const pos = p.por_evento[c.slug];
      if (pos == null) return { evento: c.slug, pos: null, pontos: 0 };
      const pontos = pontosDaPosicao(pos, c.avulsa ? PESO_AVULSA : 1);
      disputados++; melhor = menor(melhor, pos); total += pontos;
      return { evento: c.slug, pos, pontos };
    });
    return { piloto: p.piloto, piloto_id: p.piloto_id, chave: p.chave, total, melhor_colocacao: melhor, eventos_disputados: disputados, colunas };
  });
  tabela.sort((a, b) => b.total - a.total || a.melhor_colocacao - b.melhor_colocacao
    || b.eventos_disputados - a.eventos_disputados || a.piloto.localeCompare(b.piloto));
  tabela.forEach((l, i) => { l.pos = i + 1; });
  return {
    ano: temporada ?? 'todos', anos,
    eventos: validos.map((c) => ({ slug: c.slug, titulo: c.titulo, data: c.data, completa: c.completa, n: c.linhas.length, criterio: c.criterio, avulsa: c.avulsa })),
    parcial: validos.some((c) => !c.completa),
    regra: 'Pontos como na Fórmula 1: 1º 25 · 2º 18 · 3º 15 · 4º 12 · 5º 10 · 6º 8 · 7º 6 · 8º 4 · 9º 2 · 10º 1 · do 11º em diante 1. Corrida avulsa (fora da Copa) vale metade. Quem não correu leva 0. Mais pontos vence; empate: melhor colocação.',
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
  const comRitmo = correu.filter((c) => c.ritmo != null);
  const ritmoPorEvento = [...new Set(comRitmo.map((c) => c.evento))].map((slug) => {
    const cs = comRitmo.filter((c) => c.evento === slug);
    return { evento: slug, titulo: cs[0].titulo, data: cs[0].data, ritmo: media2(cs.map((c) => c.ritmo)), corridas: cs.length };
  });
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
    ritmo_medio: media2(comRitmo.map((c) => c.ritmo)),
    ritmo_por_evento: ritmoPorEvento,
    rivais: rivaisDoPiloto(validos, chave),
    eventos: eventosDoPiloto,
    corridas,
  };
}

// ---------- ranking de ritmo ----------
// Média do índice de ritmo em todas as corridas (menor = mais rápido). Quem tem só 1 corrida aparece, marcado.
export function rankingRitmo(eventos) {
  const validos = eventos.filter((e) => !e.estado.teste);
  const acc = new Map();
  for (const p of validos.flatMap((e) => participacoesDoEvento(e))) {
    if (p.ausente || p.ritmo == null) continue;
    const a = acc.get(p.chave) || { chave: p.chave, piloto: p.piloto, piloto_id: p.piloto_id, ritmos: [], vezes_mais_rapido: 0 };
    nomeRecente(a, p.piloto, p.data);
    a.ritmos.push(p.ritmo);
    if (p.ritmo === 100) a.vezes_mais_rapido++;
    if (p.piloto_id != null) a.piloto_id = p.piloto_id;
    acc.set(p.chave, a);
  }
  const tabela = [...acc.values()].map(({ ritmos, _data, ...a }) => ({ ...a, ritmo: media2(ritmos), corridas: ritmos.length, melhor_ritmo: Math.min(...ritmos) }))
    .sort((a, b) => a.ritmo - b.ritmo || b.corridas - a.corridas || a.piloto.localeCompare(b.piloto));
  tabela.forEach((l, i) => { l.pos = i + 1; });
  return {
    regra: 'Melhor volta do piloto ÷ melhor volta da corrida × 100. 100 = o mais rápido da corrida; 101,5 = 1,5% mais lento. A média de todas as corridas ordena a lista (menor = mais rápido).',
    tabela,
  };
}

// ---------- recordes por traçado ----------
// Volta mais rápida já registrada em cada traçado: `todos` = a melhor de cada piloto (Brunner 19/10: "por que eu não
// entro nessa página?" — com só o top 3 o resto não se acha), `top` = os 3 primeiros. Volta de traçado diferente não se compara.
// Nome exibido = o da folha mais recente do piloto em QUALQUER traçado ("Guilherme" de 2020 sai Guilherme Teixeira).
export function recordesPorTracado(eventos, { exceto } = {}) {
  const validos = eventos.filter((e) => !e.estado.teste && e.slug !== exceto);
  const parts = validos.flatMap((e) => participacoesDoEvento(e));
  const nomes = new Map();
  for (const p of parts) if (!p.ausente) nomeRecente(nomes.get(p.chave) || nomes.set(p.chave, {}).get(p.chave), p.piloto, p.data);
  const porTracado = new Map();
  for (const p of parts) {
    if (p.ausente || p.mv_ms == null || !p.tracado) continue;
    // "6,5 HP" e "6,5 hp" são o mesmo traçado: agrupa pelo nome normalizado, exibe a 1ª grafia
    const k = normalizar(p.tracado);
    const g = porTracado.get(k) || { tracado: p.tracado, lista: [] };
    g.lista.push({ piloto: nomes.get(p.chave)?.piloto ?? p.piloto, nome_folha: p.piloto, piloto_id: p.piloto_id, chave: p.chave, mv_ms: p.mv_ms, evento: p.evento, titulo: p.titulo, data: p.data, sessao: p.sessao_nome });
    porTracado.set(k, g);
  }
  return [...porTracado.values()].map(({ tracado, lista }) => {
    const melhores = [];
    for (const v of lista.sort((a, b) => a.mv_ms - b.mv_ms || String(a.data).localeCompare(String(b.data)))) {
      if (!melhores.some((m) => m.chave === v.chave)) melhores.push(v);
    }
    return { tracado, recorde: melhores[0], top: melhores.slice(0, 3), todos: melhores };
  }).sort((a, b) => a.tracado.localeCompare(b.tracado));
}

// ---------- rivais: confronto direto nas corridas em comum ----------
// Para cada piloto que correu a MESMA corrida: quem chegou na frente. Ausente não conta (não houve disputa).
export function rivaisDoPiloto(eventos, chave) {
  const porSessao = new Map();
  for (const p of eventos.filter((e) => !e.estado.teste).flatMap((e) => participacoesDoEvento(e))) {
    if (p.ausente || p.pos == null) continue;
    const k = `${p.evento}|${p.sessao}`;
    (porSessao.get(k) || porSessao.set(k, []).get(k)).push(p);
  }
  const acc = new Map();
  for (const linhas of porSessao.values()) {
    const eu = linhas.find((l) => l.chave === chave);
    if (!eu) continue;
    for (const o of linhas) {
      if (o.chave === chave) continue;
      const a = acc.get(o.chave) || { chave: o.chave, piloto: o.piloto, piloto_id: o.piloto_id, encontros: 0, vitorias: 0, derrotas: 0 };
      nomeRecente(a, o.piloto, o.data);
      a.encontros++;
      if (eu.pos < o.pos) a.vitorias++; else a.derrotas++;
      if (o.piloto_id != null) a.piloto_id = o.piloto_id;
      acc.set(o.chave, a);
    }
  }
  return [...acc.values()].map(({ _data, ...a }) => a).sort((a, b) => b.encontros - a.encontros || Math.abs(a.vitorias - a.derrotas) - Math.abs(b.vitorias - b.derrotas) || a.piloto.localeCompare(b.piloto));
}
