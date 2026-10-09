import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import adminRoutes from './routes/admin.js';
import pilotosRoutes from './routes/pilotos.js';
import etapasRoutes from './routes/etapas.js';
import resultadosRoutes from './routes/resultados.js';
import rankingRoutes from './routes/ranking.js';
import { ensureSeed } from './bootstrap.js';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));

// `commit` = o que está no ar de verdade (a Railway injeta o SHA no deploy); fora dela vem null.
const COMMIT = (process.env.RAILWAY_GIT_COMMIT_SHA || '').slice(0, 7) || null;
app.get('/api/health', (req, res) => res.json({ ok: true, servico: 'pr-racing-cup', commit: COMMIT }));

app.use('/api/admin', adminRoutes);
app.use('/api/pilotos', pilotosRoutes);
app.use('/api/etapas', etapasRoutes);
app.use('/api/resultados', resultadosRoutes);
app.use('/api/ranking', rankingRoutes);

// erro genérico (evita vazar stack)
app.use((err, req, res, next) => {
  console.error('[erro]', err.message);
  res.status(500).json({ erro: 'erro_interno' });
});

// serve o frontend buildado (deploy single-service)
const distDir = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ erro: 'nao_encontrado' });
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

const PORT = process.env.PORT || 4000;
ensureSeed().finally(() => {
  app.listen(PORT, () => console.log(`P&R Racing Cup no ar na porta ${PORT}`));
});
