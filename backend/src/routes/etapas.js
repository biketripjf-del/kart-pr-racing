import { Router } from 'express';
import { q } from '../db.js';
import { exigirAdmin } from '../auth.js';

const router = Router();

// pública: lista de etapas (pra tela de cadastro saber a próxima etapa)
router.get('/', async (req, res) => {
  const { rows } = await q('SELECT id, numero, nome, data, kartodromo, cidade, valor_centavos, status FROM etapas ORDER BY numero');
  res.json(rows);
});

// pública: próxima etapa agendada
router.get('/proxima', async (req, res) => {
  const { rows } = await q(
    `SELECT id, numero, nome, data, kartodromo, cidade, valor_centavos
     FROM etapas WHERE status = 'agendada' ORDER BY data ASC LIMIT 1`
  );
  res.json(rows[0] || null);
});

// admin: criar etapa
router.post('/', exigirAdmin, async (req, res) => {
  const { numero, nome, data, kartodromo, cidade, valor_centavos } = req.body || {};
  if (!numero || !nome || !data) return res.status(400).json({ erro: 'faltam_campos' });
  const { rows } = await q(
    `INSERT INTO etapas (numero, nome, data, kartodromo, cidade, valor_centavos)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6,18000)) RETURNING *`,
    [numero, nome, data, kartodromo || null, cidade || null, valor_centavos ?? null]
  );
  res.status(201).json(rows[0]);
});

router.patch('/:id', exigirAdmin, async (req, res) => {
  const campos = ['numero', 'nome', 'data', 'kartodromo', 'cidade', 'valor_centavos', 'status'];
  const sets = []; const vals = [];
  for (const c of campos) {
    if (c in (req.body || {})) { vals.push(req.body[c]); sets.push(`${c} = $${vals.length}`); }
  }
  if (!sets.length) return res.status(400).json({ erro: 'nada_pra_atualizar' });
  vals.push(req.params.id);
  const { rows } = await q(`UPDATE etapas SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
  if (!rows[0]) return res.status(404).json({ erro: 'nao_encontrado' });
  res.json(rows[0]);
});

// admin: inscritos de uma etapa (com status de pagamento e resultado)
router.get('/:id/inscritos', exigirAdmin, async (req, res) => {
  const { rows } = await q(
    `SELECT p.id AS piloto_id, p.nome, p.apelido, p.peso_kg,
            i.id AS inscricao_id, COALESCE(i.pago,false) AS pago, i.pago_em,
            r.posicao, r.melhor_volta_ms, r.num_voltas, r.pole
     FROM pilotos p
     LEFT JOIN inscricoes i ON i.piloto_id = p.id AND i.etapa_id = $1
     LEFT JOIN resultados r ON r.piloto_id = p.id AND r.etapa_id = $1
     WHERE p.ativo
     ORDER BY (i.id IS NULL), r.posicao NULLS LAST, p.nome`,
    [req.params.id]
  );
  res.json(rows);
});

// admin: inscrever / desinscrever piloto na etapa
router.post('/:id/inscritos/:pilotoId', exigirAdmin, async (req, res) => {
  await q(
    `INSERT INTO inscricoes (etapa_id, piloto_id, valor_centavos)
     SELECT $1::int, $2::int, valor_centavos FROM etapas WHERE id = $1::int
     ON CONFLICT (etapa_id, piloto_id) DO NOTHING`,
    [req.params.id, req.params.pilotoId]
  );
  res.json({ ok: true });
});

router.delete('/:id/inscritos/:pilotoId', exigirAdmin, async (req, res) => {
  await q('DELETE FROM inscricoes WHERE etapa_id = $1 AND piloto_id = $2', [req.params.id, req.params.pilotoId]);
  res.json({ ok: true });
});

// admin: marcar pagamento
router.patch('/:id/inscritos/:pilotoId/pagamento', exigirAdmin, async (req, res) => {
  const pago = !!(req.body && req.body.pago);
  await q(
    `INSERT INTO inscricoes (etapa_id, piloto_id, pago, pago_em, valor_centavos)
     SELECT $1::int, $2::int, $3::boolean, CASE WHEN $3::boolean THEN now() ELSE NULL END, valor_centavos FROM etapas WHERE id = $1::int
     ON CONFLICT (etapa_id, piloto_id)
       DO UPDATE SET pago = $3::boolean, pago_em = CASE WHEN $3::boolean THEN now() ELSE NULL END`,
    [req.params.id, req.params.pilotoId, pago]
  );
  res.json({ ok: true, pago });
});

export default router;
