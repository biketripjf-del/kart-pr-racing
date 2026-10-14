// Quadro AO VIVO do dia de corrida (formato da 3ª Copa, 23/10/2026).
// Funções PURAS: recebem o estado gravado (pilotos + folhas de cada sessão) e devolvem o quadro
// calculado — pontos, grids, corte dos 14, grid e pódio da final. Nada aqui toca o banco.
//
// Regra que vale = ÁUDIO do Emmanuel (organizador) no grupo, 14/10/2026 13:17–13:19 BRT
// ("o que vale é o audio do emmanuel" — Brunner, 14:02 BRT). Onde o áudio cala, vale o texto do Brunner.
//  - 4 baterias (grupos A e B, cada piloto corre 2) + 5ª corrida, a final, com os 14 melhores.
//  - Antes de cada corrida, tomada de tempo (~10 voltas), qualify NORMAL: melhor volta larga em 1º.
//    Nada de grid invertido ("não é produtivo").
//  - "A sua posição é o número de pontos que você fez": 1º = 1 ponto, 5º = 5. Menor soma vence.
//    Perdeu a bateria = 14 pontos (texto). Desempate: melhor volta nas baterias (texto).
//  - A soma das baterias define os 14 da final; a FINAL sozinha decide campeão e pódio
//    (Brunner 14/10 14:41 BRT: a soma do campeão "não inclui" a final — vence quem ganhar a final).
//  - Punição do árbitro: 3 posições no resultado; reincidência de largada queimada = fim de fila (texto).

export const SESSOES = [
  { codigo: 'B1_A', nome: 'Bateria 1 · Grupo A', curto: 'Bateria 1-A', grupo: 'A', tipo: 'bateria', n: 1 },
  { codigo: 'B1_B', nome: 'Bateria 1 · Grupo B', curto: 'Bateria 1-B', grupo: 'B', tipo: 'bateria', n: 1 },
  { codigo: 'B2_A', nome: 'Bateria 2 · Grupo A', curto: 'Bateria 2-A', grupo: 'A', tipo: 'bateria', n: 2 },
  { codigo: 'B2_B', nome: 'Bateria 2 · Grupo B', curto: 'Bateria 2-B', grupo: 'B', tipo: 'bateria', n: 2 },
  { codigo: 'FINAL', nome: 'GRANDE FINAL', curto: 'Final', grupo: null, tipo: 'final' },
];
export const STATUS = ['aguardando', 'ao_vivo', 'provisorio', 'homologado'];
export const VAGAS_FINAL = 14;
export const POSICAO_DE_QUEM_FALTA = 14;
const PUNICAO_PADRAO = 3;

export const pontosDaPosicao = (pos) => pos;

// '00:48.485' | '48.485' | '1:02.3' → ms. Número já em ms passa direto.
export function tempoParaMs(t) {
  if (t == null || t === '') return null;
  if (typeof t === 'number') return Number.isFinite(t) ? Math.round(t) : null;
  const m = String(t).trim().match(/^(?:(\d+):)?(\d+(?:[.,]\d+)?)$/);
  if (!m) return null;
  const min = m[1] ? Number(m[1]) : 0;
  const seg = Number(m[2].replace(',', '.'));
  return Math.round((min * 60 + seg) * 1000);
}

export function msParaVolta(ms) {
  if (ms == null) return null;
  const min = Math.floor(ms / 60000);
  const seg = ((ms % 60000) / 1000).toFixed(3).padStart(6, '0');
  return min > 0 ? `${min}:${seg}` : seg;
}

// ---------- nomes: a folha do kartódromo traz o nome COMPLETO ("GABRIEL LANNA ALMEIDA") ----------
export const normalizar = (s) =>
  String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// Devolve { piloto } quando há UM candidato, { ambiguo: [...] } ou { nenhum: true }.
// Ordem: nome/apelido idêntico → todas as palavras do cadastro contidas no nome da folha.
export function resolverNome(nomeFolha, pilotos) {
  const alvo = normalizar(nomeFolha);
  const palavras = new Set(alvo.split(' '));
  const chaves = (p) => [p.nome, ...(p.aliases || [])].map(normalizar);
  const exatos = pilotos.filter((p) => chaves(p).includes(alvo));
  if (exatos.length === 1) return { piloto: exatos[0].nome };
  const contidos = pilotos.filter((p) => chaves(p).some((c) => c && c.split(' ').every((w) => palavras.has(w))));
  // "Marcelo Chaves" cabe em "Filho Marcelo Chaves": fica o candidato com MAIS palavras casadas, se for único.
  if (contidos.length > 1) {
    const tam = (p) => Math.max(...chaves(p).filter((c) => c.split(' ').every((w) => palavras.has(w))).map((c) => c.split(' ').length));
    const maior = Math.max(...contidos.map(tam));
    const top = contidos.filter((p) => tam(p) === maior);
    if (top.length === 1) return { piloto: top[0].nome };
    return { ambiguo: top.map((p) => p.nome) };
  }
  if (contidos.length === 1) return { piloto: contidos[0].nome };
  return { nenhum: true };
}

// ---------- uma folha → resultado oficial (punições e quem faltou) ----------
// linhas: [{ piloto, pos, kart, mv, voltas, dl, ausente, punicao, obs }]
// punicao: número de posições (true = 3) ou 'fim' (fim de fila).
export function resultadoDaSessao(linhas, pilotosDaSessao, { contarAusentes = true } = {}) {
  const lista = (linhas || []).filter((l) => !l.ausente && l.pos != null)
    .slice().sort((a, b) => a.pos - b.pos)
    .map((l) => ({ ...l, mv_ms: tempoParaMs(l.mv) }));

  // fim de fila primeiro (na ordem em que chegaram), depois as quedas de N posições de trás pra frente
  const fim = lista.filter((l) => l.punicao === 'fim');
  let ordem = lista.filter((l) => l.punicao !== 'fim');
  const quedas = ordem.filter((l) => l.punicao).sort((a, b) => b.pos - a.pos);
  for (const l of quedas) {
    const n = l.punicao === true ? PUNICAO_PADRAO : Number(l.punicao) || 0;
    const i = ordem.indexOf(l);
    ordem.splice(i, 1);
    ordem.splice(Math.min(ordem.length, i + n), 0, l);
  }
  ordem = [...ordem, ...fim];
  const resultado = ordem.map((l, i) => ({ ...l, pos_oficial: i + 1, pos_folha: l.pos }));

  if (contarAusentes && resultado.length > 0) {
    const correram = new Set(resultado.map((l) => l.piloto));
    for (const nome of pilotosDaSessao) {
      if (!correram.has(nome)) {
        resultado.push({ piloto: nome, ausente: true, pos_oficial: POSICAO_DE_QUEM_FALTA, pos_folha: null, mv_ms: null });
      }
    }
  }
  return resultado;
}

const menorVolta = (...vs) => {
  const ok = vs.filter((v) => v != null);
  return ok.length ? Math.min(...ok) : null;
};
const temFolha = (linhas) => Array.isArray(linhas) && linhas.length > 0;

// grid = ordem da tomada de tempo daquela corrida; atrasado e quem não marcou tempo vão pro fim
function gridDaTomada(tomada, nomes, atrasados) {
  if (!temFolha(tomada)) return null;
  const pela = resultadoDaSessao(tomada, [], { contarAusentes: false }).map((l) => l.piloto).filter((n) => !atrasados.has(n));
  const resto = nomes.filter((n) => !pela.includes(n) && !atrasados.has(n));
  return [...pela, ...resto, ...nomes.filter((n) => atrasados.has(n))];
}

const ordemPorPontos = (a, b) =>
  a.total - b.total || (a.mv_baterias_ms ?? Infinity) - (b.mv_baterias_ms ?? Infinity);

function marcarEmpates(tabela) {
  tabela.forEach((l, i) => {
    l.pos = i + 1;
    const viz = tabela[i + 1];
    if (viz && viz.total === l.total && viz.mv_baterias_ms === l.mv_baterias_ms && l.correu) {
      l.empate_sorteio = viz.empate_sorteio = true;
    }
  });
  return tabela;
}

// ---------- quadro completo ----------
export function calcularQuadro(estado) {
  const pilotos = estado.pilotos || [];
  const sessoes = estado.sessoes || {};
  const doGrupo = (g) => pilotos.filter((p) => p.grupo === g).map((p) => p.nome);
  const atrasados = new Set(pilotos.filter((p) => p.atrasado).map((p) => p.nome));
  const kartDe = {};

  const out = { sessoes: {}, grupos: {}, geral: null, final: null, melhor_volta_do_dia: null, avisos: [] };
  const voltasDoDia = []; // { piloto, mv_ms, sessao }

  for (const def of SESSOES) {
    const s = sessoes[def.codigo] || {};
    const pilotosSessao = def.grupo ? doGrupo(def.grupo) : [];
    const status = s.status || (temFolha(s.linhas) ? 'provisorio' : 'aguardando');
    const resultado = temFolha(s.linhas)
      ? resultadoDaSessao(s.linhas, pilotosSessao, { contarAusentes: def.tipo === 'bateria' })
      : [];
    const tomada = temFolha(s.tomada) ? resultadoDaSessao(s.tomada, [], { contarAusentes: false }) : [];
    for (const l of [...tomada, ...resultado]) {
      if (l.mv_ms != null) voltasDoDia.push({ piloto: l.piloto, mv_ms: l.mv_ms, sessao: def.codigo });
    }
    for (const l of resultado) {
      if (l.kart != null) (kartDe[l.piloto] ||= {})[def.codigo] = l.kart;
      l.pontos = pontosDaPosicao(l.pos_oficial);
    }
    out.sessoes[def.codigo] = {
      ...def, status, atualizado_em: s.atualizado_em || null, foto: s.foto || null,
      observacoes: s.observacoes || null, resultado, tomada,
      grid: def.grupo ? gridDaTomada(s.tomada, pilotosSessao, atrasados) : null,
    };
  }

  // ---------- placar: por grupo e geral (os 28) ----------
  const linhaDoPiloto = (nome) => {
    const p = pilotos.find((x) => x.nome === nome) || {};
    const g = p.grupo;
    const r1 = g && out.sessoes[`B1_${g}`].resultado.find((l) => l.piloto === nome);
    const r2 = g && out.sessoes[`B2_${g}`].resultado.find((l) => l.piloto === nome);
    const bat = (r) => (r ? { pos: r.ausente ? null : r.pos_oficial, pontos: r.pontos, ausente: !!r.ausente } : null);
    return {
      piloto: nome, grupo: g || null, cabeca: p.cabeca || null,
      b1: bat(r1), b2: bat(r2),
      correu: !!(r1 || r2),
      total: (r1?.pontos || 0) + (r2?.pontos || 0),
      mv_baterias_ms: menorVolta(r1?.mv_ms, r2?.mv_ms),
    };
  };
  for (const g of ['A', 'B']) {
    const nomes = doGrupo(g);
    out.grupos[g] = { pilotos: nomes, tabela: marcarEmpates(nomes.map(linhaDoPiloto).sort(ordemPorPontos)) };
  }

  // quem já correu fica em cima; quem ainda não correu nenhuma fica embaixo (0 ponto não é liderança)
  const geral = pilotos.filter((p) => p.grupo).map((p) => linhaDoPiloto(p.nome))
    .sort((a, b) => Number(b.correu) - Number(a.correu) || ordemPorPontos(a, b));
  marcarEmpates(geral);
  const baterias = ['B1_A', 'B1_B', 'B2_A', 'B2_B'].map((c) => out.sessoes[c]);
  const algumaCorreu = baterias.some((s) => s.resultado.length);
  const definido = baterias.every((s) => s.status === 'homologado');
  for (const l of geral) l.vai_pra_final = algumaCorreu && l.correu && l.pos <= VAGAS_FINAL;
  if (geral[VAGAS_FINAL - 1]?.empate_sorteio && geral[VAGAS_FINAL]?.empate_sorteio) {
    out.avisos.push('Empate EXATO na 14ª vaga da final (pontos e melhor volta) — sorteio.');
  }
  out.geral = { tabela: geral, definido, parcial: algumaCorreu && !definido };

  // ---------- final ----------
  const fin = out.sessoes.FINAL;
  const classificados = geral.filter((l) => l.vai_pra_final);
  const nomesFinal = classificados.map((l) => l.piloto);
  const gridTomada = gridDaTomada((sessoes.FINAL || {}).tomada, nomesFinal, atrasados);
  fin.grid = gridTomada || (nomesFinal.length ? nomesFinal : null);
  const correuFinal = fin.resultado.length > 0;
  const classificacao = fin.resultado.map((l) => ({
    pos: l.pos_oficial, piloto: l.piloto,
    grupo: classificados.find((c) => c.piloto === l.piloto)?.grupo || null,
    baterias: classificados.find((c) => c.piloto === l.piloto)?.total ?? null,
  }));
  out.final = {
    grid: (fin.grid || []).map((p, i) => ({ largada: i + 1, piloto: p, grupo: classificados.find((l) => l.piloto === p)?.grupo || null,
      total: classificados.find((l) => l.piloto === p)?.total ?? null })),
    grid_pela_tomada: !!gridTomada,
    definido,
    classificacao,
    podio: classificacao.slice(0, 3).map((l) => ({ pos: l.pos, piloto: l.piloto })),
    campeao: fin.status === 'homologado' && correuFinal ? classificacao[0]?.piloto || null : null,
  };

  const melhor = voltasDoDia.slice().sort((a, b) => a.mv_ms - b.mv_ms)[0];
  out.melhor_volta_do_dia = melhor ? { ...melhor, volta: msParaVolta(melhor.mv_ms) } : null;

  // sessão em curso = a primeira, na ordem do dia, que não está homologada
  out.em_curso = SESSOES.find((d) => out.sessoes[d.codigo].status !== 'homologado')?.codigo || null;
  out.karts = kartDe;
  return out;
}

// Validação do que entra pela API: nome de piloto tem que existir no cadastro do dia.
export function validarSessao(linhas, pilotos) {
  const nomes = new Set(pilotos.map((p) => p.nome));
  const erros = [];
  const vistos = new Set();
  (linhas || []).forEach((l, i) => {
    if (!nomes.has(l.piloto)) erros.push(`linha ${i + 1}: piloto "${l.piloto}" não está na lista do dia`);
    if (vistos.has(l.piloto)) erros.push(`linha ${i + 1}: "${l.piloto}" repetido`);
    vistos.add(l.piloto);
    if (!l.ausente && !(Number.isInteger(l.pos) && l.pos >= 1)) erros.push(`linha ${i + 1}: posição inválida`);
    if (l.mv != null && l.mv !== '' && tempoParaMs(l.mv) == null) erros.push(`linha ${i + 1}: melhor volta "${l.mv}" ilegível`);
  });
  const pos = (linhas || []).filter((l) => !l.ausente).map((l) => l.pos);
  if (new Set(pos).size !== pos.length) erros.push('posição repetida na folha');
  return erros;
}
