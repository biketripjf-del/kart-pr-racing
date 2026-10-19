// node --test backend/test/ao-vivo.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularQuadro, resultadoDaSessao, resolverNome, tempoParaMs, pontosDaPosicao, validarSessao, SESSOES,
} from '../src/aoVivo.js';

// 3ª Copa, formato opção A (19/10/2026): 4 blocos de 7 que se misturam nas baterias
const bloco = (g) => Array.from({ length: 7 }, (_, i) => `${g}${i + 1}`);
const [W, X, Y, Z] = ['W', 'X', 'Y', 'Z'].map(bloco);
const pilotos = [W, X, Y, Z].flatMap((ns, k) => ns.map((n) => ({ nome: n, grupo: 'WXYZ'[k] })));
// folha em que `ordem[i]` chega em i+1, melhor volta crescente com a posição
const folha = (ordem, base = 48000) => ordem.map((p, i) => ({ piloto: p, pos: i + 1, kart: i + 1, mv: base + i * 100 }));

test('pontos = posição (1º = 1) e tempo da folha', () => {
  assert.equal(pontosDaPosicao(1), 1);
  assert.equal(pontosDaPosicao(5), 5);
  assert.equal(tempoParaMs('00:48.485'), 48485);
  assert.equal(tempoParaMs('48,485'), 48485);
  assert.equal(tempoParaMs('1:02.300'), 62300);
  assert.equal(tempoParaMs('xx'), null);
});

test('punição de 3 posições: cai 3, quem estava atrás sobe', () => {
  const linhas = folha(['A1', 'A2', 'A3', 'A4', 'A5']);
  linhas[0].punicao = 3;
  const r = resultadoDaSessao(linhas, [], { contarAusentes: false });
  assert.deepEqual(r.map((l) => l.piloto), ['A2', 'A3', 'A4', 'A1', 'A5']);
  assert.equal(r[3].pos_folha, 1);
});

test('fim de fila e punição perto do fim não estouram a lista', () => {
  const linhas = folha(['A1', 'A2', 'A3']);
  linhas[0].punicao = 'fim';
  linhas[1].punicao = 3;
  const r = resultadoDaSessao(linhas, [], { contarAusentes: false });
  assert.deepEqual(r.map((l) => l.piloto), ['A3', 'A2', 'A1']);
});

test('quem perdeu a bateria leva 14 pontos, mesmo com o último da folha em 13º', () => {
  const q = calcularQuadro({ pilotos, sessoes: { B1_WX: { linhas: folha([...W, ...X.slice(0, 6)]) } } });
  const r = q.sessoes.B1_WX.resultado;
  assert.equal(r.length, 14, 'a bateria 1 é W + X: 14 pilotos');
  assert.equal(r.find((l) => l.piloto === 'X6').pontos, 13);
  const falta = r.find((l) => l.piloto === 'X7');
  assert.equal(falta.ausente, true);
  assert.equal(falta.pontos, 14);
});

test('opção A: cada piloto corre 2 baterias (uma por rodada) e enfrenta 20 dos 27 rivais', () => {
  const baterias = SESSOES.filter((d) => d.tipo === 'bateria');
  assert.equal(baterias.length, 4);
  for (const p of pilotos) {
    const minhas = baterias.filter((d) => d.blocos.includes(p.grupo));
    assert.deepEqual(minhas.map((d) => d.n), [1, 2], `${p.nome}: uma bateria em cada rodada`);
    const rivais = new Set(pilotos.filter((o) => o.nome !== p.nome && minhas.some((d) => d.blocos.includes(o.grupo))).map((o) => o.nome));
    assert.equal(rivais.size, 20, `${p.nome}: 20 rivais diferentes`);
  }
  for (const d of baterias) assert.equal(pilotos.filter((p) => d.blocos.includes(p.grupo)).length, 14, `${d.codigo}: 14 pilotos`);
});

test('grid de cada corrida = a tomada de tempo DELA, sem inverter; atrasado larga em último', () => {
  const estado = {
    pilotos: pilotos.map((p) => (p.nome === 'W1' ? { ...p, atrasado: true } : p)),
    sessoes: {
      B1_WX: { linhas: folha([...W, ...X]) },
      B3_WY: { tomada: folha([...W, ...Y]) },
    },
  };
  const q = calcularQuadro(estado);
  // W1 venceu a bateria 1; mesmo assim a bateria 3 larga pela tomada (W1 atrasado vai pro fim, W2 na pole)
  assert.equal(q.sessoes.B3_WY.grid[0], 'W2');
  assert.equal(q.sessoes.B3_WY.grid.at(-1), 'W1');
  assert.deepEqual(new Set(q.sessoes.B3_WY.grid), new Set([...W, ...Y]), 'bateria 3 = blocos W e Y');
  // sem tomada lançada, não há grid inventado
  assert.equal(q.sessoes.B4_XZ.grid, null);
});

// dia completo: bateria 1 [W, X] · bateria 2 [Y, Z] · bateria 3 [Y, W] · bateria 4 [X, Z] (a 4 mais rápida)
// somas: Y_i = 2i · W_i = X_i = 7 + 2i · Z_i = 14 + 2i
const diaCompleto = () => ({
  B1_WX: { status: 'homologado', linhas: folha([...W, ...X]) },
  B2_YZ: { status: 'homologado', linhas: folha([...Y, ...Z]) },
  B3_WY: { status: 'homologado', linhas: folha([...Y, ...W]) },
  B4_XZ: { status: 'homologado', linhas: folha([...X, ...Z], 47000) },
});

test('dia inteiro: soma das 2 baterias de cada um, desempate por melhor volta, top-14 GERAL', () => {
  const q = calcularQuadro({ pilotos, sessoes: diaCompleto() });
  const g = q.geral.tabela;
  const linha = (n) => g.find((l) => l.piloto === n);
  // a 1ª e a 2ª bateria do piloto saem do bloco dele
  assert.deepEqual([linha('Y1').b1_codigo, linha('Y1').b2_codigo], ['B2_YZ', 'B3_WY']);
  assert.deepEqual([linha('X1').b1_codigo, linha('X1').b2_codigo], ['B1_WX', 'B4_XZ']);
  assert.deepEqual([linha('W3').b1.pontos, linha('W3').b2.pontos, linha('W3').total], [3, 10, 13]);
  assert.equal(g[0].piloto, 'Y1');
  assert.equal(g[0].total, 2);
  const naFinal = g.filter((l) => l.vai_pra_final).map((l) => l.piloto);
  assert.equal(naFinal.length, 14);
  // 13 cabem pela soma; a 14ª vaga é W4 × X4 (15 pontos cada): X4 tem 47.300 na bateria 4, W4 48.300
  assert.ok(naFinal.includes('X4') && !naFinal.includes('W4'));
  assert.equal(naFinal.filter((n) => n.startsWith('Z')).length, 0);
  assert.equal(q.blocos.Y.tabela[0].piloto, 'Y1');
  assert.equal(q.geral.definido, true);
  assert.equal(q.final.grid.length, 14);
  assert.equal(q.final.grid_pela_tomada, false);
  assert.equal(q.final.grid[0].piloto, 'Y1');
  assert.equal(q.melhor_volta_do_dia.piloto, 'X1');
  assert.equal(q.em_curso, 'FINAL');
});

test('bloco que não veio leva 14 na bateria inteira', () => {
  const sessoes = { ...diaCompleto(), B2_YZ: { status: 'homologado', linhas: folha(Y) } };
  const q = calcularQuadro({ pilotos, sessoes });
  const z1 = q.geral.tabela.find((l) => l.piloto === 'Z1');
  assert.equal(z1.b1.ausente, true);
  assert.equal(z1.b1.pontos, 14);
});

test('campeão e pódio = resultado da FINAL; só vira campeão com a final homologada', () => {
  const sessoes = diaCompleto();
  const naFinal = calcularQuadro({ pilotos, sessoes }).geral.tabela.filter((l) => l.vai_pra_final).map((l) => l.piloto);
  const ordem = naFinal.slice().reverse(); // o 14º das baterias vence a final
  let q = calcularQuadro({ pilotos, sessoes: { ...sessoes, FINAL: { status: 'provisorio', linhas: folha(ordem) } } });
  assert.deepEqual(q.final.podio.map((p) => p.piloto), ordem.slice(0, 3));
  assert.equal(q.final.campeao, null);
  q = calcularQuadro({ pilotos, sessoes: { ...sessoes, FINAL: { status: 'homologado', linhas: folha(ordem) } } });
  // X4 tinha a PIOR soma entre os classificados (15) e mesmo assim é campeão: a final decide sozinha
  assert.equal(q.final.campeao, 'X4');
  assert.equal(q.final.classificacao[0].baterias, 15);
});

test('grid da final sai da tomada da final quando ela existe', () => {
  const sessoes = { ...diaCompleto(), FINAL: { tomada: folha(['X4', 'Y1']) } };
  const q = calcularQuadro({ pilotos, sessoes });
  assert.equal(q.final.grid_pela_tomada, true);
  assert.equal(q.final.grid[0].piloto, 'X4');
  assert.equal(q.final.grid.length, 14);
});

test('empate exato na 14ª vaga vira aviso de sorteio', () => {
  const sem = (l) => ({ ...l, mv: null });
  const sessoes = Object.fromEntries(Object.entries(diaCompleto()).map(([k, v]) => [k, { linhas: v.linhas.map(sem) }]));
  const q = calcularQuadro({ pilotos, sessoes });
  assert.ok(q.avisos.some((a) => a.includes('14ª vaga') && a.includes('sorteio')));
});

test('nome da folha → nome do cadastro', () => {
  const lista = [
    { nome: 'Gabriel Lanna' }, { nome: 'Gabriel Gaudereto' }, { nome: 'Marcelo Chaves' },
    { nome: 'Filho Marcelo Chaves' }, { nome: 'Henrique Lana', aliases: ['Henrique Lanna'] },
    { nome: 'Brunner' }, { nome: 'Brenner' },
  ];
  assert.equal(resolverNome('GABRIEL LANNA ALMEIDA', lista).piloto, 'Gabriel Lanna');
  assert.equal(resolverNome('GABRIEL GAUDERETO DE NAVARRO', lista).piloto, 'Gabriel Gaudereto');
  assert.equal(resolverNome('BRUNNER VIEIRA', lista).piloto, 'Brunner');
  assert.equal(resolverNome('HENRIQUE LANNA', lista).piloto, 'Henrique Lana');
  assert.equal(resolverNome('MARCELO CHAVES FILHO', lista).piloto, 'Filho Marcelo Chaves');
  assert.equal(resolverNome('MARCELO CHAVES DE SOUZA', lista).piloto, 'Marcelo Chaves');
  assert.ok(resolverNome('GABRIEL', lista).nenhum || resolverNome('GABRIEL', lista).ambiguo);
  assert.ok(resolverNome('PEDRO MAGNAGO', lista).nenhum);
});

test('validação barra piloto fora da lista, repetido e posição dupla', () => {
  const e = validarSessao([
    { piloto: 'W1', pos: 1 }, { piloto: 'W1', pos: 2 }, { piloto: 'Fulano', pos: 2 }, { piloto: 'W3', pos: 3, mv: 'zz' },
  ], pilotos);
  assert.ok(e.some((x) => x.includes('repetido')));
  assert.ok(e.some((x) => x.includes('"Fulano"')));
  assert.ok(e.some((x) => x.includes('posição repetida')));
  assert.ok(e.some((x) => x.includes('ilegível')));
});
