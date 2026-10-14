// node --test backend/test/ao-vivo.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularQuadro, resultadoDaSessao, resolverNome, tempoParaMs, pontosDaPosicao, validarSessao,
} from '../src/aoVivo.js';

const A = Array.from({ length: 14 }, (_, i) => `A${i + 1}`);
const B = Array.from({ length: 14 }, (_, i) => `B${i + 1}`);
const pilotos = [...A.map((n) => ({ nome: n, grupo: 'A' })), ...B.map((n) => ({ nome: n, grupo: 'B' }))];
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
  const q = calcularQuadro({ pilotos, sessoes: { B1_A: { linhas: folha(A.slice(0, 13)) } } });
  const r = q.sessoes.B1_A.resultado;
  assert.equal(r.find((l) => l.piloto === 'A13').pontos, 13);
  const falta = r.find((l) => l.piloto === 'A14');
  assert.equal(falta.ausente, true);
  assert.equal(falta.pontos, 14);
});

test('grid de cada corrida = a tomada de tempo DELA, sem inverter; atrasado larga em último', () => {
  const estado = {
    pilotos: pilotos.map((p) => (p.nome === 'A1' ? { ...p, atrasado: true } : p)),
    sessoes: {
      B1_A: { linhas: folha(A) },
      B2_A: { tomada: folha(A) },
    },
  };
  const q = calcularQuadro(estado);
  // B1 venceu A1; mesmo assim a B2 larga pela tomada (A1 atrasado vai pro fim, A2 na pole)
  assert.equal(q.sessoes.B2_A.grid[0], 'A2');
  assert.equal(q.sessoes.B2_A.grid.at(-1), 'A1');
  assert.equal(q.sessoes.B2_A.grid.length, 14);
  // sem tomada lançada, não há grid inventado
  assert.equal(q.sessoes.B2_B.grid, null);
});

test('dia inteiro: menor soma vence, desempate por melhor volta, top-14 GERAL (não 7+7)', () => {
  const inv = A.slice().reverse();
  const sessoes = {
    B1_A: { status: 'homologado', linhas: folha(A) },
    // bateria 2 ao contrário: no grupo A todo mundo soma 15 → decide a melhor volta
    B2_A: { status: 'homologado', linhas: folha(inv, 47000) },
    B1_B: { status: 'homologado', linhas: folha(B) },
    B2_B: { status: 'homologado', linhas: folha(B) },
  };
  const q = calcularQuadro({ pilotos, sessoes });
  const tA = q.grupos.A.tabela;
  assert.ok(tA.every((l) => l.total === 15));
  assert.equal(tA[0].piloto, 'A14'); // 47.000 na B2 = melhor volta
  const g = q.geral.tabela;
  assert.equal(g[0].piloto, 'B1');
  assert.equal(g[0].total, 2);
  // B1..B7 somam 2..14 (< 15): os 7 primeiros são do B; as 7 vagas restantes vão pro A pela melhor volta
  const naFinal = g.filter((l) => l.vai_pra_final);
  assert.equal(naFinal.length, 14);
  assert.equal(naFinal.filter((l) => l.grupo === 'B').length, 7);
  assert.equal(q.geral.definido, true);
  assert.equal(q.final.grid.length, 14);
  assert.equal(q.final.grid_pela_tomada, false);
  assert.equal(q.final.grid[0].piloto, 'B1');
  assert.equal(q.melhor_volta_do_dia.piloto, 'A14');
  assert.equal(q.em_curso, 'FINAL');
});

test('top-14 geral pode levar mais de 7 de um grupo', () => {
  // grupo B inteiro faltou na B2 (14 pontos cada): o grupo A ocupa as vagas
  const sessoes = {
    B1_A: { status: 'homologado', linhas: folha(A) },
    B2_A: { status: 'homologado', linhas: folha(A) },
    B1_B: { status: 'homologado', linhas: folha(B) },
    B2_B: { status: 'homologado', linhas: folha(B.slice(0, 1)) },
  };
  const q = calcularQuadro({ pilotos, sessoes });
  const naFinal = q.geral.tabela.filter((l) => l.vai_pra_final);
  assert.ok(naFinal.filter((l) => l.grupo === 'A').length > 7);
});

test('campeão = menor soma com a final; empate decide a posição na final', () => {
  const sessoes = {
    B1_A: { status: 'homologado', linhas: folha(A) },
    B2_A: { status: 'homologado', linhas: folha(A) },
    B1_B: { status: 'homologado', linhas: folha(B) },
    B2_B: { status: 'homologado', linhas: folha(B) },
  };
  // A1 e B1 somam 2 nas baterias. Final: B1 vence (1), A1 em 2º (2) → B1 3, A1 4
  const ordemFinal = ['B1', 'A1', 'A2', 'B2', 'A3', 'B3', 'A4', 'B4', 'A5', 'B5', 'A6', 'B6', 'A7', 'B7'];
  let q = calcularQuadro({ pilotos, sessoes: { ...sessoes, FINAL: { status: 'provisorio', linhas: folha(ordemFinal) } } });
  assert.equal(q.final.classificacao[0].piloto, 'B1');
  assert.equal(q.final.classificacao[0].total, 3);
  assert.equal(q.final.campeao, null);
  // A2 (soma 4 nas baterias + 3 na final = 7) empata com B2 (4 + 4 = 8)? não: confere desempate com A1 vs B1 invertidos
  const empate = ['A1', 'B1', ...ordemFinal.slice(2)];
  q = calcularQuadro({ pilotos, sessoes: { ...sessoes, FINAL: { status: 'homologado', linhas: folha(empate) } } });
  // A1: 2+1 = 3 · B1: 2+2 = 4 → A1
  assert.equal(q.final.campeao, 'A1');
  assert.deepEqual(q.final.podio.map((p) => p.piloto), ['A1', 'B1', 'A2']);
});

test('empate na soma: quem chegou na frente na final leva', () => {
  const sessoes = {
    B1_A: { status: 'homologado', linhas: folha(A) },
    B2_A: { status: 'homologado', linhas: folha(['A2', 'A1', ...A.slice(2)]) },
    B1_B: { status: 'homologado', linhas: folha(B) },
    B2_B: { status: 'homologado', linhas: folha(B) },
  };
  // A1 = 1+2 = 3, A2 = 2+1 = 3. Final: A2 em 1º (1), A1 em 2º (2) → A2 4, A1 5; B1 = 2 + 3 = 5 empata com A1 → A1 chegou antes
  const ordem = ['A2', 'A1', 'B1', ...['B2', 'A3', 'B3', 'A4', 'B4', 'A5', 'B5', 'A6', 'B6', 'A7', 'B7']];
  const q = calcularQuadro({ pilotos, sessoes: { ...sessoes, FINAL: { status: 'homologado', linhas: folha(ordem) } } });
  const c = q.final.classificacao;
  assert.equal(c[0].piloto, 'A2');
  assert.equal(c[1].piloto, 'A1');
  assert.equal(c[1].total, c[2].total);
});

test('grid da final sai da tomada da final quando ela existe', () => {
  const sessoes = {
    B1_A: { status: 'homologado', linhas: folha(A) },
    B2_A: { status: 'homologado', linhas: folha(A) },
    B1_B: { status: 'homologado', linhas: folha(B) },
    B2_B: { status: 'homologado', linhas: folha(B) },
    FINAL: { tomada: folha(['B7', 'A1']) },
  };
  const q = calcularQuadro({ pilotos, sessoes });
  assert.equal(q.final.grid_pela_tomada, true);
  assert.equal(q.final.grid[0].piloto, 'B7');
  assert.equal(q.final.grid.length, 14);
});

test('empate exato na 14ª vaga vira aviso de sorteio', () => {
  const sem = (l) => ({ ...l, mv: null });
  const sessoes = {
    B1_A: { linhas: folha(A).map(sem) }, B2_A: { linhas: folha(A.slice().reverse()).map(sem) },
    B1_B: { linhas: folha(B).map(sem) }, B2_B: { linhas: folha(B.slice().reverse()).map(sem) },
  };
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
    { piloto: 'A1', pos: 1 }, { piloto: 'A1', pos: 2 }, { piloto: 'X', pos: 2 }, { piloto: 'A3', pos: 3, mv: 'zz' },
  ], pilotos);
  assert.ok(e.some((x) => x.includes('repetido')));
  assert.ok(e.some((x) => x.includes('"X"')));
  assert.ok(e.some((x) => x.includes('posição repetida')));
  assert.ok(e.some((x) => x.includes('ilegível')));
});

test('quem vence a final NÃO é campeão se a soma dele for maior (regra do áudio)', () => {
  const sessoes = {
    B1_A: { status: 'homologado', linhas: folha(A) },
    B2_A: { status: 'homologado', linhas: folha(A) },
    B1_B: { status: 'homologado', linhas: folha(B) },
    B2_B: { status: 'homologado', linhas: folha(B) },
  };
  // A7 soma 14 nas baterias e vence a final (15); B1 soma 2 e chega em 2º (4) → campeão B1
  const ordem = ['A7', 'B1', 'A1', 'B2', 'A2', 'B3', 'A3', 'B4', 'A4', 'B5', 'A5', 'B6', 'A6', 'B7'];
  const q = calcularQuadro({ pilotos, sessoes: { ...sessoes, FINAL: { status: 'homologado', linhas: folha(ordem) } } });
  assert.equal(q.sessoes.FINAL.resultado[0].piloto, 'A7');
  assert.equal(q.final.campeao, 'B1');
  assert.notEqual(q.final.podio[0].piloto, 'A7');
});
