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

test('pontos lineares 14…1 e tempo da folha', () => {
  assert.equal(pontosDaPosicao(1), 14);
  assert.equal(pontosDaPosicao(14), 1);
  assert.equal(pontosDaPosicao(20), 1);
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

test('quem perdeu a bateria pontua como 14º (1 ponto), mesmo com o último da folha em 13º', () => {
  const estado = { pilotos, sessoes: { B1_A: { linhas: folha(A.slice(0, 13)) } } };
  const q = calcularQuadro(estado);
  const r = q.sessoes.B1_A.resultado;
  assert.equal(r.find((l) => l.piloto === 'A13').pontos, 2);
  const falta = r.find((l) => l.piloto === 'A14');
  assert.equal(falta.ausente, true);
  assert.equal(falta.pontos, 1);
});

test('grid da Bateria 1 sai da tomada de tempo; atrasado larga em último', () => {
  const estado = {
    pilotos: pilotos.map((p) => (p.nome === 'A1' ? { ...p, atrasado: true } : p)),
    sessoes: { CLASS_A: { linhas: folha(A) } },
  };
  const g = calcularQuadro(estado).sessoes.B1_A.grid;
  assert.equal(g[0], 'A2');
  assert.equal(g.at(-1), 'A1');
  assert.equal(g.length, 14);
});

test('grid da Bateria 2 = resultado da 1 invertido (vencedor larga em 14º)', () => {
  const q = calcularQuadro({ pilotos, sessoes: { B1_A: { linhas: folha(A) } } });
  assert.equal(q.sessoes.B2_A.grid[0], 'A14');
  assert.equal(q.sessoes.B2_A.grid[13], 'A1');
});

test('dia inteiro: soma, desempate por melhor volta, corte de 7 e grid da final', () => {
  const inv = A.slice().reverse();
  const sessoes = {
    CLASS_A: { status: 'homologado', linhas: folha(A) },
    B1_A: { status: 'homologado', linhas: folha(A) },
    // bateria 2 invertida: A1 (venceu a 1) chega em último; todos somam 15 → decide a melhor volta
    B2_A: { status: 'homologado', linhas: folha(inv, 47000) },
    CLASS_B: { status: 'homologado', linhas: folha(B) },
    B1_B: { status: 'homologado', linhas: folha(B) },
    B2_B: { status: 'homologado', linhas: folha(B) },
  };
  const q = calcularQuadro({ pilotos, sessoes });
  const tA = q.grupos.A.tabela;
  assert.ok(tA.every((l) => l.total === 15));
  // melhor volta das baterias: na B2, A14 chegou em 1º com 47.000 → é o melhor
  assert.equal(tA[0].piloto, 'A14');
  assert.equal(tA.filter((l) => l.vai_pra_final).length, 7);
  const tB = q.grupos.B.tabela;
  assert.equal(tB[0].piloto, 'B1');
  assert.equal(tB[0].total, 28);
  assert.equal(q.grupos.A.definido, true);
  // final: 14 no grid; B1 (28 pts) na pole
  assert.equal(q.final.grid.length, 14);
  assert.equal(q.final.grid[0].piloto, 'B1');
  assert.equal(q.final.definido, true);
  assert.equal(q.melhor_volta_do_dia.piloto, 'A14');
  assert.equal(q.em_curso, 'FINAL');
});

test('final: pódio e campeão só com a final homologada', () => {
  const linhas = folha(['B1', 'A14', 'B2']);
  let q = calcularQuadro({ pilotos, sessoes: { FINAL: { status: 'provisorio', linhas } } });
  assert.deepEqual(q.final.podio.map((p) => p.piloto), ['B1', 'A14', 'B2']);
  assert.equal(q.final.campeao, null);
  q = calcularQuadro({ pilotos, sessoes: { FINAL: { status: 'homologado', linhas } } });
  assert.equal(q.final.campeao, 'B1');
});

test('empate exato na 7ª vaga vira aviso de sorteio', () => {
  // B1 só com A1..A6 + A7 e A8 sem volta: A7 e A8 ficam com o mesmo total? Monta direto:
  const linhas = folha(A).map((l) => ({ ...l, mv: null }));
  const b2 = folha(A.slice().reverse()).map((l) => ({ ...l, mv: null }));
  const q = calcularQuadro({ pilotos, sessoes: { B1_A: { linhas }, B2_A: { linhas: b2 } } });
  assert.ok(q.avisos.some((a) => a.includes('Grupo A') && a.includes('sorteio')));
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
