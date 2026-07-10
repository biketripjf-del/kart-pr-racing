import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Em produção o JWT_SECRET vem do ambiente. Em dev, gera uma chave efêmera
// (tokens não sobrevivem a restart, aceitável localmente).
let chaveJwt = process.env.JWT_SECRET;
if (!chaveJwt) {
  chaveJwt = crypto.randomBytes(32).toString('hex');
  console.warn('[auth] JWT_SECRET ausente — usando chave efêmera (defina JWT_SECRET em producao).');
}

export function assinarToken(admin) {
  return jwt.sign({ id: admin.id, usuario: admin.usuario }, chaveJwt, { expiresIn: '30d' });
}

export function exigirAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ erro: 'nao_autenticado' });
  try {
    req.admin = jwt.verify(token, chaveJwt);
    next();
  } catch {
    return res.status(401).json({ erro: 'token_invalido' });
  }
}
