#!/usr/bin/env node
// Lança no quadro AO VIVO o que saiu da folha do kartódromo. A senha do admin entra por STDIN
// (pipe do cofre) e nunca vai pra argv nem pra log:
//   op read "op://AURORA/ADMIN_PASSWORD KART/password" | node tools/ao-vivo.mjs sessao copa-3 B1_A folha.json
// Comandos:
//   ver     <slug>                         imprime o quadro calculado (público, sem senha)
//   evento  <slug> <estado.json>           cria/atualiza título, horários, pilotos e grupos
//   tomada  <slug> <CODIGO> <folha.json>   lança a tomada de tempo da corrida (vira o grid)
//   sessao  <slug> <CODIGO> <folha.json> [status]   lança o resultado da corrida (nomes da folha são resolvidos)
//   status  <slug> <CODIGO> <status>       aguardando | ao_vivo | provisorio | homologado
//   vincular <slug>                        liga cada piloto do evento ao cadastro (cria quem não existe)
//   corrida <slug> <CODIGO> <folha.json>   folha de uma corrida em evento de histórico (formato 'corridas')
//   sorteio <slug> <ISO-com-fuso>          marca o sorteio dos grupos (ex.: 2026-10-20T20:00:00-03:00) · 'cancelar' cancela
//   aviso   <titulo> <texto.txt> [fixar]   publica no mural (o <slug> aqui é o título)
// folha.json: { "linhas": [{ "nome": "GABRIEL LANNA ALMEIDA", "pos": 1, "kart": 8, "mv": "00:48.485", "voltas": 18 }],
//               "observacoes": "..." }  — campos opcionais por linha: ausente, punicao (3 | "fim").
import fs from 'fs';
import { resolverNome, msParaVolta } from '../backend/src/aoVivo.js';

const BASE = process.env.KART_URL || 'https://kart-app-production.up.railway.app';
const [cmd, slug, ...resto] = process.argv.slice(2);

async function http(metodo, url, body, token) {
  const r = await fetch(BASE + url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  let json; try { json = JSON.parse(txt); } catch { json = { bruto: txt.slice(0, 200) }; }
  return { status: r.status, json };
}

async function token() {
  if (process.stdin.isTTY) throw new Error('senha do admin vem por stdin (pipe do op read)');
  let senha = '';
  for await (const c of process.stdin) senha += c;
  senha = senha.trim();
  const r = await http('POST', '/api/admin/login', { usuario: process.env.ADMIN_USER || 'admin', senha });
  if (r.status !== 200) throw new Error(`login recusado (${r.status})`);
  return r.json.token;
}

function imprimir(d, foco) {
  const q = d.quadro;
  console.log(`\n${d.evento.titulo} · versão ${d.versao} · em curso: ${q.em_curso || 'encerrado'}`);
  const sess = foco ? [q.sessoes[foco]] : Object.values(q.sessoes);
  for (const s of sess) {
    console.log(`\n[${s.codigo}] ${s.nome} — ${s.status}`);
    if (s.grid && !s.resultado.length) console.log('  grid:', s.grid.map((p, i) => `${i + 1}º ${p}`).join(' · '));
    if (s.tomada?.length) console.log('  tomada:', s.tomada.map((l) => `${l.pos_oficial}º ${l.piloto} ${msParaVolta(l.mv_ms) ?? ''}`).join(' · '));
    for (const l of s.resultado) {
      console.log(`  ${String(l.ausente ? '—' : l.pos_oficial).padStart(2)}  ${l.piloto.padEnd(22)} kart ${String(l.kart ?? '-').padStart(2)}  ${msParaVolta(l.mv_ms) ?? '   —   '}${l.pontos != null ? `  ${l.pontos} pts` : ''}${l.punicao ? `  (punido, cruzou ${l.pos_folha}º)` : ''}${l.ausente ? '  NÃO CORREU' : ''}`);
    }
  }
  const t = q.geral.tabela.filter((l) => l.correu);
  if (t.length) {
    console.log(`\nClassificação geral — menor soma vence (${q.geral.definido ? 'definida' : 'parcial'}):`);
    t.forEach((l) => console.log(`  ${String(l.pos).padStart(2)} ${l.vai_pra_final ? '→' : ' '} ${l.piloto.padEnd(22)} [${l.grupo}] ${String(l.total).padStart(2)} pts  mv ${msParaVolta(l.mv_baterias_ms) ?? '—'}${l.empate_sorteio ? '  EMPATE' : ''}`));
  }
  if (q.final.grid.length) console.log(`\nGrid da final${q.final.grid_pela_tomada ? ' (tomada de tempo)' : ' (provisório: ordem dos pontos até a tomada)'}: ${q.final.grid.map((l) => `${l.largada}º ${l.piloto}`).join(' · ')}`);
  if (q.final.podio.length) console.log(`Pódio${q.final.campeao ? '' : ' (provisório)'}: ${q.final.podio.map((p) => `${p.pos}º ${p.piloto}`).join(' · ')}`);
  if (q.melhor_volta_do_dia) console.log(`Melhor volta do dia: ${q.melhor_volta_do_dia.piloto} ${q.melhor_volta_do_dia.volta}`);
  q.avisos.forEach((a) => console.log(`⚠️  ${a}`));
}

async function main() {
  if (!cmd || !slug) throw new Error('uso: ver|evento|sessao|status <slug> ...');
  if (cmd === 'ver') {
    const r = await http('GET', `/api/ao-vivo/${slug}`);
    if (r.status !== 200) throw new Error(`leitura ${r.status}`);
    return imprimir(r.json, resto[0]);
  }
  if (cmd === 'evento') {
    const estado = JSON.parse(fs.readFileSync(resto[0], 'utf8'));
    const r = await http('PUT', `/api/ao-vivo/${slug}`, estado, await token());
    console.log(r.status, JSON.stringify(r.json));
    return;
  }
  if (cmd === 'status') {
    const [codigo, status] = resto;
    const r = await http('PUT', `/api/ao-vivo/${slug}/sessao/${codigo}`, { status }, await token());
    console.log(r.status, JSON.stringify(r.json));
    const v = await http('GET', `/api/ao-vivo/${slug}`);
    return imprimir(v.json, codigo);
  }
  if (cmd === 'vincular') {
    const r = await http('POST', `/api/ao-vivo/${slug}/vincular`, {}, await token());
    console.log(r.status, JSON.stringify(r.json, null, 1));
    return;
  }
  if (cmd === 'sorteio') {
    const t = await token();
    const r = resto[0] === 'cancelar'
      ? await http('DELETE', `/api/sorteio/${slug}`, null, t)
      : await http('POST', `/api/sorteio/${slug}`, { agendado_para: resto[0], ...(resto[1] ? { passo_ms: Number(resto[1]) } : {}) }, t);
    console.log(r.status, JSON.stringify(r.json));
    return;
  }
  if (cmd === 'aviso') {
    const r = await http('POST', '/api/avisos', { titulo: slug, texto: fs.readFileSync(resto[0], 'utf8').trim(), fixado: resto[1] === 'fixar' }, await token());
    console.log(r.status, JSON.stringify(r.json));
    return;
  }
  if (cmd === 'corrida') {
    const [codigo, arquivo] = resto;
    const folha = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    const atual = await http('GET', `/api/ao-vivo/${slug}`);
    const problemas = [];
    const linhas = folha.linhas.map((l) => {
      if (l.piloto) return l;
      const r = resolverNome(l.nome, atual.json.pilotos);
      if (r.piloto) return { ...l, piloto: r.piloto, nome_folha: l.nome };
      problemas.push(`"${l.nome}": ${r.ambiguo ? `ambíguo (${r.ambiguo.join(' / ')})` : 'não está na lista'}`);
      return l;
    });
    if (problemas.length) { problemas.forEach((p) => console.error('  ' + p)); process.exit(2); }
    const r = await http('PUT', `/api/ao-vivo/${slug}/corrida/${codigo}`, { linhas, se_versao: atual.json.versao,
      ...(folha.observacoes !== undefined ? { observacoes: folha.observacoes } : {}), ...(folha.tracado !== undefined ? { tracado: folha.tracado } : {}) }, await token());
    console.log(r.status, JSON.stringify(r.json));
    return;
  }
  if (cmd === 'sessao' || cmd === 'tomada') {
    const [codigo, arquivo, status] = resto;
    const folha = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    const atual = await http('GET', `/api/ao-vivo/${slug}`);
    if (atual.status !== 200) throw new Error(`evento ${slug}: ${atual.status}`);
    const problemas = [];
    const linhas = folha.linhas.map((l) => {
      if (l.piloto) return l;
      const r = resolverNome(l.nome, atual.json.pilotos);
      if (r.piloto) return { ...l, piloto: r.piloto, nome_folha: l.nome };
      problemas.push(`"${l.nome}": ${r.ambiguo ? `ambíguo (${r.ambiguo.join(' / ')})` : 'não está na lista'}`);
      return l;
    });
    if (problemas.length) {
      console.error('NADA LANÇADO — resolva estes nomes (alias no evento ou "piloto" na linha):');
      problemas.forEach((p) => console.error('  ' + p));
      process.exit(2);
    }
    const corpo = { ...(cmd === 'tomada' ? { tomada: linhas } : { linhas }), se_versao: atual.json.versao, ...(status && cmd === 'sessao' ? { status } : {}),
      ...(folha.observacoes !== undefined ? { observacoes: folha.observacoes } : {}) };
    const r = await http('PUT', `/api/ao-vivo/${slug}/sessao/${codigo}`, corpo, await token());
    console.log(r.status, JSON.stringify(r.json));
    if (r.status !== 200) process.exit(1);
    const v = await http('GET', `/api/ao-vivo/${slug}`);
    return imprimir(v.json, codigo);
  }
  throw new Error(`comando desconhecido: ${cmd}`);
}

main().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
