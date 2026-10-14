// USE_PGMEM=1 PORT=4555 node backend/test/ao-vivo-http.mjs — rotas reais do quadro ao vivo contra pg-mem.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { q } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = `http://localhost:${process.env.PORT}`;
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? '✅' : '❌'} ${msg}`); if (!c) falhas++; };
async function http(metodo, url, body, token) {
  const r = await fetch(BASE + url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  let json; try { json = JSON.parse(txt); } catch { json = txt; }
  return { status: r.status, json };
}

for (const f of ['001_init.sql', '002_ao_vivo.sql']) await q(fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8'));
await q('INSERT INTO admins (usuario, senha_hash) VALUES ($1,$2)', ['admin', await bcrypt.hash('senha-teste', 10)]);
await q(`INSERT INTO etapas (numero, nome, data) VALUES (1,'Etapa 1','2026-07-17')`);
await import('../src/app.js');
await new Promise((r) => setTimeout(r, 800));

const { json: { token } } = await http('POST', '/api/admin/login', { usuario: 'admin', senha: 'senha-teste' });
const pilotos = Array.from({ length: 28 }, (_, i) => ({ nome: `P${i + 1}`, grupo: i < 14 ? 'A' : 'B' }));

ok((await http('GET', '/api/ao-vivo/copa-3')).status === 404, 'evento inexistente = 404');
ok((await http('PUT', '/api/ao-vivo/copa-3', { titulo: 'X', pilotos })).status === 401, 'escrever sem login = 401');
const cria = await http('PUT', '/api/ao-vivo/copa-3', { titulo: 'Copa teste', data: '2026-10-23', pilotos }, token);
ok(cria.status === 200 && cria.json.versao === 1, 'cria o evento (versão 1)');

const linhas = pilotos.slice(0, 14).map((p, i) => ({ piloto: p.nome, pos: i + 1, kart: i + 1, mv: `00:4${8 + (i % 2)}.${100 + i}` }));
const ruim = await http('PUT', '/api/ao-vivo/copa-3/sessao/B1_A', { linhas: [...linhas, { piloto: 'Fulano', pos: 15 }] }, token);
ok(ruim.status === 400 && ruim.json.detalhes.some((d) => d.includes('Fulano')), 'folha com piloto fora da lista = 400 com o nome');
const velha = await http('PUT', '/api/ao-vivo/copa-3/sessao/B1_A', { linhas, se_versao: 99 }, token);
ok(velha.status === 409, 'lançamento sobre versão velha = 409');
const lanc = await http('PUT', '/api/ao-vivo/copa-3/sessao/B1_A', { linhas, se_versao: 1 }, token);
ok(lanc.status === 200 && lanc.json.versao === 2, 'lança a Bateria 1-A (versão 2)');

const { status, json } = await http('GET', '/api/ao-vivo/copa-3');
ok(status === 200, 'leitura pública sem login');
ok(json.quadro.sessoes.B1_A.status === 'provisorio', 'folha nova entra como PROVISÓRIA');
ok(json.quadro.sessoes.B2_A.grid === null, 'Bateria 2-A sem grid até a tomada dela (nada de inverter)');
ok(json.quadro.grupos.A.tabela[0].piloto === 'P1' && json.quadro.grupos.A.tabela[0].total === 1, 'placar do grupo A: P1 com 1 ponto');
ok(json.quadro.geral.tabela[0].piloto === 'P1' && json.quadro.geral.tabela[0].vai_pra_final, 'geral: P1 na frente, dentro do corte');
ok(json.quadro.em_curso === 'B1_A', 'em curso = 1ª sessão não homologada');

const tom = pilotos.slice(0, 14).reverse().map((p, i) => ({ piloto: p.nome, pos: i + 1, mv: `00:49.${100 + i}` }));
const lt = await http('PUT', '/api/ao-vivo/copa-3/sessao/B2_A', { tomada: tom }, token);
const g2 = await http('GET', '/api/ao-vivo/copa-3');
ok(lt.status === 200 && g2.json.quadro.sessoes.B2_A.grid[0] === 'P14' && g2.json.quadro.sessoes.B2_A.status === 'aguardando',
   'tomada da B2-A vira o grid (P14 na pole) sem marcar a corrida como corrida');

const hom = await http('PUT', '/api/ao-vivo/copa-3/sessao/B1_A', { status: 'homologado' }, token);
const tomRuim = await http('PUT', '/api/ao-vivo/copa-3/sessao/B2_A', { tomada: [{ piloto: 'Fulano', pos: 1 }] }, token);
ok(tomRuim.status === 400 && tomRuim.json.detalhes.some((d) => d.startsWith('tomada de tempo')), 'tomada com piloto fora da lista = 400');
const depois = await http('GET', '/api/ao-vivo/copa-3');
ok(hom.status === 200 && depois.json.quadro.sessoes.B1_A.status === 'homologado'
   && depois.json.quadro.sessoes.B1_A.resultado.length === 14, 'homologar mantém a folha');

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo verde');
process.exit(falhas ? 1 : 0);
