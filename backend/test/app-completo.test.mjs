// node --test backend/test/app-completo.test.mjs — sorteio ao vivo, histórico, ranking e números do piloto.
import test from 'node:test';
import assert from 'node:assert/strict';
import { montarOrdem, fotografia, decidir, aplicarGrupos, PASSO_MS } from '../src/sorteio.js';
import { participacoesDoEvento, classificacaoDoEvento, rankingCampeonato, numerosDoPiloto, rankingRitmo, recordesPorTracado, rivaisDoPiloto, pontosDaPosicao } from '../src/historico.js';

const NOMES = Array.from({ length: 28 }, (_, i) => `Piloto ${String(i + 1).padStart(2, '0')}`);

// ---------- sorteio ----------
const porBloco = (o) => ['W', 'X', 'Y', 'Z'].map((g) => o.filter((x) => x.grupo === g).length);

test('sorteio: 4 blocos de 7 (W, X, Y, Z), todos os nomes uma vez só', () => {
  const o = montarOrdem(NOMES, 'semente-x');
  assert.equal(o.length, 28);
  assert.equal(new Set(o.map((x) => x.nome)).size, 28);
  assert.deepEqual(porBloco(o), [7, 7, 7, 7]);
});

test('sorteio: mesma semente = mesmo resultado, qualquer que seja a ordem do cadastro', () => {
  const a = montarOrdem(NOMES, 'semente-x');
  const b = montarOrdem([...NOMES].reverse(), 'semente-x');
  assert.deepEqual(a, b);
  const c = montarOrdem(NOMES, 'outra-semente');
  assert.notDeepEqual(a.map((x) => x.nome), c.map((x) => x.nome));
});

test('sorteio: embaralha de verdade (não é a ordem alfabética)', () => {
  const o = montarOrdem(NOMES, 'semente-x');
  assert.notDeepEqual(o.map((x) => x.nome), NOMES);
});

test('sorteio: cabeças de chave saem primeiro, um em cada bloco', () => {
  const cab = ['Piloto 01', 'Piloto 02', 'Piloto 03', 'Piloto 04'];
  const o = montarOrdem(NOMES, 's', cab);
  assert.deepEqual(new Set(o.slice(0, 4).map((x) => x.nome)), new Set(cab));
  assert.deepEqual(porBloco(o.slice(0, 4)), [1, 1, 1, 1]);
  assert.deepEqual(porBloco(o), [7, 7, 7, 7]);
  assert.deepEqual(montarOrdem([...NOMES].reverse(), 's', [...cab].reverse()), o, 'ordem do cadastro não muda o sorteio dos cabeças');
});

test('sorteio: 27 fecha 7/7/7/6; 3 cabeças também fecham 7 em cada', () => {
  const o = montarOrdem(NOMES.slice(0, 27), 's');
  assert.deepEqual(porBloco(o), [7, 7, 7, 6]);
  const c = montarOrdem(NOMES, 's', NOMES.slice(0, 3));
  assert.deepEqual(porBloco(c), [7, 7, 7, 7]);
});

const T0 = Date.parse('2026-10-20T23:00:00Z');
const agendado = { id: 1, evento: 'copa-3', status: 'agendado', passo_ms: PASSO_MS, agendadoMs: T0, agendado_para: new Date(T0).toISOString(), participantes: null, ordem: null, aplicado: false };

test('sorteio: antes da hora = contagem e NENHUM nome', () => {
  const f = fotografia(agendado, T0 - 60000);
  assert.equal(f.fase, 'contagem');
  assert.equal(f.revelados.length, 0);
  assert.equal(f.faltam_ms, 60000);
  assert.equal(decidir(agendado, T0 - 1), 'nada');
  assert.equal(decidir(agendado, T0), 'comecar');
});

test('sorteio: revela 1 nome a cada passo e NUNCA mostra o próximo antes da hora', () => {
  const ordem = montarOrdem(NOMES, 's');
  const s = { ...agendado, ordem, participantes: NOMES, semente: 's', iniciadoMs: T0 };
  assert.equal(fotografia(s, T0 + PASSO_MS - 1).revelados.length, 0);
  assert.equal(fotografia(s, T0 + PASSO_MS).revelados.length, 1);
  const f = fotografia(s, T0 + 3 * PASSO_MS + 10);
  assert.equal(f.revelados.length, 3);
  assert.deepEqual(f.revelados.map((r) => r.nome), ordem.slice(0, 3).map((o) => o.nome));
  assert.equal(f.semente, null, 'semente escondida enquanto falta nome');
  assert.equal(f.participantes, null);
  for (const o of ordem.slice(3)) assert.ok(!JSON.stringify(f).includes(o.nome), `${o.nome} vazou antes da hora`);
});

test('sorteio: depois do último nome mostra a semente; conclui só depois do respiro', () => {
  const ordem = montarOrdem(NOMES, 's');
  const s = { ...agendado, ordem, participantes: NOMES, semente: 's', iniciadoMs: T0 };
  const fim = T0 + 28 * PASSO_MS;
  const f = fotografia(s, fim);
  assert.equal(f.revelados.length, 28);
  assert.equal(f.semente, 's');
  assert.equal(f.fase, 'fechando');
  assert.equal(decidir(s, fim), 'nada');
  assert.equal(decidir(s, fim + 4000), 'concluir');
  assert.equal(decidir({ ...s, status: 'concluido', aplicado: false }, fim + 9000), 'aplicar');
  assert.equal(decidir({ ...s, status: 'concluido', aplicado: true }, fim + 9000), 'nada');
  assert.equal(decidir({ ...s, status: 'cancelado' }, fim + 9000), 'nada');
});

test('sorteio: grava os blocos no evento sem mexer no resto', () => {
  const estado = { titulo: 'X', pilotos: [{ nome: 'Piloto 01', grupo: null, piloto_id: 7 }, { nome: 'Fora', grupo: 'W' }] };
  const novo = aplicarGrupos(estado, [{ nome: 'Piloto 01', grupo: 'Y', cabeca: false }]);
  assert.deepEqual(novo.pilotos[0], { nome: 'Piloto 01', grupo: 'Y', piloto_id: 7, cabeca: null });
  assert.deepEqual(novo.pilotos[1], { nome: 'Fora', grupo: 'W' });
  assert.equal(novo.titulo, 'X');
});

// ---------- histórico ----------
const linhas = (nomes, base = 48000) => nomes.map((piloto, i) => ({ piloto, pos: i + 1, kart: i + 1, mv: base + i * 100, voltas: 18 }));

const P = (n) => `P${n}`;
// evento formato 'corridas' (como 17/07): 4 corridas, cada piloto em 2
const ev17 = (corridas) => ({
  slug: 'corridas-17-07', estado: {
    titulo: '17/07', data: '2026-07-17', formato: 'corridas', corridas_previstas: 4, corridas_por_piloto: 2,
    pilotos: [1, 2, 3, 4].map((n) => ({ nome: P(n), piloto_id: n })),
    corridas,
  },
});
const C1 = { codigo: 'C1', nome: '1ª corrida', hora: '15:00', tracado: 'invertido', linhas: linhas([P(1), P(2)]) };
const C2 = { codigo: 'C2', nome: '2ª corrida', hora: '15:30', tracado: 'invertido', linhas: linhas([P(3), P(4)]) };
const C3 = { codigo: 'C3', nome: '3ª corrida', hora: '16:00', tracado: '6,5 HP', linhas: linhas([P(2), P(1)], 47000) };
const C4 = { codigo: 'C4', nome: '4ª corrida', hora: '16:30', tracado: '6,5 HP', linhas: linhas([P(4), P(3)]) };

test('histórico: participações saem das folhas, com o id do cadastro', () => {
  const ps = participacoesDoEvento(ev17([C1, C2]));
  assert.equal(ps.length, 4);
  assert.deepEqual(ps[0], {
    evento: 'corridas-17-07', titulo: '17/07', data: '2026-07-17', sessao: 'C1', sessao_nome: '1ª corrida', tipo: 'corrida',
    tracado: 'invertido', hora: '15:00', n_pilotos: 2, piloto: 'P1', piloto_id: 1, chave: 'id:1', pos: 1, ausente: false,
    kart: 1, mv_ms: 48000, voltas: 18, ritmo: null,
  });
});

test('histórico: evento completo = soma das posições, menor vence; desempate pela melhor volta', () => {
  const c = classificacaoDoEvento(ev17([C1, C2, C3, C4]));
  assert.equal(c.completa, true);
  // P1: 1+2=3 (mv 47100) · P2: 2+1=3 (mv 47000) · P3: 1+2=3 (48000) · P4: 2+1=3 (48000)
  assert.equal(c.linhas[0].piloto, 'P2', 'empate em 3 pontos: melhor volta decide');
  assert.equal(c.linhas[1].piloto, 'P1');
  assert.ok(c.linhas.every((l) => l.pontos === 3));
});

test('histórico: completo, quem correu só 1 das 2 leva 14 na que faltou', () => {
  const c = classificacaoDoEvento(ev17([C1, C2, C3, { ...C4, linhas: linhas([P(4)]) }]));
  const p3 = c.linhas.find((l) => l.piloto === 'P3');
  assert.equal(p3.pontos, 1 + 14);
  assert.equal(c.linhas.at(-1).piloto, 'P3');
});

test('histórico: faltando folha, NÃO aplica os 14 — ordena pela média e marca parcial', () => {
  const c = classificacaoDoEvento(ev17([C1, C2, C3]));
  assert.equal(c.completa, false);
  assert.match(c.criterio, /3 de 4/);
  const p3 = c.linhas.find((l) => l.piloto === 'P3');
  assert.equal(p3.pontos, 1, 'sem a 4ª folha, P3 não pode levar 14');
  assert.equal(c.linhas[0].media, 1);
});

// evento formato copa3 (3ª Copa, opção A: 4 blocos de 7). id = 100 × (bloco 1–4) + posição no bloco
const bloco = (g) => Array.from({ length: 7 }, (_, i) => `${g}${i + 1}`);
const [W, X, Y, Z] = ['W', 'X', 'Y', 'Z'].map(bloco);
const copa = (sessoes) => ({
  slug: 'copa-3', estado: {
    titulo: '3ª Copa', data: '2026-10-23',
    pilotos: [W, X, Y, Z].flatMap((ns, k) => ns.map((n, i) => ({ nome: n, grupo: 'WXYZ'[k], piloto_id: 100 * (k + 1) + i }))),
    sessoes,
  },
});
const homolog = (l) => ({ linhas: l, status: 'homologado' });

test('histórico: na copa, a FINAL ordena o topo e o resto segue a soma das baterias', () => {
  // somas: Y_i = 2i · W_i = X_i = 7 + 2i · Z_i = 14 + 2i → top-14 = Y1–Y7, W1–W3, X1–X3 e X4 (melhor volta na bateria 4)
  const sess = {
    B1_WX: homolog(linhas([...W, ...X])), B2_YZ: homolog(linhas([...Y, ...Z])),
    B3_WY: homolog(linhas([...Y, ...W])), B4_XZ: homolog(linhas([...X, ...Z], 47000)),
  };
  // Final: X4 (o 14º das baterias) vence; Y1, o melhor das baterias, chega em 2º
  const finalistas = ['X4', 'Y1', 'W1', 'X1', 'Y2', 'Y3', 'W2', 'X2', 'Y4', 'Y5', 'W3', 'X3', 'Y6', 'Y7'];
  const c = classificacaoDoEvento(copa({ ...sess, FINAL: homolog(linhas(finalistas)) }));
  assert.equal(c.completa, true);
  assert.equal(c.campeao, 'X4');
  assert.deepEqual(c.linhas.slice(0, 3).map((l) => l.piloto), ['X4', 'Y1', 'W1']);
  assert.equal(c.linhas.length, 28);
  assert.equal(c.linhas[14].na_final, false);
  assert.equal(c.linhas[14].piloto, 'W4', 'o 1º de fora da final é o W4, que perdeu a 14ª vaga na melhor volta');
  assert.equal(c.linhas[14].pos, 15);
  const campeao = numerosDoPiloto([copa({ ...sess, FINAL: homolog(linhas(finalistas)) })], 'id:203');
  assert.equal(campeao.titulos, 1, 'X4 (id 203) venceu a final = 1 título');
  assert.equal(campeao.finais, 1);
  assert.equal(numerosDoPiloto([copa({ ...sess, FINAL: homolog(linhas(finalistas)) })], 'id:300').titulos, 0, 'Y1 venceu as baterias, mas não a final');
});

test('ranking F1 (19/10): 25-18-15-12-10-8-6-4-2-1, 11º em diante 1; avulsa vale metade; falta = 0; mais pontos vence', () => {
  assert.deepEqual([1, 2, 3, 10, 11, 28].map((p) => pontosDaPosicao(p)), [25, 18, 15, 1, 1, 1]);
  assert.equal(pontosDaPosicao(1, 0.5), 12.5);
  assert.equal(pontosDaPosicao(15, 0.5), 0.5, 'avulsa: do 11º em diante leva 0,5');
  const e1 = ev17([C1, C2, C3, C4]); // avulsa (sem copa): P2 1º, P1 2º, P3/P4
  const e2 = { slug: 'e2', estado: { titulo: 'E2', data: '2026-10-23', formato: 'corridas', copa: true, corridas_previstas: 1, pilotos: [{ nome: 'P1', piloto_id: 1 }, { nome: 'Novo', piloto_id: 9 }], corridas: [{ codigo: 'X', nome: 'X', linhas: linhas(['Novo', 'P1']) }] } };
  const teste = { slug: 't', estado: { ...e2.estado, teste: true, titulo: 'T' } };
  const r = rankingCampeonato([e2, teste, e1]);
  assert.deepEqual(r.eventos.map((e) => e.slug), ['corridas-17-07', 'e2'], 'em ordem de data, sem o teste');
  assert.deepEqual(r.eventos.map((e) => e.avulsa), [true, false]);
  const de = (id) => r.tabela.find((l) => l.piloto_id === id);
  assert.equal(de(1).total, 9 + 18, 'P1: 2º na avulsa (18 ÷ 2) + 2º na Copa');
  assert.equal(de(9).total, 0 + 25, 'Novo faltou à avulsa (0, sem punição) + venceu a Copa');
  assert.equal(de(2).total, 12.5, 'P2 venceu a avulsa (25 ÷ 2) e faltou à Copa (0)');
  assert.deepEqual(r.tabela.slice(0, 3).map((l) => l.piloto_id), [1, 9, 2], 'mais pontos na frente');
  assert.deepEqual(de(2).colunas.map((c) => c.pontos), [12.5, 0]);
  // empate em pontos: desempata a melhor colocação
  const a = { slug: 'a', estado: { titulo: 'A', data: '2026-01-01', formato: 'corridas', copa: true, corridas_previstas: 1, pilotos: [{ nome: 'P1', piloto_id: 1 }, { nome: 'P2', piloto_id: 2 }], corridas: [{ codigo: 'X', nome: 'X', linhas: linhas(['P1', 'P2']) }] } };
  const bb = { slug: 'b', estado: { ...a.estado, data: '2026-02-01', corridas: [{ codigo: 'X', nome: 'X', linhas: linhas(['P2', 'P1']) }] } };
  const emp = rankingCampeonato([a, bb]);
  assert.equal(emp.tabela[0].total, emp.tabela[1].total, '43 a 43');
});

test('ranking por temporada (19/10): padrão = o ano mais recente; ?ano=2024 só aquele ano; todos = a história; nome de todos os anos', () => {
  const copaDe = (slug, data, ordem, nomes = {}) => ({ slug, estado: { titulo: slug, data, formato: 'corridas', copa: true, corridas_previstas: 1,
    pilotos: [1, 2, 3].map((n) => ({ nome: nomes[n] || P(n), piloto_id: n })), corridas: [{ codigo: 'X', nome: 'X', linhas: linhas(ordem.map((n) => nomes[n] || P(n))) }] } });
  const evs = [copaDe('c2020', '2020-12-22', [3, 1], { 3: 'Velho' }), copaDe('c2024', '2024-12-13', [1, 2]), copaDe('c2026', '2026-10-23', [2, 1, 3])];
  const r = rankingCampeonato(evs);
  assert.equal(r.ano, '2026');
  assert.deepEqual(r.anos, ['2026', '2024', '2020']);
  assert.deepEqual(r.eventos.map((e) => e.slug), ['c2026'], 'padrão: só a temporada atual');
  assert.deepEqual(r.tabela.map((l) => [l.piloto_id, l.total]), [[2, 25], [1, 18], [3, 15]]);
  const r24 = rankingCampeonato(evs, { ano: '2024' });
  assert.deepEqual(r24.tabela.map((l) => [l.piloto_id, l.total]), [[1, 25], [2, 18]], 'P3 não correu em 2024: fora da tabela do ano');
  const h = rankingCampeonato(evs, { ano: 'todos' });
  assert.equal(h.ano, 'todos');
  assert.equal(h.eventos.length, 3);
  assert.deepEqual(h.tabela.find((l) => l.piloto_id === 1).total, 18 + 25 + 18, 'história: P1 em 2020, 2024 e 2026');
  const r20 = rankingCampeonato(evs, { ano: '2020' });
  assert.equal(r20.tabela[0].piloto, P(3), 'quem corria como "Velho" em 2020 aparece com o nome de agora');
  assert.equal(rankingCampeonato(evs, { ano: '1999' }).ano, '2026', 'ano sem corrida cai no atual');
});

test('títulos: edição da Copa no formato corridas dá título ao 1º; corridas avulsas (17/07) não', () => {
  const avulso = ev17([C1, C2, C3, C4]);
  assert.equal(classificacaoDoEvento(avulso).campeao, null, '17/07 não foi Copa');
  assert.equal(numerosDoPiloto([avulso], 'id:2').titulos, 0);
  const copa = { slug: 'copa-2', estado: { ...avulso.estado, copa: true } };
  assert.equal(classificacaoDoEvento(copa).campeao, 'P2');
  assert.equal(numerosDoPiloto([copa], 'id:2').titulos, 1);
  assert.equal(numerosDoPiloto([copa], 'id:1').titulos, 0, 'só o 1º leva título');
  const parcial = { slug: 'copa-x', estado: { ...copa.estado, corridas: [C1, C2] } };
  assert.equal(classificacaoDoEvento(parcial).campeao, null, 'Copa sem todas as folhas ainda não tem campeão');
  // campeão oficial informado pela organização vence a soma (2ª Copa, 19/10); o resto segue a soma
  const pelaSoma = classificacaoDoEvento(copa).linhas.map((l) => l.piloto);
  const of = { slug: 'copa-2', estado: { ...copa.estado, campeao_oficial: pelaSoma[2] } };
  const c = classificacaoDoEvento(of);
  assert.equal(c.campeao, pelaSoma[2]);
  assert.deepEqual(c.linhas.map((l) => l.piloto), [pelaSoma[2], pelaSoma[0], pelaSoma[1], ...pelaSoma.slice(3)]);
  assert.deepEqual(c.linhas.map((l) => l.pos), pelaSoma.map((_, i) => i + 1));
  assert.match(c.criterio, /oficial/);
  const idOf = c.linhas[0].piloto_id;
  assert.equal(numerosDoPiloto([of], `id:${idOf}`).titulos, 1, 'o campeão oficial leva o título');
  assert.equal(numerosDoPiloto([of], 'id:2').titulos, 0, 'o 1º da soma perde o título');
  assert.equal(classificacaoDoEvento({ slug: 'copa-x', estado: { ...parcial.estado, campeao_oficial: pelaSoma[2] } }).campeao, null, 'parcial segue sem campeão');
});

// ---------- ritmo, recordes, rivais (GO 19/10/2026) ----------
const evR = (slug, data, corridas, extra = {}) => ({
  slug, estado: { titulo: slug, data, formato: 'corridas', corridas_previstas: corridas.length,
    pilotos: [1, 2, 3, 4].map((n) => ({ nome: P(n), piloto_id: n })), corridas, ...extra },
});
const L = (pares) => pares.map(([n, mv], i) => ({ piloto: P(n), pos: i + 1, mv, voltas: 18 }));
// R1 (6,5 HP): P1 48.000 · P2 48.480 (+1%) · P3 49.440 (+3%) · R2 (6,5 HP): P2 47.500 · P1 47.975 (+1%) · P4 48.450 (+2%)
const R1 = { codigo: 'R1', nome: 'R1', tracado: '6,5 HP', linhas: L([[1, 48000], [2, 48480], [3, 49440]]) };
const R2 = { codigo: 'R2', nome: 'R2', tracado: '6,5 HP', linhas: L([[2, 47500], [1, 47975], [4, 48450]]) };
// R3: traçado diferente, a volta mais rápida de todas (46.000) — não pode virar recorde do 6,5 HP
const R3 = { codigo: 'R3', nome: 'R3', tracado: 'invertido', linhas: L([[3, 46000], [1, 46460], [2, 47000]]) };

test('ritmo: melhor volta ÷ melhor da corrida × 100; corrida com menos de 3 voltas não mede', () => {
  const ps = participacoesDoEvento(evR('e', '2026-01-01', [R1]));
  assert.deepEqual(ps.map((p) => p.ritmo), [100, 101, 103]);
  const curto = participacoesDoEvento(evR('e', '2026-01-01', [{ ...R1, linhas: L([[1, 48000], [2, 48480]]) }]));
  assert.ok(curto.every((p) => p.ritmo === null), '2 pilotos não dão régua');
});

test('ranking de ritmo: média de todas as corridas, menor = mais rápido', () => {
  const r = rankingRitmo([evR('a', '2024-01-01', [R1]), evR('b', '2026-01-01', [R2])]);
  const de = (n) => r.tabela.find((l) => l.piloto_id === n);
  assert.equal(de(1).ritmo, 100.5, 'P1: 100 e 101');
  assert.equal(de(2).ritmo, 100.5, 'P2: 101 e 100');
  assert.equal(de(1).vezes_mais_rapido, 1);
  assert.equal(de(4).ritmo, 102);
  assert.equal(r.tabela[r.tabela.length - 1].piloto_id, 3, 'P3 (103) por último');
  assert.equal(rankingRitmo([{ ...evR('t', '2026-01-01', [R1]), estado: { ...evR('t', '2026-01-01', [R1]).estado, teste: true } }]).tabela.length, 0, 'teste não entra');
});

test('recordes: por traçado, top 3 de pilotos diferentes; traçado diferente não se mistura', () => {
  const rec = recordesPorTracado([evR('a', '2024-01-01', [R1, R3]), evR('b', '2026-01-01', [R2])]);
  const hp = rec.find((x) => x.tracado === '6,5 HP');
  assert.equal(hp.recorde.piloto, 'P2');
  assert.equal(hp.recorde.mv_ms, 47500, 'o 46.000 do invertido não entra aqui');
  assert.deepEqual(hp.top.map((x) => x.piloto), ['P2', 'P1', 'P4'], 'P1 aparece uma vez só (a melhor dele)');
  assert.equal(rec.find((x) => x.tracado === 'invertido').recorde.mv_ms, 46000);
  const caixa = recordesPorTracado([evR('a', '2024-01-01', [R1]), evR('b', '2026-01-01', [{ ...R2, tracado: '6,5 hp' }])]);
  assert.equal(caixa.length, 1, 'maiúscula/minúscula não cria traçado novo');
  assert.equal(caixa[0].recorde.mv_ms, 47500);
  const semTracado = recordesPorTracado([evR('a', '2024-01-01', [{ ...R3, tracado: undefined }])]);
  assert.equal(semTracado.length, 0, 'corrida sem traçado não vira recorde de traçado nenhum');
  const teste = evR('t', '2026-01-01', [R3]); teste.estado.teste = true;
  assert.equal(recordesPorTracado([teste]).length, 0, 'evento de teste não vira recorde');
  assert.equal(recordesPorTracado([evR('a', '2024-01-01', [R1]), evR('b', '2026-01-01', [R2])], { exceto: 'b' })
    .find((x) => x.tracado === '6,5 HP').recorde.mv_ms, 48000, 'o evento do dia não conta como recorde anterior');
});

test('recordes: todos os pilotos do traçado (não só o top 3) e o nome da folha mais recente', () => {
  const rec = recordesPorTracado([evR('a', '2024-01-01', [R1, R3]), evR('b', '2026-01-01', [R2])]);
  const hp = rec.find((x) => x.tracado === '6,5 HP');
  assert.deepEqual(hp.todos.map((x) => x.piloto), ['P2', 'P1', 'P4', 'P3'], 'o 4º (P3 49.440) também aparece, uma vez cada');
  assert.equal(hp.top.length, 3);
  // 2020: o piloto 1 corria como "Velho" num traçado que só existe naquele ano; hoje a folha diz P1
  const antigo = evR('v', '2020-01-01', [{ codigo: 'V', nome: 'V', tracado: 'Indoor', linhas: [{ piloto: 'Velho', pos: 1, mv: 58000, voltas: 18 }] }]);
  antigo.estado.pilotos = [{ nome: 'Velho', piloto_id: 1 }];
  const indoor = recordesPorTracado([antigo, evR('b', '2026-01-01', [R2])]).find((x) => x.tracado === 'Indoor');
  assert.equal(indoor.recorde.piloto, 'P1', 'nome atual, não o da folha de 2020');
  assert.equal(indoor.recorde.nome_folha, 'Velho');
});

test('rivais: quem chegou na frente nas corridas em comum; ausente não conta', () => {
  const evs = [evR('a', '2024-01-01', [R1, R3]), evR('b', '2026-01-01', [R2])];
  const r = rivaisDoPiloto(evs, 'id:1');
  const vs = (n) => r.find((x) => x.piloto_id === n);
  assert.deepEqual([vs(2).vitorias, vs(2).derrotas, vs(2).encontros], [2, 1, 3], 'P1×P2: R1 ganhou, R2 perdeu, R3 ganhou');
  assert.deepEqual([vs(3).vitorias, vs(3).derrotas], [1, 1]);
  assert.deepEqual([vs(4).vitorias, vs(4).derrotas], [1, 0]);
  assert.equal(r[0].piloto_id, 2, 'quem mais cruzou com ele vem primeiro');
  const comAusente = rivaisDoPiloto([evR('c', '2026-01-01', [{ ...R1, linhas: [...L([[1, 48000], [2, 48480], [3, 49440]]), { piloto: P(4), ausente: true }] }])], 'id:1');
  assert.equal(comAusente.find((x) => x.piloto_id === 4), undefined);
  // formato da 3ª Copa: quem não correu a bateria do bloco entra como ausente — e ausente não é rival vencido
  const copa = { slug: 'c3', estado: { titulo: 'C3', data: '2026-10-23',
    pilotos: [1, 2, 3, 4].map((k) => ({ nome: P(k), piloto_id: k, grupo: k % 2 ? 'W' : 'X' })),
    sessoes: { B1_WX: { linhas: L([[1, 48000], [2, 48480], [3, 49440]]) } } } };
  assert.ok(participacoesDoEvento(copa).some((x) => x.piloto === P(4) && x.ausente), 'P4 entra como ausente no formato da Copa');
  assert.equal(rivaisDoPiloto([copa], 'id:1').find((x) => x.piloto_id === 4), undefined, 'ausente não conta como rival');
  assert.equal(rivaisDoPiloto([copa], 'id:4').length, 0, 'quem faltou não tem confronto');
  const n = numerosDoPiloto(evs, 'id:1');
  assert.equal(n.ritmo_medio, 100.67, 'P1: 100 · 101 · 101 (R3: 46.460 / 46.000 = 101,00)');
  assert.deepEqual(n.ritmo_por_evento.map((e) => [e.evento, e.ritmo]), [['a', 100.5], ['b', 101]]);
});

test('números do piloto: vitórias, pódios, média e melhor volta por traçado', () => {
  const n = numerosDoPiloto([ev17([C1, C2, C3, C4])], 'id:1');
  assert.equal(n.corridas_disputadas, 2);
  assert.equal(n.vitorias, 1);
  assert.equal(n.podios, 2);
  assert.equal(n.media_posicao, 1.5);
  assert.equal(n.melhor_volta_por_tracado['invertido'].mv_ms, 48000);
  assert.equal(n.melhor_volta_por_tracado['6,5 HP'].mv_ms, 47100);
  assert.equal(n.eventos[0].pos, 2);
});

test('mesmo piloto com nome diferente em folha antiga: tabelas mostram o nome da folha mais recente (19/10)', () => {
  // P1 aparece como "Gui" no evento de 2020 (mesmo piloto_id 1); a ordem de entrada dos eventos não pode importar
  const antigo = evR('a', '2020-01-01', [{ ...R1, linhas: R1.linhas.map((l) => (l.piloto === P(1) ? { ...l, piloto: 'Gui' } : l)) }]);
  antigo.estado.pilotos = antigo.estado.pilotos.map((p) => (p.piloto_id === 1 ? { ...p, nome: 'Gui' } : p));
  const novo = evR('b', '2026-01-01', [R2]);
  for (const evs of [[antigo, novo], [novo, antigo]]) {
    const rk = rankingCampeonato(evs).tabela.find((l) => l.piloto_id === 1);
    assert.equal(rk.piloto, P(1), 'ranking');
    assert.equal(rankingRitmo(evs).tabela.find((l) => l.piloto_id === 1).piloto, P(1), 'ritmo');
    const riv = rivaisDoPiloto(evs, 'id:2').find((l) => l.piloto_id === 1);
    assert.equal(riv.piloto, P(1), 'rivais');
    assert.equal(riv._data, undefined, 'campo interno não vaza');
    assert.equal(rankingRitmo(evs).tabela.find((l) => l.piloto_id === 1)._data, undefined);
  }
});
