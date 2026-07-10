import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

let pool;

if (process.env.USE_PGMEM === '1') {
  // Postgres em memória (só para smoke test local — não usado em produção)
  const { newDb } = await import('pg-mem');
  const mem = newDb();
  mem.public.registerFunction({ name: 'now', returns: 'timestamptz', implementation: () => new Date() });
  const adapter = mem.adapters.createPg();
  pool = new adapter.Pool();
} else {
  // SSL só quando o host exige (Railway/hosts gerenciados). Local = sem SSL.
  const useSsl = /sslmode=require/.test(process.env.DATABASE_URL || '') ||
    process.env.PGSSL === '1';
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max: 8,
  });
}

export { pool };
export const q = (text, params) => pool.query(text, params);
