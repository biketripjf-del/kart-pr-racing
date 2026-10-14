// USE_PGMEM=1 PORT=4562 JWT_SECRET=devkey node test/midia-http.mjs (em backend/) — envio de foto/vídeo, original
// intacto, Range pro vídeo, recusa de tipo, autor obrigatório, esconder só pelo admin.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { q } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.MIDIA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'midia-'));
const BASE = `http://localhost:${process.env.PORT}`;
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? '✅' : '❌'} ${msg}`); if (!c) falhas++; };
for (const f of fs.readdirSync(path.join(__dirname, '../migrations')).filter((f) => f.endsWith('.sql')).sort()) {
  await q(fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8'));
}
await q('INSERT INTO admins (usuario, senha_hash) VALUES ($1,$2)', ['admin', await bcrypt.hash('x', 4)]);
await import('../src/app.js');
await new Promise((r) => setTimeout(r, 400));

const foto = Buffer.alloc(300_000, 7);
const video = Buffer.alloc(50_000, 3);
const put = (qs, tipo, corpo) => fetch(`${BASE}/api/midia?${qs}`, { method: 'PUT', headers: { 'Content-Type': tipo }, body: corpo });

let r = await put('autor=Brunner&piloto_id=1&legenda=largada&nome=a.jpg', 'image/jpeg', foto);
const f1 = await r.json();
ok(r.status === 201 && f1.bytes === foto.length, `foto aceita com o tamanho certo (${r.status}, ${f1.bytes})`);
r = await put('autor=Ana&nome=b.mov', 'video/quicktime', video);
const v1 = await r.json();
ok(r.status === 201, 'vídeo .mov aceito');
ok((await put('autor=Ana', 'application/pdf', foto)).status === 415, 'PDF recusado (415)');
ok((await put('autor=', 'image/jpeg', foto)).status === 400, 'sem autor recusado (400)');

const orig = Buffer.from(await (await fetch(`${BASE}/api/midia/${f1.id}/arquivo`)).arrayBuffer());
ok(orig.equals(foto), 'o original volta byte a byte igual');
r = await fetch(`${BASE}/api/midia/${v1.id}/arquivo`, { headers: { Range: 'bytes=0-99' } });
ok(r.status === 206 && (await r.arrayBuffer()).byteLength === 100, 'vídeo responde Range (206, 100 bytes)');
r = await fetch(`${BASE}/api/midia/${f1.id}/arquivo?baixar=1`);
ok(/attachment/.test(r.headers.get('content-disposition') || '') && /a\.jpg/.test(r.headers.get('content-disposition')), 'baixar vem com o nome original');

const thumb = 'data:image/jpeg;base64,' + Buffer.from('jpeg-falso').toString('base64');
r = await fetch(`${BASE}/api/midia/${f1.id}/thumb`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ thumb }) });
ok((await r.json()).ok === true, 'miniatura gravada');
r = await fetch(`${BASE}/api/midia/${f1.id}/thumb`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ thumb }) });
ok((await r.json()).ok === false, 'miniatura não é trocada por outra pessoa depois');

let lista = await (await fetch(`${BASE}/api/midia`)).json();
ok(lista.length === 2 && lista[0].id === v1.id && lista.find((m) => m.id === f1.id).tem_thumb, 'galeria lista os 2, mais novo primeiro');
ok(!('arquivo' in lista[0]), 'galeria pública não expõe o nome do arquivo no disco');

ok((await fetch(`${BASE}/api/midia/${f1.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{"oculto":true}' })).status === 401, 'esconder sem login = 401');
const { token } = await (await fetch(`${BASE}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: 'admin', senha: 'x' }) })).json();
await fetch(`${BASE}/api/midia/${f1.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: '{"oculto":true}' });
lista = await (await fetch(`${BASE}/api/midia`)).json();
ok(lista.length === 1 && (await fetch(`${BASE}/api/midia/${f1.id}/arquivo`)).status === 404, 'escondida some da galeria e do link');
const tudo = await (await fetch(`${BASE}/api/midia/admin/tudo`, { headers: { Authorization: `Bearer ${token}` } })).json();
ok(tudo.midias.length === 2 && fs.existsSync(path.join(process.env.MIDIA_DIR, tudo.midias[0].arquivo)), 'admin vê as 2 e o arquivo escondido continua no disco');

fs.rmSync(process.env.MIDIA_DIR, { recursive: true, force: true });
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO VERDE');
process.exit(falhas ? 1 : 0);
