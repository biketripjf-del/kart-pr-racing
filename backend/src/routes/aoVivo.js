import { Router } from 'express';
import { q } from '../db.js';
import { exigirAdmin } from '../auth.js';
import { ah } from '../async.js';
import { calcularQuadro, validarSessao, normalizar, SESSOES, STATUS } from '../aoVivo.js';

const router = Router();
const CODIGOS = new Set(SESSOES.map((s) => s.codigo));

async function lerEstado(slug) {
  const { rows } = await q('SELECT estado, versao, atualizado_em FROM ao_vivo WHERE slug = $1', [slug]);
  return rows[0] || null;
}

// pública: o quadro calculado (é o que a página /ao-vivo lê de 15 em 15 s)
router.get('/:slug', ah(async (req, res) => {
  const linha = await lerEstado(req.params.slug);
  if (!linha) return res.status(404).json({ erro: 'evento_nao_encontrado' });
  const { estado } = linha;
  res.set('Cache-Control', 'no-store');
  res.json({
    evento: {
      titulo: estado.titulo, subtitulo: estado.subtitulo || null, data: estado.data,
      local: estado.local || null, horarios: estado.horarios || {}, regulamento: estado.regulamento || null,
    },
    pilotos: estado.pilotos || [],
    versao: linha.versao,
    atualizado_em: linha.atualizado_em,
    quadro: calcularQuadro(estado),
  });
}));

// admin: estado inteiro (cria o evento ou troca pilotos/grupos/horários)
router.put('/:slug', exigirAdmin, ah(async (req, res) => {
  const estado = req.body || {};
  if (!estado.titulo || !Array.isArray(estado.pilotos)) return res.status(400).json({ erro: 'faltam_titulo_ou_pilotos' });
  const nomes = estado.pilotos.map((p) => p.nome);
  if (new Set(nomes).size !== nomes.length) return res.status(400).json({ erro: 'piloto_repetido' });
  const atual = await lerEstado(req.params.slug);
  // o vínculo com o cadastro (piloto_id) e o grupo sorteado não se perdem quando o estado vem de um arquivo antigo
  const antes = new Map((atual?.estado?.pilotos || []).map((p) => [p.nome, p]));
  const pilotos = estado.pilotos.map((p) => ({
    ...p,
    piloto_id: p.piloto_id ?? antes.get(p.nome)?.piloto_id ?? undefined,
    grupo: p.grupo ?? antes.get(p.nome)?.grupo ?? null,
  }));
  const novo = { ...estado, pilotos, sessoes: estado.sessoes || atual?.estado?.sessoes || {}, corridas: estado.corridas || atual?.estado?.corridas };
  const { rows } = await q(
    `INSERT INTO ao_vivo (slug, estado) VALUES ($1, $2::jsonb)
     ON CONFLICT (slug) DO UPDATE SET estado = EXCLUDED.estado, versao = ao_vivo.versao + 1, atualizado_em = now()
     RETURNING versao`,
    [req.params.slug, JSON.stringify(novo)]
  );
  res.json({ ok: true, versao: rows[0].versao });
}));

// admin: liga cada piloto do evento ao cadastro (pilotos.id). Casa por nome/apelido do evento contra nome e
// apelido do cadastro; quem não casa ganha cadastro novo. É o id que junta o mesmo piloto em eventos diferentes.
router.post('/:slug/vincular', exigirAdmin, ah(async (req, res) => {
  const atual = await lerEstado(req.params.slug);
  if (!atual) return res.status(404).json({ erro: 'evento_nao_encontrado' });
  const { rows: cad } = await q('SELECT id, nome, apelido FROM pilotos WHERE ativo');
  // 1º casa pelo nome usado nos OUTROS eventos (o piloto pode ter trocado o nome do cadastro na ficha);
  // depois pelo nome/apelido do cadastro
  const { rows: outros } = await q('SELECT estado FROM ao_vivo WHERE slug <> $1', [req.params.slug]);
  const jaUsado = new Map();
  for (const o of outros) for (const p of o.estado.pilotos || []) {
    if (p.piloto_id == null) continue;
    for (const k of [p.nome, ...(p.aliases || [])].map(normalizar)) (jaUsado.get(k) || jaUsado.set(k, new Set()).get(k)).add(p.piloto_id);
  }
  const relatorio = [];
  const pilotos = [];
  for (const p of atual.estado.pilotos || []) {
    if (p.piloto_id != null) { pilotos.push(p); continue; }
    const chaves = [p.nome, ...(p.aliases || [])].map(normalizar);
    const porEvento = new Set(chaves.flatMap((k) => [...(jaUsado.get(k) || [])]));
    const achados = porEvento.size ? [...porEvento].map((id) => ({ id }))
      : cad.filter((c) => chaves.includes(normalizar(c.nome)) || (c.apelido && chaves.includes(normalizar(c.apelido))));
    if (achados.length > 1) return res.status(409).json({ erro: 'nome_ambiguo', piloto: p.nome, candidatos: achados.map((c) => c.id) });
    let id = achados[0]?.id;
    if (id == null) {
      const { rows } = await q('INSERT INTO pilotos (nome) VALUES ($1) RETURNING id, nome, apelido', [p.nome]);
      id = rows[0].id; cad.push(rows[0]);
      relatorio.push({ nome: p.nome, piloto_id: id, criado: true });
    } else relatorio.push({ nome: p.nome, piloto_id: id, criado: false });
    pilotos.push({ ...p, piloto_id: id });
  }
  const { rows } = await q(
    `UPDATE ao_vivo SET estado = $2::jsonb, versao = versao + 1, atualizado_em = now() WHERE slug = $1 AND versao = $3 RETURNING versao`,
    [req.params.slug, JSON.stringify({ ...atual.estado, pilotos }), atual.versao]
  );
  if (!rows[0]) return res.status(409).json({ erro: 'versao_mudou' });
  res.json({ ok: true, versao: rows[0].versao, vinculados: relatorio });
}));

// admin: folha de uma corrida num evento formato 'corridas' (histórico, ex.: 17/07)
router.put('/:slug/corrida/:codigo', exigirAdmin, ah(async (req, res) => {
  const atual = await lerEstado(req.params.slug);
  if (!atual) return res.status(404).json({ erro: 'evento_nao_encontrado' });
  if (atual.estado.formato !== 'corridas') return res.status(400).json({ erro: 'evento_nao_e_de_corridas' });
  const { linhas, observacoes, tracado, se_versao } = req.body || {};
  if (se_versao != null && Number(se_versao) !== atual.versao) return res.status(409).json({ erro: 'versao_mudou', versao: atual.versao });
  const erros = validarSessao(linhas || [], atual.estado.pilotos || []);
  if (erros.length) return res.status(400).json({ erro: 'folha_invalida', detalhes: erros });
  const corridas = atual.estado.corridas || [];
  if (!corridas.some((c) => c.codigo === req.params.codigo)) return res.status(404).json({ erro: 'corrida_nao_encontrada' });
  const novas = corridas.map((c) => (c.codigo === req.params.codigo ? {
    ...c, linhas, ...(observacoes !== undefined ? { observacoes } : {}), ...(tracado !== undefined ? { tracado } : {}),
  } : c));
  const { rows } = await q(
    `UPDATE ao_vivo SET estado = $2::jsonb, versao = versao + 1, atualizado_em = now() WHERE slug = $1 AND versao = $3 RETURNING versao`,
    [req.params.slug, JSON.stringify({ ...atual.estado, corridas: novas }), atual.versao]
  );
  if (!rows[0]) return res.status(409).json({ erro: 'versao_mudou' });
  res.json({ ok: true, versao: rows[0].versao });
}));

// admin: a folha de UMA corrida (o que sai da foto) e/ou a tomada de tempo dela (`tomada`, dá o grid). `se_versao` evita sobrescrever lançamento alheio.
router.put('/:slug/sessao/:codigo', exigirAdmin, ah(async (req, res) => {
  const { codigo, slug } = req.params;
  if (!CODIGOS.has(codigo)) return res.status(400).json({ erro: 'sessao_invalida' });
  const { linhas, tomada, status, observacoes, foto, se_versao } = req.body || {};
  if (status && !STATUS.includes(status)) return res.status(400).json({ erro: 'status_invalido' });
  const atual = await lerEstado(slug);
  if (!atual) return res.status(404).json({ erro: 'evento_nao_encontrado' });
  if (se_versao != null && Number(se_versao) !== atual.versao) {
    return res.status(409).json({ erro: 'versao_mudou', versao: atual.versao });
  }
  const anterior = atual.estado.sessoes?.[codigo] || {};
  const novasLinhas = linhas ?? anterior.linhas ?? [];
  const novaTomada = tomada ?? anterior.tomada ?? [];
  const erros = [
    ...validarSessao(novasLinhas, atual.estado.pilotos || []),
    ...validarSessao(novaTomada, atual.estado.pilotos || []).map((e) => `tomada de tempo: ${e}`),
  ];
  if (erros.length) return res.status(400).json({ erro: 'folha_invalida', detalhes: erros });
  const sessao = {
    ...anterior,
    linhas: novasLinhas,
    tomada: novaTomada,
    status: status || anterior.status || (novasLinhas.length ? 'provisorio' : 'aguardando'),
    ...(observacoes !== undefined ? { observacoes } : {}),
    ...(foto !== undefined ? { foto } : {}),
    atualizado_em: new Date().toISOString(),
  };
  const estado = { ...atual.estado, sessoes: { ...(atual.estado.sessoes || {}), [codigo]: sessao } };
  const { rows } = await q(
    `UPDATE ao_vivo SET estado = $2::jsonb, versao = versao + 1, atualizado_em = now()
     WHERE slug = $1 AND versao = $3 RETURNING versao`,
    [slug, JSON.stringify(estado), atual.versao]
  );
  if (!rows[0]) return res.status(409).json({ erro: 'versao_mudou' });
  res.json({ ok: true, versao: rows[0].versao });
}));

export default router;
