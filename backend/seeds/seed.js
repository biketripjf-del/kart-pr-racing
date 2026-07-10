// Seed inicial: admin + etapa 1 (17/07/2026, Volta Redonda).
// Admin: usuário e senha vêm do ambiente (ADMIN_USER / ADMIN_PASSWORD).
// Nunca commitar senha — em produção defina as variáveis no host.
import bcrypt from 'bcryptjs';
import { pool, q } from '../src/db.js';

async function seed() {
  const usuario = (process.env.ADMIN_USER || 'admin').toLowerCase();
  const senha = process.env.ADMIN_PASSWORD;
  if (!senha) {
    console.error('Defina ADMIN_PASSWORD no ambiente antes de rodar o seed.');
    process.exit(1);
  }
  const hash = await bcrypt.hash(senha, 10);
  await q(
    `INSERT INTO admins (usuario, senha_hash) VALUES ($1, $2)
     ON CONFLICT (usuario) DO UPDATE SET senha_hash = EXCLUDED.senha_hash`,
    [usuario, hash]
  );
  console.log(`admin "${usuario}" pronto.`);

  // Etapa 1 — só cria se ainda não existir
  const { rows } = await q('SELECT id FROM etapas WHERE numero = 1');
  if (!rows[0]) {
    await q(
      `INSERT INTO etapas (numero, nome, data, kartodromo, cidade, valor_centavos, status)
       VALUES (1, 'Etapa 1 — Volta Redonda', '2026-07-17',
               'Kartódromo Internacional de Volta Redonda', 'Volta Redonda-RJ', 18000, 'agendada')`
    );
    console.log('etapa 1 criada (17/07/2026, Volta Redonda).');
  } else {
    console.log('etapa 1 já existia.');
  }

  await pool.end();
  console.log('seed concluído.');
}

seed().catch((e) => { console.error(e); process.exit(1); });
