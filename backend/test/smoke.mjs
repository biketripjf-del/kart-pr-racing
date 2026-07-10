// Smoke test end-to-end contra pg-mem (Postgres em memória).
// Roda migrations + seed + fluxo completo pelas rotas HTTP reais.
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

async function main() {
  // 1. migrations
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/001_init.sql'), 'utf8');
  await q(sql);
  console.log('→ migrations aplicadas');

  // 2. seed admin + etapa 1
  const hash = await bcrypt.hash('senha-teste', 10);
  await q('INSERT INTO admins (usuario, senha_hash) VALUES ($1,$2)', ['admin', hash]);
  await q(`INSERT INTO etapas (numero, nome, data, kartodromo, cidade, valor_centavos, status)
           VALUES (1,'Etapa 1 — Volta Redonda','2026-07-17','Kartódromo Internacional de Volta Redonda','Volta Redonda-RJ',18000,'agendada')`);
  console.log('→ seed pronto');

  // 3. importa o app (sobe o listen) — db.js já é o mesmo pool em memória
  await import('../src/app.js');
  await new Promise((r) => setTimeout(r, 800));

  // 4. próxima etapa (pública)
  let r = await http('GET', '/api/etapas/proxima');
  ok(r.status === 200 && r.json?.numero === 1, `GET /etapas/proxima -> etapa 1 (${r.status})`);
  const etapaId = r.json.id;

  // 5. cadastro público de 3 pilotos, inscrevendo na etapa
  const pilotos = [];
  for (const [nome, apelido, peso] of [['Ayrton S','Senna',75],['Nelson P','Piquet',78],['Rubens B','Rubinho',80]]) {
    r = await http('POST', '/api/pilotos', {
      nome, apelido, peso_kg: peso, experiencia: 'casual', consentimento: true, etapa_id: etapaId,
    });
    ok(r.status === 201, `POST /pilotos ${apelido} (${r.status})`);
    pilotos.push(r.json.piloto.id);
  }

  // cadastro sem consentimento deve falhar
  r = await http('POST', '/api/pilotos', { nome: 'Fulano', consentimento: false });
  ok(r.status === 400, `POST /pilotos sem consentimento -> 400 (${r.status})`);

  // 6. login admin
  r = await http('POST', '/api/admin/login', { usuario: 'admin', senha: 'senha-teste' });
  ok(r.status === 200 && r.json?.token, `login admin (${r.status})`);
  const token = r.json.token;

  // login errado
  r = await http('POST', '/api/admin/login', { usuario: 'admin', senha: 'errada' });
  ok(r.status === 401, `login senha errada -> 401 (${r.status})`);

  // rota protegida sem token
  r = await http('GET', '/api/pilotos');
  ok(r.status === 401, `GET /pilotos sem token -> 401 (${r.status})`);

  // 7. admin vê inscritos
  r = await http('GET', `/api/etapas/${etapaId}/inscritos`, null, token);
  ok(r.status === 200 && r.json.length === 3, `inscritos = 3 (${r.json?.length})`);

  // 8. marcar pagamento de todos
  for (const pid of pilotos) {
    r = await http('PATCH', `/api/etapas/${etapaId}/inscritos/${pid}/pagamento`, { pago: true }, token);
    ok(r.status === 200 && r.json.pago === true, `pagamento piloto ${pid} (${r.status})`);
  }

  // 9. lançar resultados (P1 Senna pole, P2 Piquet melhor volta, P3 Rubinho)
  await http('PUT', `/api/resultados/${etapaId}/${pilotos[0]}`, { posicao: 1, melhor_volta_ms: 53000, num_voltas: 15, pole: true }, token);
  await http('PUT', `/api/resultados/${etapaId}/${pilotos[1]}`, { posicao: 2, melhor_volta_ms: 52340, num_voltas: 15 }, token);
  await http('PUT', `/api/resultados/${etapaId}/${pilotos[2]}`, { posicao: 3, melhor_volta_ms: 54000, num_voltas: 15 }, token);

  // 10. resultado público da etapa (pontos calculados)
  r = await http('GET', `/api/resultados/etapa/${etapaId}`);
  const cls = r.json.classificacao;
  const senna = cls.find((c) => c.piloto_id === pilotos[0]);
  const piquet = cls.find((c) => c.piloto_id === pilotos[1]);
  ok(senna.pontos === 26, `Senna P1+pole = 26 pts (${senna.pontos})`);
  ok(piquet.pontos === 19 && piquet.melhor_volta_da_etapa, `Piquet P2+volta rápida = 19 pts (${piquet.pontos})`);
  ok(senna.melhor_volta === '0:53.000', `melhor volta formatada (${senna.melhor_volta})`);

  // 11. fechar etapa
  r = await http('PATCH', `/api/etapas/${etapaId}`, { status: 'realizada' }, token);
  ok(r.status === 200 && r.json.status === 'realizada', `fechar etapa (${r.status})`);

  // 12. ranking anual
  r = await http('GET', '/api/ranking');
  ok(r.status === 200 && r.json.ranking[0]?.piloto_id === pilotos[0], `ranking lidera Senna (${r.json.ranking[0]?.pontos_liquidos} pts)`);
  ok(r.json.etapas_realizadas.length === 1, `1 etapa realizada no ranking (${r.json.etapas_realizadas?.length})`);

  console.log(falhas === 0 ? '\n🏁 TODOS OS TESTES PASSARAM' : `\n💥 ${falhas} FALHA(S)`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => { console.error('ERRO NO HARNESS:', e); process.exit(1); });
