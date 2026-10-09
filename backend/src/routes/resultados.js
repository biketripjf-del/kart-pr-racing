import { Router } from 'express';
import { q } from '../db.js';
import { exigirAdmin } from '../auth.js';
import { pontuarEtapa, msParaTempo } from '../scoring.js';
import { ah } from '../async.js';

const router = Router();

// admin: salva/atualiza o resultado de um piloto na etapa (upsert)
router.put('/:etapaId/:pilotoId', exigirAdmin, ah(async (req, res) => {
  const { posicao, melhor_volta_ms, num_voltas, pole, obs } = req.body || {};
  await q(
    `INSERT INTO resultados (etapa_id, piloto_id, posicao, melhor_volta_ms, num_voltas, pole, obs)
     VALUES ($1::int,$2::int,$3::int,$4::int,$5::int,$6::boolean,$7)
     ON CONFLICT (etapa_id, piloto_id) DO UPDATE SET
       posicao = EXCLUDED.posicao,
       melhor_volta_ms = EXCLUDED.melhor_volta_ms,
       num_voltas = EXCLUDED.num_voltas,
       pole = EXCLUDED.pole,
       obs = EXCLUDED.obs`,
    [req.params.etapaId, req.params.pilotoId, posicao ?? null, melhor_volta_ms ?? null,
     num_voltas ?? null, !!pole, obs || null]
  );
  // garante inscrição
  await q(
    `INSERT INTO inscricoes (etapa_id, piloto_id, valor_centavos)
     SELECT $1::int, $2::int, valor_centavos FROM etapas WHERE id = $1::int
     ON CONFLICT (etapa_id, piloto_id) DO NOTHING`,
    [req.params.etapaId, req.params.pilotoId]
  );
  res.json({ ok: true });
}));

router.delete('/:etapaId/:pilotoId', exigirAdmin, ah(async (req, res) => {
  await q('DELETE FROM resultados WHERE etapa_id = $1 AND piloto_id = $2', [req.params.etapaId, req.params.pilotoId]);
  res.json({ ok: true });
}));

// pública: resultado completo de uma etapa (classificação + pontos + destaques)
router.get('/etapa/:etapaId', ah(async (req, res) => {
  const { rows: etapaRows } = await q('SELECT * FROM etapas WHERE id = $1', [req.params.etapaId]);
  if (!etapaRows[0]) return res.status(404).json({ erro: 'etapa_nao_encontrada' });

  const { rows } = await q(
    `SELECT r.*, p.nome, p.apelido, p.peso_kg
     FROM resultados r JOIN pilotos p ON p.id = r.piloto_id
     WHERE r.etapa_id = $1
     ORDER BY r.posicao NULLS LAST`,
    [req.params.etapaId]
  );

  const pontuados = pontuarEtapa(rows.map((r) => ({
    piloto_id: r.piloto_id, etapa_id: r.etapa_id, posicao: r.posicao,
    melhor_volta_ms: r.melhor_volta_ms, pole: r.pole,
  })));
  const mapaPontos = new Map(pontuados.map((p) => [p.piloto_id, p]));

  const classificacao = rows.map((r) => {
    const pt = mapaPontos.get(r.piloto_id) || {};
    return {
      piloto_id: r.piloto_id,
      nome: r.nome, apelido: r.apelido, peso_kg: r.peso_kg,
      posicao: r.posicao,
      melhor_volta_ms: r.melhor_volta_ms,
      melhor_volta: msParaTempo(r.melhor_volta_ms),
      num_voltas: r.num_voltas,
      pole: r.pole,
      pontos: pt.pontos || 0,
      bonus: pt.bonus || 0,
      melhor_volta_da_etapa: !!pt.melhor_volta_da_etapa,
    };
  });

  res.json({ etapa: etapaRows[0], classificacao });
}));

export default router;
