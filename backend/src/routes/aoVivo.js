import { Router } from 'express';
import { q } from '../db.js';
import { exigirAdmin } from '../auth.js';
import { ah } from '../async.js';
import { calcularQuadro, validarSessao, SESSOES, STATUS } from '../aoVivo.js';

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
  const novo = { ...estado, sessoes: estado.sessoes || atual?.estado?.sessoes || {} };
  const { rows } = await q(
    `INSERT INTO ao_vivo (slug, estado) VALUES ($1, $2::jsonb)
     ON CONFLICT (slug) DO UPDATE SET estado = EXCLUDED.estado, versao = ao_vivo.versao + 1, atualizado_em = now()
     RETURNING versao`,
    [req.params.slug, JSON.stringify(novo)]
  );
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
