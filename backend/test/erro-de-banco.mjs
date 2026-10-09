// Banco fora do ar NÃO pode derrubar o servidor (08/10/2026).
// Antes: as rotas eram `async` sem tratamento; no Express 4 a falha do banco virava rejeição não
// tratada e o Node encerrava o processo — um GET público em /api/ranking tirava o site do ar.
// Este teste sobe o app apontando para um banco que recusa conexão e exige: 500 limpo + processo vivo.
//   cd backend && node test/erro-de-banco.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || '4391';
const BASE = `http://127.0.0.1:${PORT}`;
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? '✅' : '❌'} ${msg}`); if (!c) falhas++; };

// 1) trava estática: toda rota async passa pelo `ah` (rota nova sem ele reabre o defeito)
const dirRotas = path.join(__dirname, '../src/routes');
for (const arq of fs.readdirSync(dirRotas).filter((f) => f.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(dirRotas, arq), 'utf8');
  const cruas = src.split('\n').filter((l) => /^router\.(get|post|put|patch|delete)\(/.test(l) && /async\s*\(/.test(l) && !/ah\(async\s*\(/.test(l));
  ok(cruas.length === 0, `${arq}: nenhuma rota async sem ah() ${cruas.length ? '→ ' + cruas.map((l) => l.trim().slice(0, 50)).join(' | ') : ''}`);
}

// 2) comportamento: banco recusando conexão
const filho = spawn(process.execPath, ['src/app.js'], {
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, PORT, DATABASE_URL: 'postgres://ninguem:nada@127.0.0.1:9/nada', USE_PGMEM: '', ADMIN_PASSWORD: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let saiu = null;
filho.on('exit', (code, sinal) => { saiu = { code, sinal }; });
let log = '';
filho.stdout.on('data', (d) => { log += d; });
filho.stderr.on('data', (d) => { log += d; });

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
async function pega(url) {
  try { const r = await fetch(BASE + url); return { status: r.status, corpo: await r.text() }; }
  catch (e) { return { status: 0, corpo: String(e.cause?.code || e.message) }; }
}

for (let i = 0; i < 50 && !log.includes('no ar na porta') && !saiu; i++) await espera(100);
ok(log.includes('no ar na porta'), 'servidor subiu mesmo com o banco fora');

for (const rota of ['/api/ranking', '/api/etapas', '/api/etapas/proxima', '/api/resultados/etapa/1']) {
  const r = await pega(rota);
  ok(r.status === 500 && r.corpo.includes('erro_interno'), `${rota} responde 500 erro_interno (veio ${r.status} ${r.corpo.slice(0, 40)})`);
}
await espera(300);
const saude = await pega('/api/health');
ok(saude.status === 200, `processo segue vivo depois das falhas (/api/health ${saude.status})`);
ok(saiu === null, `processo não encerrou ${saiu ? '(saiu com ' + JSON.stringify(saiu) + ')' : ''}`);

filho.kill();
console.log(falhas === 0 ? '\nTUDO OK' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
