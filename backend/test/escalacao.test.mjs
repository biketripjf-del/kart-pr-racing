// node --test backend/test/escalacao.test.mjs — escalação das baterias (22/10, GO nos 5 itens)
import test from 'node:test';
import assert from 'node:assert/strict';
import { escalacaoDasBaterias, TOP_FORCA } from '../src/escalacao.js';

const BLOCO = { 1: 'W', 2: 'X', 3: 'Y', 4: 'Z' };
// 28 pilotos: P1..P28, bloco pelo resto (P1 W, P2 X, P3 Y, P4 Z, P5 W…)
const pilotosCopa = (comGrupo = true) => Array.from({ length: 28 }, (_, i) => ({ nome: `P${i + 1}`, piloto_id: i + 1, grupo: comGrupo ? BLOCO[(i % 4) + 1] : null }));
// corrida passada: ordem = chegada, volta cresce 100 ms por posição (o 1º faz a mais rápida)
const corrida = (slug, data, ordem, tracado = '6,5 HP') => ({ slug, estado: { titulo: slug, data, formato: 'corridas', tracado,
  pilotos: ordem.map((n) => ({ nome: n, piloto_id: Number(n.slice(1)) })),
  corridas: [{ codigo: 'C1', nome: 'C1', linhas: ordem.map((piloto, i) => ({ piloto, pos: i + 1, kart: i + 1, mv: 48000 + i * 100, voltas: 18 })) }] } });
const copa = (comGrupo = true) => ({ slug: 'copa-3', estado: { titulo: '3ª Copa', data: '2026-10-23', formato: 'copa3', tracado: '6,5 HP', pilotos: pilotosCopa(comGrupo), sessoes: {} } });
// P4, P8, P12, P16, P20 (todos bloco Z) foram os 5 mais rápidos; P1 (W) e P2 (X) vêm atrás; P3 estreia
const passado = [
  corrida('d0901', '2026-01-09', ['P4', 'P8', 'P12', 'P16', 'P20', 'P1', 'P2', 'P5', 'P6']),
  corrida('d1707', '2026-07-17', ['P8', 'P4', 'P12', 'P16', 'P20', 'P2', 'P1', 'P5', 'P6']),
];

test('antes do sorteio não há escalação', () => {
  assert.deepEqual(escalacaoDasBaterias([...passado, copa(false)], 'copa-3'), { sorteado: false, baterias: [] });
  assert.equal(escalacaoDasBaterias(passado, 'nao-existe'), null);
});

test('cada bateria tem os 14 dos seus 2 blocos, do mais rápido ao mais lento, estreante no fim', () => {
  const e = escalacaoDasBaterias([...passado, copa()], 'copa-3');
  const b4 = e.baterias.find((b) => b.codigo === 'B4_XZ');
  assert.equal(b4.pilotos.length, 14);
  assert.ok(b4.pilotos.every((p) => ['X', 'Z'].includes(p.grupo)));
  assert.deepEqual(b4.pilotos.slice(0, 3).map((p) => p.piloto), ['P4', 'P8', 'P12'], 'empate no ritmo médio desempata pelo nome');
  assert.deepEqual(b4.pilotos.filter((p) => p.destaque).map((p) => p.destaque), [1, 2, 3]);
  const p3 = e.baterias.find((b) => b.codigo === 'B2_YZ').pilotos.find((p) => p.piloto === 'P3');
  assert.equal(p3.estreante, true);
  assert.equal(p3.ritmo, null);
  const b1 = e.baterias.find((b) => b.codigo === 'B1_WX');
  assert.equal(b1.pilotos.at(-1).estreante, true, 'quem não tem volta fica no fim, não no meio');
});

test('força = média dos 5 mais rápidos; a menor é a bateria da morte; com menos de 5 com dado não mede', () => {
  const e = escalacaoDasBaterias([...passado, copa()], 'copa-3');
  const de = (c) => e.baterias.find((b) => b.codigo === c);
  // Z tem os 5 mais rápidos → B2 (Y+Z) e B4 (X+Z) medem; B1 (W+X) só tem P1, P2, P5, P6 com dado → 4 < TOP_FORCA
  assert.equal(TOP_FORCA, 5);
  assert.equal(de('B1_WX').com_dado, 4);
  assert.equal(de('B1_WX').forca, null);
  assert.ok(de('B4_XZ').forca != null && de('B2_YZ').forca != null);
  assert.equal(de('B4_XZ').forca, de('B2_YZ').forca, 'os 5 de Z mandam nas duas');
  assert.equal(e.baterias.filter((b) => b.da_morte).length, 1, 'só uma é a da morte');
  assert.ok(!de('B1_WX').da_morte && !de('B3_WY').da_morte);
});

test('o dia de hoje não entra no histórico da escalação', () => {
  const c = copa();
  // bateria 3 (W + Y) já homologada, o estreante P3 venceu com a volta mais rápida
  const wy = c.estado.pilotos.filter((p) => ['W', 'Y'].includes(p.grupo)).map((p) => p.nome).sort((a, b) => (a === 'P3' ? -1 : b === 'P3' ? 1 : 0));
  c.estado.sessoes = { B3_WY: { status: 'homologado', linhas: wy.map((piloto, i) => ({ piloto, pos: i + 1, kart: i + 1, mv: 47000 + i * 100, voltas: 18 })) } };
  const e = escalacaoDasBaterias([...passado, c], 'copa-3');
  assert.equal(e.recorde.mv_ms, 48000, 'volta de hoje não vira o recorde "a bater"');
  const y = e.baterias.find((b) => b.codigo === 'B3_WY').pilotos.find((p) => p.piloto === 'P3');
  assert.equal(y.estreante, true, 'volta de hoje não vira ritmo "antes da corrida"');
});

test('duelos: só pares da mesma bateria que já correram juntos, placar do confronto direto', () => {
  const e = escalacaoDasBaterias([...passado, copa()], 'copa-3');
  const b4 = e.baterias.find((b) => b.codigo === 'B4_XZ');
  const d = b4.duelos.find((x) => [x.a, x.b].sort().join() === 'P4,P8');
  assert.ok(d, 'P4 e P8 (ambos Z) correram 2 vezes');
  assert.equal(d.encontros, 2);
  assert.equal(d.a_vence + d.b_vence, 2);
  assert.equal(d.a_vence, 1, '1 x 1');
  assert.ok(b4.duelos.length <= 4);
  for (const b of e.baterias) {
    const pares = b.duelos.map((x) => [x.a, x.b].sort().join());
    assert.equal(new Set(pares).size, pares.length, `${b.codigo}: cada par aparece uma vez`);
  }
  for (const x of b4.duelos) assert.ok(b4.pilotos.some((p) => p.piloto === x.a) && b4.pilotos.some((p) => p.piloto === x.b));
});

test('recorde: melhor volta no traçado do dia de cada um; o mais perto do recorde por bateria', () => {
  const e = escalacaoDasBaterias([...passado, copa()], 'copa-3');
  assert.equal(e.recorde.mv_ms, 48000);
  const b1 = e.baterias.find((b) => b.codigo === 'B1_WX');
  assert.deepEqual(b1.mais_perto_do_recorde, { piloto: 'P1', mv_ms: 48500 });
  const outro = escalacaoDasBaterias([corrida('x', '2026-01-09', ['P4', 'P1'], '4 HP'), copa()], 'copa-3');
  assert.equal(outro.recorde, null, 'traçado diferente não se compara');
});

test('título: pontos que cada um leva e quem ainda pode ser campeão', () => {
  const e = escalacaoDasBaterias([...passado, copa()], 'copa-3');
  const p = e.baterias.flatMap((b) => b.pilotos);
  assert.ok(p.some((x) => x.pode_ser_campeao));
  const b2 = e.baterias.find((b) => b.codigo === 'B2_YZ');
  assert.ok(b2.candidatos.includes('P4'), 'o líder corre e está no Z');
  assert.ok(p.filter((x) => x.piloto === 'P4').every((x) => x.pontos > 0));
});
