import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const files = fs.readdirSync(__dirname)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(__dirname, f), 'utf8');
    process.stdout.write(`→ ${f} ... `);
    await pool.query(sql);
    console.log('ok');
  }
  await pool.end();
  console.log('migrations aplicadas.');
}

run().catch((e) => { console.error(e); process.exit(1); });
