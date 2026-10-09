import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { q } from '../db.js';
import { assinarToken, exigirAdmin } from '../auth.js';
import { ah } from '../async.js';

const router = Router();

router.post('/login', ah(async (req, res) => {
  const { usuario, senha } = req.body || {};
  if (!usuario || !senha) return res.status(400).json({ erro: 'faltam_campos' });
  const { rows } = await q('SELECT * FROM admins WHERE usuario = $1', [String(usuario).toLowerCase()]);
  const admin = rows[0];
  if (!admin) return res.status(401).json({ erro: 'credenciais_invalidas' });
  const ok = await bcrypt.compare(senha, admin.senha_hash);
  if (!ok) return res.status(401).json({ erro: 'credenciais_invalidas' });
  res.json({ token: assinarToken(admin), usuario: admin.usuario });
}));

router.get('/me', exigirAdmin, (req, res) => {
  res.json({ usuario: req.admin.usuario });
});

export default router;
