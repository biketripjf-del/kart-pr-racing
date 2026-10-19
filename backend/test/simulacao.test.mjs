// node --test backend/test/simulacao.test.mjs — simulador da última etapa (19/10, "1+2 go")
import test from 'node:test';
import assert from 'node:assert/strict';
import { simular, matematicaDoTitulo, proximaEtapa, MAXIMO_NO_DIA } from '../src/simulacao.js';
import { calcularQuadro } from '../src/aoVivo.js';

const P = (n) => `P${n}`;
const linhas = (nomes, base = 48000) => nomes.map((piloto, i) => ({ piloto, pos: i + 1, kart: i + 1, mv: base + i * 100, voltas: 18 }));
// 2026: 09/01 (P1..P6 + Líder) e 17/07 (P1..P6 + Líder); o Líder (99) não corre o dia 23
const dia = (slug, data, ordem) => ({ slug, estado: { titulo: slug, data, formato: 'corridas', corridas_previstas: 1, corridas_por_piloto: 1,
  pilotos: ordem.map((n) => ({ nome: n, piloto_id: n === 'Lider' ? 99 : Number(n.slice(1)) })),
  corridas: [{ codigo: 'C1', nome: 'C1', linhas: linhas(ordem) }] } });
const e1 = dia('d0901', '2026-01-09', ['Lider', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6']);
const e2 = dia('d1707', '2026-07-17', ['Lider', 'P2', 'P1', 'P6', 'P5', 'P4', 'P3']);
const copa = (extra = {}) => ({ slug: 'copa-3', estado: { titulo: '3ª Copa', data: '2026-10-23', formato: 'copa3',
  pilotos: Array.from({ length: 28 }, (_, i) => ({ nome: P(i + 1), piloto_id: i + 1 })), sessoes: {}, ...extra } });
const evs = (c = copa()) => [e1, e2, c];

test('matemática: cada um leva os dias anteriores menos o pior (o descarte liga no 3º dia); quem não corre fica parado', () => {
  const m = matematicaDoTitulo(evs());
  const de = (n) => m.linhas.find((l) => l.piloto === n);
  assert.equal(m.descarte, true);
  assert.equal(de('Lider').leva, 25, '25 + 25, sai um dos 25');
  assert.equal(de('Lider').hoje, 50, 'hoje (sem descarte) ele tem os dois dias');
  assert.equal(de('Lider').sai.data, '2026-01-09');
  assert.equal(de('Lider').corre, false);
  assert.equal(de('Lider').pode_ser_campeao, false, 'não corre: não depende dele');
  assert.equal(de('P1').leva, 18, 'P1: 2º (18) e 3º (15) → sai o 15');
  assert.equal(de('P1').atras, 7);
  assert.equal(de('P3').leva, 12, 'P3: 4º (12) e 7º (6) → sai o 6');
  assert.equal(de('P20').leva, 0, 'quem corre sexta e ainda não pontuou entra com 0');
  assert.ok(m.linhas.filter((l) => l.corre).every((l) => l.pode_ser_campeao), `até ${MAXIMO_NO_DIA} no dia: todos os 28 ainda podem`);
});

test('matemática: dia com punição não se descarta', () => {
  const punido = structuredClone(e2);
  punido.estado.corridas[0].linhas.find((l) => l.piloto === 'P3').punicao = 3;
  const m = matematicaDoTitulo([e1, punido, copa()]);
  // P3 caiu 3 posições em 17/07 (7º já era o último: segue 7º = 6), mas esse dia não pode sair → sai o 09/01 (12)
  assert.equal(m.linhas.find((l) => l.piloto === 'P3').leva, 6);
});

test('simular: o ajuste vale; o total na Copa = o que levava + os pontos do dia (mesmo motor do ranking)', () => {
  const s = simular(evs(), { P5: { b1: 1, b2: 3, final: 2 } });
  const p5 = s.dia.find((d) => d.piloto === 'P5');
  assert.deepEqual([p5.b1, p5.b2, p5.final, p5.pontos], [1, 3, 2, 25 + 15 + 18]);
  const leva = new Map(matematicaDoTitulo(evs()).linhas.map((l) => [l.piloto, l.leva]));
  const doDia = new Map(s.dia.map((d) => [d.piloto, d.pontos]));
  for (const l of s.ranking.tabela) assert.equal(l.total, leva.get(l.piloto) + (doDia.get(l.piloto) ?? 0), l.piloto);
  assert.equal(s.ranking.descarte.ativo, true);
  assert.equal(s.campeao_do_dia, s.podio[0]);
});

test('simular: sem ritmo nem blocos, a projeção é estável e os blocos provisórios têm 7 cada', () => {
  const a = simular(evs(), {});
  const b = simular(evs(), {});
  assert.deepEqual(a.dia, b.dia);
  assert.equal(a.blocos_reais, false);
  const porBloco = ['W', 'X', 'Y', 'Z'].map((g) => a.dia.filter((d) => d.grupo === g).length);
  assert.deepEqual(porBloco, [7, 7, 7, 7]);
  assert.equal(a.dia.filter((d) => d.na_final).length, 14);
});

test('simular: com os blocos do sorteio, usa os de verdade; posição na final só vale pra quem se classifica', () => {
  const c = copa();
  c.estado.pilotos.forEach((p, i) => { p.grupo = 'WXYZ'[Math.floor(i / 7)]; });
  const s = simular(evs(c), { P1: { b1: 14, b2: 14, final: 1 } });
  assert.equal(s.blocos_reais, true);
  assert.equal(s.dia.find((d) => d.piloto === 'P1').grupo, 'W');
  const p1 = s.dia.find((d) => d.piloto === 'P1');
  assert.equal(p1.na_final, false, 'último nas 2 baterias não vai pra final');
  assert.equal(p1.final, null, 'e o 1º na final pedido é ignorado');
});

test('sem etapa pela frente (final homologada) = nada a simular', () => {
  const c = copa();
  c.estado.pilotos.forEach((p, i) => { p.grupo = 'WXYZ'[Math.floor(i / 7)]; });
  const feito = simular(evs(c), {});
  // grava as folhas da simulação como se fossem as de verdade, final homologada
  const fim = structuredClone(c);
  const nomes = (g) => c.estado.pilotos.filter((p) => g.includes(p.grupo)).map((p) => p.nome);
  fim.estado.sessoes = {
    B1_WX: { status: 'homologado', linhas: linhas(nomes('WX')) }, B2_YZ: { status: 'homologado', linhas: linhas(nomes('YZ')) },
    B3_WY: { status: 'homologado', linhas: linhas(nomes('WY')) }, B4_XZ: { status: 'homologado', linhas: linhas(nomes('XZ')) },
  };
  const fin = calcularQuadro(fim.estado).geral.tabela.filter((l) => l.vai_pra_final).map((l) => l.piloto);
  fim.estado.sessoes.FINAL = { status: 'homologado', linhas: linhas(fin) };
  assert.ok(feito);
  assert.equal(proximaEtapa(evs(fim)), null);
  assert.equal(simular(evs(fim), {}), null);
  assert.equal(matematicaDoTitulo(evs(fim)), null);
});

test('ranking "com descarte" (prévia, 19/10 19:00): a próxima etapa entra como dia com 0 e liga o descarte; bate com a matemática', async () => {
  const { rankingCampeonato } = await import('../src/historico.js');
  const prox = { slug: 'copa-3', data: '2026-10-23' };
  const hoje = rankingCampeonato(evs());
  const previa = rankingCampeonato(evs(), { previa: prox });
  assert.equal(hoje.descarte.ativo, false, 'hoje são 2 dias: sem descarte');
  assert.equal(previa.descarte.ativo, true);
  assert.equal(previa.descarte.protegido, 'copa-3', 'o dia protegido é a próxima etapa, não o 17/07');
  assert.deepEqual(previa.previa, prox);
  const leva = new Map(matematicaDoTitulo(evs()).linhas.map((l) => [l.piloto, l.leva]));
  for (const l of previa.tabela) assert.equal(l.total, leva.get(l.piloto), l.piloto);
  assert.equal(previa.tabela.find((l) => l.piloto === 'Lider').colunas.filter((c) => c.descartado).length, 1, 'um dia riscado');
  // prévia de outro ano não mexe
  assert.equal(rankingCampeonato(evs(), { previa: { slug: 'x', data: '2027-01-01' } }).descarte.ativo, false);
});
