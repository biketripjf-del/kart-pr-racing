// USE_PGMEM=1 PORT=4561 node test/app-completo-http.mjs (em backend/) — ficha, foto, mural, sorteio ao vivo e
// histórico contra as rotas reais (Postgres em memória).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { q } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = `http://localhost:${process.env.PORT}`;
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? '✅' : '❌'} ${msg}`); if (!c) falhas++; };
async function http(metodo, url, body, token, extra = {}) {
  const r = await fetch(BASE + url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
    body: body ? JSON.stringify(body) : undefined,
  });
  const buf = Buffer.from(await r.arrayBuffer());
  let json; try { json = JSON.parse(buf.toString()); } catch { json = buf; }
  return { status: r.status, json, tipo: r.headers.get('content-type') };
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

for (const f of fs.readdirSync(path.join(__dirname, '../migrations')).filter((f) => f.endsWith('.sql')).sort()) {
  await q(fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8'));
}
// pg-mem reprova CHECK (experiencia IN (...)) com experiencia NULL — no Postgres de verdade NULL passa no CHECK.
// Medido 14/10/2026 (INSERT só com nome falha no pg-mem com ou sem esta migration). Só no teste: tira a trava.
await q('ALTER TABLE pilotos DROP CONSTRAINT pilotos_constraint_1');
await q('INSERT INTO admins (usuario, senha_hash) VALUES ($1,$2)', ['admin', await bcrypt.hash('senha-teste', 10)]);
await q(`INSERT INTO etapas (numero, nome, data) VALUES (1,'Etapa 1','2026-07-17')`);
await q(`INSERT INTO pilotos (nome, apelido, whatsapp) VALUES ('BRUNNER VIEIRA', 'BRUNNER', '32999990000')`);
await import('../src/app.js');
await espera(800);
const { json: { token } } = await http('POST', '/api/admin/login', { usuario: 'admin', senha: 'senha-teste' });

// ---------- evento + vínculo com o cadastro ----------
const nomes = ['Brunner', ...Array.from({ length: 27 }, (_, i) => `Piloto ${i + 2}`)];
const pilotos = nomes.map((n) => ({ nome: n, grupo: null, ...(n === 'Brunner' ? { aliases: ['Brunner Vieira'] } : {}) }));
await http('PUT', '/api/ao-vivo/copa-3', { titulo: '3ª Copa', data: '2026-10-23', pilotos }, token);
ok((await http('POST', '/api/ao-vivo/copa-3/vincular', {})).status === 401, 'vincular sem login = 401');
const v = await http('POST', '/api/ao-vivo/copa-3/vincular', {}, token);
ok(v.status === 200 && v.json.vinculados.length === 28, 'vincular: 28 pilotos ligados ao cadastro');
ok(v.json.vinculados.find((x) => x.nome === 'Brunner')?.criado === false && v.json.vinculados.find((x) => x.nome === 'Brunner').piloto_id === 1,
  'Brunner casou com o cadastro que já existia (pelo apelido/alias), sem duplicar');
ok(v.json.vinculados.filter((x) => x.criado).length === 27, '27 cadastros novos');
const v2 = await http('POST', '/api/ao-vivo/copa-3/vincular', {}, token);
ok(v2.json.vinculados.length === 0, 'vincular de novo não cria nada (idempotente)');
// PUT do estado vindo de arquivo antigo (sem piloto_id) não pode perder o vínculo
await http('PUT', '/api/ao-vivo/copa-3', { titulo: '3ª Copa', data: '2026-10-23', pilotos, regulamento: 'R' }, token);
const ev = (await http('GET', '/api/ao-vivo/copa-3')).json;
ok(ev.pilotos.every((p) => p.piloto_id != null), 'PUT com arquivo antigo preserva o piloto_id de todos');

// ---------- ficha ----------
const lista = await http('GET', '/api/ficha/lista');
ok(lista.status === 200 && lista.json.pilotos.length === 28 && lista.json.pilotos.every((p) => !p.tem_ficha), 'lista da ficha: 28, ninguém preencheu');
ok(!JSON.stringify(lista.json).includes('32999990000'), 'lista pública não mostra telefone');
const idP2 = lista.json.pilotos.find((p) => p.nome === 'Piloto 2').id;
const foto = 'data:image/png;base64,' + Buffer.from('89504e470d0a1a0a', 'hex').toString('base64');
const ficha = { nome: 'Piloto Dois da Silva', apelido: 'Dois', whatsapp: '(32) 98888-1111', data_nascimento: '1990-05-01', peso_kg: 82.5, altura_cm: 178, tipo_sanguineo: 'O+', emergencia_nome: 'Mãe', emergencia_tel: '32 3333-0000', consentimento: true, foto };
// a ficha só abre pelo LINK PESSOAL (14/10 21:43: "a ficha do piloto nao pode ser publica")
ok((await http('POST', `/api/ficha/${idP2}`, ficha)).status === 404, 'rota antiga por id (aberta) não existe mais');
ok((await http('POST', '/api/ficha/eu', ficha)).status === 401, 'sem link pessoal = 401');
ok((await http('GET', '/api/ficha/eu', null, null, { 'X-Piloto': 'chute-qualquer-de-vinte-chars' })).status === 401, 'link chutado = 401');
ok((await http('GET', '/api/ficha/admin/links')).status === 401, 'links pessoais sem login = 401');
const links = await http('GET', '/api/ficha/admin/links', null, token);
ok(links.status === 200 && links.json.pilotos.length === 28 && new Set(links.json.pilotos.map((p) => p.token)).size === 28 && links.json.pilotos.every((p) => p.token.length >= 20),
  'admin: 28 links pessoais, todos diferentes, 20+ caracteres');
const links2 = await http('GET', '/api/ficha/admin/links', null, token);
ok(links2.json.pilotos.every((p, i) => p.token === links.json.pilotos[i].token), 'pedir de novo devolve os MESMOS links (não invalida o que já foi mandado)');
const tk2 = links.json.pilotos.find((p) => p.id === idP2).token;
const tk3 = links.json.pilotos.find((p) => p.nome === 'Piloto 3').token;
const X2 = { 'X-Piloto': tk2 };
ok((await http('GET', '/api/ficha/eu', null, null, X2)).json.nome_evento === 'Piloto 2', 'o link do Piloto 2 abre a ficha DELE');
ok((await http('POST', '/api/ficha/eu', { ...ficha, consentimento: false }, null, X2)).status === 400, 'ficha sem consentimento = 400');
ok((await http('POST', '/api/ficha/eu', { ...ficha, foto: 'data:text/html;base64,PHNjcmlwdD4=' }, null, X2)).status === 400, 'foto que não é imagem = 400');
ok((await http('POST', '/api/ficha/eu', ficha, null, X2)).status === 200, 'preenche pela ficha do link');
ok((await http('POST', '/api/ficha/eu', { ...ficha, apelido: 'Doisão', foto: undefined }, null, X2)).status === 200, 'edita de novo pelo mesmo link');
const minha = await http('GET', '/api/ficha/eu', null, null, X2);
ok(minha.json.altura_cm === 178 && minha.json.data_nascimento === '1990-05-01' && minha.json.apelido === 'Doisão' && minha.json.tem_foto && !('foto' in minha.json),
  'a própria ficha volta inteira pra editar (sem o peso da foto) e a foto ficou');
ok((await http('GET', '/api/ficha/eu', null, null, { 'X-Piloto': tk3 })).json.id !== idP2, 'o link de outro piloto não abre a ficha do Piloto 2');
const troca = await http('POST', `/api/ficha/admin/${idP2}/novo-link`, null, token);
ok((await http('GET', '/api/ficha/eu', null, null, X2)).status === 401 && (await http('GET', '/api/ficha/eu', null, null, { 'X-Piloto': troca.json.token })).status === 200,
  'admin troca o link: o antigo morre na hora, o novo abre');
const X2n = { 'X-Piloto': troca.json.token };
const pubLista = (await http('GET', '/api/ficha/lista')).json.pilotos.find((p) => p.id === idP2);
ok(pubLista.tem_ficha && pubLista.apelido === 'Doisão' && !('whatsapp' in pubLista) && !('token' in pubLista), 'lista pública: só nome, apelido e se tem ficha (sem telefone nem link)');
const img = await http('GET', `/api/pilotos/${idP2}/foto`);
ok(img.status === 200 && img.tipo === 'image/png' && Buffer.isBuffer(img.json) && img.json.length === 8, 'foto servida como imagem de verdade');
ok((await http('GET', `/api/pilotos/${idP2 + 1}/foto`)).status === 404, 'sem foto = 404');
const adm = await http('GET', '/api/pilotos', null, token);
const p2 = adm.json.find((p) => p.id === idP2);
ok(p2.peso_kg == 82.5 && p2.altura_cm === 178 && p2.tipo_sanguineo === 'O+' && p2.tem_foto && !('foto' in p2), 'admin vê a ficha inteira, sem o peso da foto na lista');

// ---------- caronas ----------
const X3 = { 'X-Piloto': tk3 };
const tk4 = links.json.pilotos.find((p) => p.nome === 'Piloto 4').token;
const X4 = { 'X-Piloto': tk4 };
let car = await http('GET', '/api/caronas');
ok(car.json.caronas.length === 0 && car.json.sem_carona.length === 28 && car.json.eu === null, 'caronas: ninguém em carro, visitante sem identidade');
ok((await http('POST', '/api/caronas', { vagas: 2 })).status === 401, 'oferecer carona sem link = 401');
const of = await http('POST', '/api/caronas', { vagas: 1, saida_local: 'Independência', saida_hora: '10:00' }, null, X2n);
ok(of.status === 201, 'Piloto 2 oferece carro com 1 vaga');
ok((await http('POST', '/api/caronas', { vagas: 3 }, null, X2n)).status === 409, 'não oferece 2 carros');
ok((await http('POST', `/api/caronas/${of.json.id}/entrar`, {}, null, X2n)).status === 409, 'motorista não entra de passageiro');
ok((await http('POST', `/api/caronas/${of.json.id}/entrar`, {}, null, X3)).status === 200, 'Piloto 3 entra');
ok((await http('POST', `/api/caronas/${of.json.id}/entrar`, {}, null, X4)).json.erro === 'carro_cheio', 'Piloto 4 barrado: carro cheio');
ok((await http('PATCH', `/api/caronas/${of.json.id}`, { vagas: 3 }, null, X3)).status === 403, 'passageiro não mexe no carro');
ok((await http('PATCH', `/api/caronas/${of.json.id}`, { vagas: 0 }, null, X2n)).status === 400, 'vagas 0 recusado');
ok((await http('PATCH', `/api/caronas/${of.json.id}`, { vagas: 2 }, null, X2n)).status === 200, 'motorista abre mais 1 vaga');
ok((await http('POST', `/api/caronas/${of.json.id}/entrar`, {}, null, X4)).status === 200, 'agora o Piloto 4 entra');
ok((await http('PATCH', `/api/caronas/${of.json.id}`, { vagas: 1 }, null, X2n)).json.erro === 'vagas_menor_que_passageiros', 'não reduz vagas abaixo de quem já entrou');
ok((await http('POST', `/api/caronas/${of.json.id}/sair`, { piloto_id: (await http('GET', '/api/ficha/eu', null, null, X4)).json.id }, null, X3)).status === 403, 'um passageiro não tira o outro');
car = await http('GET', '/api/caronas', null, null, X3);
ok(car.json.caronas[0].passageiros.length === 2 && car.json.sem_carona.length === 25 && car.json.eu?.id != null, 'quadro: 1 carro com 2, 25 sem carona, eu reconhecido');
ok(!JSON.stringify(car.json).includes('98888'), 'caronas não expõem telefone');
ok((await http('POST', `/api/caronas/${of.json.id}/sair`, {}, null, X3)).json.ok === true, 'Piloto 3 sai do carro');
ok((await http('DELETE', `/api/caronas/${of.json.id}`, null, null, X4)).status === 403, 'passageiro não desfaz o carro');
ok((await http('DELETE', `/api/caronas/${of.json.id}`, null, token)).status === 200, 'organização desfaz o carro');
ok((await http('GET', '/api/caronas')).json.sem_carona.length === 28, 'todo mundo volta pra sem carona');

// ---------- mural ----------
ok((await http('POST', '/api/avisos', { titulo: 'X', texto: 'Y' })).status === 401, 'mural: publicar sem login = 401');
await http('POST', '/api/avisos', { titulo: 'Primeiro', texto: 'a' }, token);
await http('POST', '/api/avisos', { titulo: 'Fixado', texto: 'b', fixado: true }, token);
await http('POST', '/api/avisos', { titulo: 'Último', texto: 'c' }, token);
const mural = await http('GET', '/api/avisos');
ok(mural.json.map((a) => a.titulo).join(',') === 'Fixado,Último,Primeiro', 'mural: fixado em cima, depois o mais novo');

// ---------- sorteio ao vivo ----------
ok((await http('GET', '/api/sorteio/copa-3')).status === 404, 'sem sorteio agendado = 404');
ok((await http('POST', '/api/sorteio/copa-3', { agendado_para: new Date(Date.now() + 1500).toISOString(), passo_ms: 1000 })).status === 401, 'agendar sem login = 401');
const ag = await http('POST', '/api/sorteio/copa-3', { agendado_para: new Date(Date.now() + 1500).toISOString(), passo_ms: 1000 }, token);
ok(ag.status === 201 && ag.json.inscritos === 28, 'sorteio agendado (28 inscritos)');
let s = (await http('GET', '/api/sorteio/copa-3')).json;
ok(s.fase === 'contagem' && s.revelados.length === 0 && s.faltam_ms > 0, 'antes da hora: contagem, nenhum nome');
await espera(4200);
s = (await http('GET', '/api/sorteio/copa-3')).json;
ok(s.fase === 'revelando' && s.revelados.length >= 1 && s.revelados.length <= 4, `começou sozinho e revela no ritmo (${s.revelados.length} nomes em ~2,7 s)`);
ok(s.semente === null, 'semente escondida durante o show');
ok(s.revelados.every((r) => r.piloto_id != null), 'nome revelado vem com o id (foto na tela)');
ok((await http('POST', '/api/sorteio/copa-3', { agendado_para: new Date().toISOString() }, token)).status === 409, 'reagendar no meio do show = 409');
// deixa o laço de 2 s terminar sozinho: 28 nomes × 1 s + respiro 4 s
for (let i = 0; i < 25 && s.fase !== 'concluido'; i++) { await espera(2000); s = (await http('GET', '/api/sorteio/copa-3')).json; }
ok(s.fase === 'concluido' && s.revelados.length === 28 && s.semente, 'concluiu sozinho com os 28 e mostrou a semente');
await espera(2500);
const depois = (await http('GET', '/api/ao-vivo/copa-3')).json;
const a = depois.pilotos.filter((p) => p.grupo === 'A').length;
ok(a === 14 && depois.pilotos.filter((p) => p.grupo === 'B').length === 14, 'grupos gravados no evento: 14 A + 14 B');
ok(s.revelados.every((r) => depois.pilotos.find((p) => p.nome === r.nome).grupo === r.grupo), 'grupo gravado = grupo mostrado na tela');
const { montarOrdem } = await import('../src/sorteio.js');
ok(JSON.stringify(montarOrdem(s.participantes, s.semente).map((o) => o.nome)) === JSON.stringify(s.revelados.map((r) => r.nome)),
  'qualquer um refaz o sorteio com a semente publicada e chega no mesmo resultado');
ok(depois.pilotos.every((p) => p.piloto_id != null), 'gravar os grupos não perdeu o vínculo com o cadastro');

// ---------- histórico ----------
const linhas = (ns) => ns.map((piloto, i) => ({ piloto, pos: i + 1, kart: i + 1, mv: `00:4${7 + (i % 3)}.${100 + i}`, voltas: 18 }));
await http('PUT', '/api/ao-vivo/corridas-17-07', {
  titulo: 'Corridas de 17/07', data: '2026-07-17', formato: 'corridas', corridas_previstas: 2, corridas_por_piloto: 1,
  pilotos: [{ nome: 'Brunner' }, { nome: 'Piloto 2' }, { nome: 'Só de julho' }],
  corridas: [{ codigo: 'C1', nome: '1ª corrida', tracado: '6,5 HP', linhas: linhas(['Só de julho', 'Brunner']) },
    { codigo: 'C2', nome: '2ª corrida', tracado: '6,5 HP', linhas: linhas(['Piloto 2']) }],
}, token);
const vj = await http('POST', '/api/ao-vivo/corridas-17-07/vincular', {}, token);
ok(vj.json.vinculados.find((x) => x.nome === 'Brunner').piloto_id === 1 && vj.json.vinculados.find((x) => x.nome === 'Piloto 2').piloto_id === idP2,
  'evento de julho: Brunner e Piloto 2 casam com os MESMOS cadastros da 3ª Copa');
ok((await http('PUT', '/api/ao-vivo/corridas-17-07/corrida/C2', { linhas: linhas(['Fulano']) }, token)).status === 400, 'folha de histórico com nome fora da lista = 400');
ok((await http('PUT', '/api/ao-vivo/copa-3/corrida/C2', { linhas: [] }, token)).status === 400, 'folha de histórico em evento que não é de corridas = 400');
const c2 = await http('PUT', '/api/ao-vivo/corridas-17-07/corrida/C2', { linhas: linhas(['Piloto 2', 'Brunner']) }, token);
ok(c2.status === 200, 'lança a folha que faltava numa corrida do histórico');
await http('PUT', '/api/ao-vivo/corridas-17-07/corrida/C2', { linhas: linhas(['Piloto 2']) }, token);
const rk = await http('GET', '/api/historico/ranking');
ok(rk.status === 200 && rk.json.eventos.length === 1 && rk.json.eventos[0].slug === 'corridas-17-07', 'ranking: só o evento que já correu (copa-3 ainda vazia)');
ok(rk.json.tabela[0].piloto === 'Só de julho' && rk.json.tabela.length === 3, 'ranking: vencedor de julho na frente');
const pp = await http('GET', `/api/historico/piloto/${idP2}`);
ok(pp.status === 200 && pp.json.numeros.corridas_disputadas === 1 && pp.json.numeros.vitorias === 1 && pp.json.piloto.foto_v, 'página do piloto: 1 corrida, 1 vitória, com foto');
ok(pp.json.piloto.nome === 'Piloto 2' || pp.json.piloto.nome === 'Piloto Dois da Silva', `página do piloto mostra o nome (${pp.json.piloto.nome})`);
ok(!JSON.stringify(pp.json).includes('98888') && !JSON.stringify(pp.json).includes('82.5'), 'página do piloto não vaza telefone nem peso');
const pl = await http('GET', '/api/historico/pilotos');
ok(pl.json.length === 29 && pl.json[0].piloto_id != null, `lista de pilotos: os 28 da copa + 1 só de julho (${pl.json.length})`);
await http('PUT', '/api/ao-vivo/copa-teste', { titulo: 'T', teste: true, formato: 'corridas', corridas_previstas: 1, pilotos: [{ nome: 'Fantasma' }], corridas: [{ codigo: 'X', nome: 'X', linhas: linhas(['Fantasma']) }] }, token);
ok(!(await http('GET', '/api/historico/ranking')).json.tabela.some((l) => l.piloto === 'Fantasma'), 'evento de teste não entra no ranking');
ok((await http('GET', '/api/config')).json.evento_atual === 'copa-3', 'config: evento atual = copa-3');

// ---------- ritmo, recordes, recorde do dia (GO 19/10/2026) ----------
// C1 com 3 pilotos: Só de julho 47.100 · Brunner 48.101 · Piloto 2 49.102 (6,5 HP)
await http('PUT', '/api/ao-vivo/corridas-17-07/corrida/C1', { linhas: linhas(['Só de julho', 'Brunner', 'Piloto 2']) }, token);
const rt = await http('GET', '/api/historico/ritmo');
ok(rt.status === 200 && rt.json.tabela[0].piloto === 'Só de julho' && rt.json.tabela[0].ritmo === 100, 'ritmo: o mais rápido da corrida = 100');
ok(rt.json.tabela.find((l) => l.piloto_id === 1)?.ritmo === 102.13, `ritmo: Brunner 48.101 / 47.100 = 102,13 (${rt.json.tabela.find((l) => l.piloto_id === 1)?.ritmo})`);
ok(!rt.json.tabela.some((l) => l.piloto === 'Fantasma'), 'ritmo: evento de teste não entra');
const rc = await http('GET', '/api/historico/recordes');
const hp = rc.json.find((x) => x.tracado === '6,5 HP');
ok(rc.status === 200 && hp?.recorde.piloto === 'Só de julho' && hp.recorde.mv_ms === 47100 && hp.top.length === 3, 'recordes: 6,5 HP = Só de julho 47.100, top 3');
const pr = await http('GET', '/api/historico/piloto/1');
ok(pr.json.numeros.rivais.find((x) => x.piloto === 'Só de julho')?.derrotas === 1 && pr.json.numeros.ritmo_medio === 102.13, 'piloto: rivais e ritmo médio na ficha');
ok((await http('GET', '/api/ao-vivo/copa-3')).json.recorde === null, 'quadro sem traçado definido: sem comparação de recorde');
ok((await http('PUT', '/api/ao-vivo/copa-3/tracado', { tracado: '6,5 HP' })).status === 401, 'traçado sem login = 401');
// evento de VERDADE (não teste): é o caso do dia 23 — a volta de hoje não pode virar o "recorde anterior" dela mesma
await http('PUT', '/api/ao-vivo/rec-teste', { titulo: 'R', pilotos: [{ nome: 'Rápido' }, { nome: 'Lento' }] }, token);
const tr = await http('PUT', '/api/ao-vivo/rec-teste/tracado', { tracado: '6,5 hp' }, token);
ok(tr.status === 200 && tr.json.tracado === '6,5 hp', 'traçado gravado');
const r0 = (await http('GET', '/api/ao-vivo/rec-teste')).json.recorde;
ok(r0.anterior?.mv_ms === 47100 && r0.quebrado === false && r0.hoje === null, 'recorde a bater aparece antes da 1ª volta (traçado sem diferença de maiúscula)');
await http('PUT', '/api/ao-vivo/rec-teste/sessao/FINAL', { linhas: [{ piloto: 'Rápido', pos: 1, mv: '00:47.200' }, { piloto: 'Lento', pos: 2, mv: '00:48.000' }] }, token);
ok((await http('GET', '/api/ao-vivo/rec-teste')).json.recorde.quebrado === false, '47.200 não bate 47.100');
await http('PUT', '/api/ao-vivo/rec-teste/sessao/FINAL', { linhas: [{ piloto: 'Rápido', pos: 1, mv: '00:46.900' }, { piloto: 'Lento', pos: 2, mv: '00:48.000' }] }, token);
const r1 = (await http('GET', '/api/ao-vivo/rec-teste')).json.recorde;
ok(r1.quebrado === true && r1.hoje.piloto === 'Rápido' && r1.anterior.mv_ms === 47100, 'RECORDE QUEBRADO: 46.900 < 47.100');
const rcDepois = (await http('GET', '/api/historico/recordes')).json;
ok(rcDepois.filter((x) => x.tracado.toLowerCase() === '6,5 hp').length === 1 && rcDepois.find((x) => x.tracado === '6,5 HP')?.recorde.mv_ms === 46900,
  'depois do dia, a volta nova vira o recorde — "6,5 hp" e "6,5 HP" são o mesmo traçado');

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO VERDE');
process.exit(falhas ? 1 : 0);
