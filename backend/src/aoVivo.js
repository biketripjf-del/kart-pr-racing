// Quadro AO VIVO do dia de corrida (formato da 3ª Copa, 23/10/2026).
// Funções PURAS: recebem o estado gravado (pilotos + folhas de cada sessão) e devolvem o quadro
// calculado — pontos, grids, corte de 7 por grupo, grid e pódio da final. Nada aqui toca o banco.
//
// Regulamento que isto implementa (texto do Brunner, 14/10/2026):
//  - 2 grupos de 14 (A e B). Cada grupo: tomada de tempo + 2 baterias.
//  - Grid da Bateria 1 = ordem da tomada de tempo (atrasado pro briefing larga em último).
//  - Grid da Bateria 2 = resultado da Bateria 1 INVERTIDO.
//  - Pontos por bateria: 1º = 14 … 14º = 1. Perdeu a bateria = pontua como 14º.
//  - Ranking do grupo = soma das 2 baterias; desempate = melhor volta nas baterias; persistindo, sorteio.
//  - Top-7 de cada grupo vão pra FINAL. Grid da final = pontos (empate: melhor volta do dia).
//  - Punição do árbitro: 3 posições no resultado; reincidência de largada queimada = fim de fila.

export const SESSOES = [
  { codigo: 'CLASS_A', nome: 'Tomada de tempo · Grupo A', curto: 'Classif. A', grupo: 'A', tipo: 'classificacao' },
  { codigo: 'B1_A', nome: 'Bateria 1 · Grupo A', curto: 'Bateria 1-A', grupo: 'A', tipo: 'bateria', n: 1 },
  { codigo: 'CLASS_B', nome: 'Tomada de tempo · Grupo B', curto: 'Classif. B', grupo: 'B', tipo: 'classificacao' },
  { codigo: 'B1_B', nome: 'Bateria 1 · Grupo B', curto: 'Bateria 1-B', grupo: 'B', tipo: 'bateria', n: 1 },
  { codigo: 'B2_A', nome: 'Bateria 2 · Grupo A', curto: 'Bateria 2-A', grupo: 'A', tipo: 'bateria', n: 2 },
  { codigo: 'B2_B', nome: 'Bateria 2 · Grupo B', curto: 'Bateria 2-B', grupo: 'B', tipo: 'bateria', n: 2 },
  { codigo: 'FINAL', nome: 'GRANDE FINAL', curto: 'Final', grupo: null, tipo: 'final' },
];
export const STATUS = ['aguardando', 'ao_vivo', 'provisorio', 'homologado'];
export const VAGAS_FINAL_POR_GRUPO = 7;
export const POSICAO_DE_QUEM_FALTA = 14;
const PUNICAO_PADRAO = 3;

export const pontosDaPosicao = (pos) => Math.max(1, 15 - pos);

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
const temFolha = (s) => s && Array.isArray(s.linhas) && s.linhas.length > 0;

// ---------- quadro completo ----------
export function calcularQuadro(estado) {
  const pilotos = estado.pilotos || [];
  const sessoes = estado.sessoes || {};
  const doGrupo = (g) => pilotos.filter((p) => p.grupo === g).map((p) => p.nome);
  const atrasados = new Set(pilotos.filter((p) => p.atrasado).map((p) => p.nome));
  const kartDe = {};

  const out = { sessoes: {}, grupos: {}, final: null, melhor_volta_do_dia: null, avisos: [] };
  const voltasDoDia = []; // { piloto, mv_ms, sessao }

  for (const def of SESSOES) {
    const s = sessoes[def.codigo] || {};
    const pilotosSessao = def.grupo ? doGrupo(def.grupo) : [];
    const status = s.status || (temFolha(s) ? 'provisorio' : 'aguardando');
    const resultado = temFolha(s)
      ? resultadoDaSessao(s.linhas, pilotosSessao, { contarAusentes: def.tipo === 'bateria' })
      : [];
    for (const l of resultado) {
      if (l.mv_ms != null) voltasDoDia.push({ piloto: l.piloto, mv_ms: l.mv_ms, sessao: def.codigo });
      if (l.kart != null) (kartDe[l.piloto] ||= {})[def.codigo] = l.kart;
      if (def.tipo === 'bateria') l.pontos = pontosDaPosicao(l.pos_oficial);
    }
    out.sessoes[def.codigo] = {
      ...def, status, atualizado_em: s.atualizado_em || null, foto: s.foto || null,
      observacoes: s.observacoes || null, resultado, grid: null,
    };
  }

  for (const g of ['A', 'B']) {
    const nomes = doGrupo(g);
    const cls = out.sessoes[`CLASS_${g}`];
    const b1 = out.sessoes[`B1_${g}`];
    const b2 = out.sessoes[`B2_${g}`];

    // grid da Bateria 1: ordem da tomada de tempo; atrasado e quem não marcou tempo vão pro fim
    if (cls.resultado.length) {
      const pela = cls.resultado.map((l) => l.piloto).filter((n) => !atrasados.has(n));
      const resto = nomes.filter((n) => !pela.includes(n) && !atrasados.has(n));
      b1.grid = [...pela, ...resto, ...nomes.filter((n) => atrasados.has(n))];
    }
    // grid da Bateria 2: resultado oficial da 1 invertido
    if (b1.resultado.length) b2.grid = b1.resultado.map((l) => l.piloto).reverse();

    const linha = (nome) => {
      const r1 = b1.resultado.find((l) => l.piloto === nome);
      const r2 = b2.resultado.find((l) => l.piloto === nome);
      const mvBaterias = menorVolta(r1?.mv_ms, r2?.mv_ms);
      return {
        piloto: nome,
        cabeca: pilotos.find((p) => p.nome === nome)?.cabeca || null,
        b1: r1 ? { pos: r1.ausente ? null : r1.pos_oficial, pontos: r1.pontos, ausente: !!r1.ausente } : null,
        b2: r2 ? { pos: r2.ausente ? null : r2.pos_oficial, pontos: r2.pontos, ausente: !!r2.ausente } : null,
        total: (r1?.pontos || 0) + (r2?.pontos || 0),
        mv_baterias_ms: mvBaterias,
      };
    };
    const tabela = nomes.map(linha).sort((a, b) =>
      b.total - a.total || (a.mv_baterias_ms ?? Infinity) - (b.mv_baterias_ms ?? Infinity));
    tabela.forEach((l, i) => {
      l.pos = i + 1;
      const viz = tabela[i + 1];
      if (viz && viz.total === l.total && viz.mv_baterias_ms === l.mv_baterias_ms && l.total > 0) {
        l.empate_sorteio = viz.empate_sorteio = true;
      }
    });
    const correu = b1.resultado.length > 0;
    const fechado = b2.status === 'homologado';
    for (const l of tabela) l.vai_pra_final = correu && l.pos <= VAGAS_FINAL_POR_GRUPO;
    const corte = tabela[VAGAS_FINAL_POR_GRUPO - 1];
    if (corte?.empate_sorteio && tabela[VAGAS_FINAL_POR_GRUPO]?.empate_sorteio) {
      out.avisos.push(`Grupo ${g}: empate EXATO na 7ª vaga (pontos e melhor volta) — sorteio.`);
    }
    out.grupos[g] = { pilotos: nomes, tabela, definido: fechado, parcial: correu && !fechado };
  }

  // ---------- final ----------
  const fin = out.sessoes.FINAL;
  const mvDoDia = (nome) => menorVolta(...voltasDoDia.filter((v) => v.piloto === nome).map((v) => v.mv_ms));
  const classificados = ['A', 'B'].flatMap((g) =>
    out.grupos[g].tabela.filter((l) => l.vai_pra_final).map((l) => ({ ...l, grupo: g })));
  const gridFinal = classificados.slice().sort((a, b) =>
    b.total - a.total || (mvDoDia(a.piloto) ?? Infinity) - (mvDoDia(b.piloto) ?? Infinity))
    .map((l, i) => ({ largada: i + 1, piloto: l.piloto, grupo: l.grupo, total: l.total, mv_dia_ms: mvDoDia(l.piloto) }));
  fin.grid = gridFinal.length ? gridFinal.map((l) => l.piloto) : null;
  out.final = {
    grid: gridFinal,
    definido: out.grupos.A.definido && out.grupos.B.definido,
    podio: fin.resultado.slice(0, 3).map((l) => ({ pos: l.pos_oficial, piloto: l.piloto, mv_ms: l.mv_ms })),
    campeao: fin.status === 'homologado' ? fin.resultado[0]?.piloto || null : null,
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
