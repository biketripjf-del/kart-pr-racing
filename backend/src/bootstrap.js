import bcrypt from 'bcryptjs';
import { q } from './db.js';

// Executado no boot (idempotente): garante o admin e a etapa 1.
// Admin só é criado/atualizado se ADMIN_PASSWORD estiver no ambiente.
export async function ensureSeed() {
  try {
    if (process.env.ADMIN_PASSWORD) {
      const usuario = (process.env.ADMIN_USER || 'admin').toLowerCase();
      const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
      await q(
        `INSERT INTO admins (usuario, senha_hash) VALUES ($1,$2)
         ON CONFLICT (usuario) DO UPDATE SET senha_hash = EXCLUDED.senha_hash`,
        [usuario, hash]
      );
      console.log(`[bootstrap] admin "${usuario}" garantido.`);
    }
    const { rows } = await q('SELECT id FROM etapas WHERE numero = 1');
    if (!rows[0]) {
      await q(
        `INSERT INTO etapas (numero, nome, data, kartodromo, cidade, valor_centavos, status)
         VALUES (1, 'Etapa 1 — Volta Redonda', '2026-07-17',
                 'Kartódromo Internacional de Volta Redonda', 'Volta Redonda-RJ', 18000, 'agendada')`
      );
      console.log('[bootstrap] etapa 1 criada.');
    }
  } catch (e) {
    console.error('[bootstrap] falhou (segue subindo):', e.message);
  }
}
