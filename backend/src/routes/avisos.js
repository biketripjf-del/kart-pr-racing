// Mural de notícias e avisos (pedido do Brunner 14/10/2026). Leitura pública; escrita só do admin.
import { Router } from 'express';
import Joi from 'joi';
import { q } from '../db.js';
import { exigirAdmin } from '../auth.js';
import { ah } from '../async.js';

const router = Router();
const schema = Joi.object({
  titulo: Joi.string().trim().min(2).max(120).required(),
  texto: Joi.string().trim().min(1).max(4000).required(),
  fixado: Joi.boolean().default(false),
});

router.get('/', ah(async (req, res) => {
  const { rows } = await q('SELECT id, titulo, texto, fixado, criado_em FROM avisos ORDER BY fixado DESC, criado_em DESC, id DESC LIMIT 50');
  res.set('Cache-Control', 'no-store');
  res.json(rows);
}));

router.post('/', exigirAdmin, ah(async (req, res) => {
  const { error, value } = schema.validate(req.body || {}, { stripUnknown: true });
  if (error) return res.status(400).json({ erro: 'dados_invalidos', detalhe: error.message });
  const { rows } = await q('INSERT INTO avisos (titulo, texto, fixado) VALUES ($1,$2,$3) RETURNING *', [value.titulo, value.texto, value.fixado]);
  res.status(201).json(rows[0]);
}));

router.patch('/:id', exigirAdmin, ah(async (req, res) => {
  const { error, value } = schema.fork(['titulo', 'texto'], (s) => s.optional()).validate(req.body || {}, { stripUnknown: true });
  if (error) return res.status(400).json({ erro: 'dados_invalidos', detalhe: error.message });
  const sets = []; const vals = [];
  for (const c of ['titulo', 'texto', 'fixado']) if (c in (req.body || {})) { vals.push(value[c]); sets.push(`${c} = $${vals.length}`); }
  if (!sets.length) return res.status(400).json({ erro: 'nada_pra_atualizar' });
  vals.push(req.params.id);
  const { rows } = await q(`UPDATE avisos SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
  if (!rows[0]) return res.status(404).json({ erro: 'nao_encontrado' });
  res.json(rows[0]);
}));

router.delete('/:id', exigirAdmin, ah(async (req, res) => {
  const { rowCount } = await q('DELETE FROM avisos WHERE id = $1', [req.params.id]);
  res.status(rowCount ? 200 : 404).json({ ok: !!rowCount });
}));

export default router;
