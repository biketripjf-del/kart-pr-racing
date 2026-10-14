// Sorteio dos grupos A e B AO VIVO (pedido do Brunner 14/10/2026: "quero o sorteio das chaves aut igual ao pedal").
// Desenho herdado do sorteio de equipes do Pedal da Madrugada: semente gravada (qualquer um refaz e chega no mesmo
// resultado), 1 nome a cada 5 s, ninguém precisa clicar. Diferença: aqui a revelação é função do RELÓGIO
// (revelados = tempo desde o início / passo), então não existe "passo perdido" nem laço que dorme demais
// (o show do Pedal de 01/10 saiu a 12 s por nome por causa do laço).
// Funções PURAS — o banco entra como fotografia.
import { normalizar } from './aoVivo.js';

export const PASSO_MS = 5000;
export const RESPIRO_MS = 4000; // o último nome termina de animar antes de gravar os grupos
export const GRUPOS = ['A', 'B'];

// PRNG determinístico (mulberry32) semeado por hash da string — o mesmo do Pedal.
export function prng(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function embaralhar(lista, rnd) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Ordem alfabética antes de embaralhar: a ordem em que os nomes foram cadastrados não muda o resultado.
const alfabetica = (nomes) => [...nomes].sort((x, y) => normalizar(x).localeCompare(normalizar(y)));

// Ordem da revelação. Cabeças de chave (se houver) saem primeiro, alternando A/B; depois o resto, com a
// alternância continuando de onde os cabeças pararam — os dois grupos fecham com o mesmo tamanho.
export function montarOrdem(participantes, semente, cabecas = []) {
  const rnd = prng(semente);
  const setCab = new Set(cabecas);
  const cab = embaralhar(alfabetica(participantes.filter((n) => setCab.has(n))), rnd);
  const resto = embaralhar(alfabetica(participantes.filter((n) => !setCab.has(n))), rnd);
  // alternar pelo índice já fecha os grupos com no máximo 1 de diferença (28 → 14/14, 27 → 14/13)
  return [...cab, ...resto].map((nome, i) => ({ nome, grupo: GRUPOS[i % 2], cabeca: setCab.has(nome) }));
}

// Fotografia do sorteio num instante. s = linha da tabela sorteios (ms já convertidos).
// Devolve o que a tela pode mostrar — os nomes AINDA NÃO revelados nunca saem daqui.
export function fotografia(s, agoraMs) {
  if (!s) return null;
  const total = s.ordem ? s.ordem.length : (s.participantes || []).length;
  const base = {
    id: s.id, evento: s.evento, status: s.status, agendado_para: s.agendado_para, passo_ms: s.passo_ms,
    agora: new Date(agoraMs).toISOString(), total, cabecas: s.cabecas || [],
  };
  if (s.status === 'cancelado') return { ...base, fase: 'cancelado', revelados: [] };
  if (!s.ordem || s.iniciadoMs == null) {
    return { ...base, fase: 'contagem', revelados: [], faltam_ms: Math.max(0, s.agendadoMs - agoraMs) };
  }
  const n = Math.max(0, Math.min(s.ordem.length, Math.floor((agoraMs - s.iniciadoMs) / s.passo_ms)));
  const revelados = s.ordem.slice(0, n).map((o, i) => ({ ...o, n: i + 1 }));
  const fimMs = s.iniciadoMs + s.ordem.length * s.passo_ms;
  const acabou = n >= s.ordem.length;
  return {
    ...base,
    fase: acabou ? (s.status === 'concluido' ? 'concluido' : 'fechando') : 'revelando',
    iniciado_em: new Date(s.iniciadoMs).toISOString(),
    proximo_em: acabou ? null : new Date(s.iniciadoMs + (n + 1) * s.passo_ms).toISOString(),
    termina_em: new Date(fimMs).toISOString(),
    revelados,
    // a semente só aparece quando não há mais nada a esconder: aí qualquer um confere
    semente: acabou ? s.semente : null,
    participantes: acabou ? s.participantes : null,
  };
}

// O que o servidor precisa fazer agora: 'comecar' | 'concluir' | 'aplicar' | 'nada'.
export function decidir(s, agoraMs, respiroMs = RESPIRO_MS) {
  if (!s || s.status === 'cancelado') return 'nada';
  if (s.status === 'concluido') return s.aplicado ? 'nada' : 'aplicar';
  if (!s.ordem) return agoraMs >= s.agendadoMs ? 'comecar' : 'nada';
  const fimMs = s.iniciadoMs + s.ordem.length * s.passo_ms;
  return agoraMs >= fimMs + respiroMs ? 'concluir' : 'nada';
}

// Grava os grupos no estado do evento (todos os pilotos do sorteio recebem grupo; quem não estava fica como estava).
export function aplicarGrupos(estado, ordem) {
  const grupoDe = new Map(ordem.map((o) => [o.nome, o]));
  return {
    ...estado,
    pilotos: (estado.pilotos || []).map((p) => (grupoDe.has(p.nome)
      ? { ...p, grupo: grupoDe.get(p.nome).grupo, cabeca: grupoDe.get(p.nome).cabeca ? true : null }
      : p)),
  };
}
