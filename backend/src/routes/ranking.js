import { Router } from 'express';
import { q } from '../db.js';
import { pontuarEtapa, rankingAnual } from '../scoring.js';
import { ah } from '../async.js';

const router = Router();

// pública: ranking anual do campeonato
router.get('/', ah(async (req, res) => {
  const ano = req.query.ano ? parseInt(req.query.ano, 10) : null;

  const { rows: etapas } = await q(
    `SELECT id, numero, nome, data FROM etapas
     WHERE status = 'realizada' ${ano ? 'AND EXTRACT(YEAR FROM data) = $1' : ''}
     ORDER BY numero`,
    ano ? [ano] : []
  );

  const { rows: resultados } = await q(
    `SELECT r.etapa_id, r.piloto_id, r.posicao, r.melhor_volta_ms, r.pole
     FROM resultados r
     JOIN etapas e ON e.id = r.etapa_id AND e.status = 'realizada'
     ${ano ? 'WHERE EXTRACT(YEAR FROM e.data) = $1' : ''}`,
    ano ? [ano] : []
  );

  // pontua etapa a etapa (bônus de melhor volta é por etapa)
  const porEtapa = new Map();
  for (const r of resultados) {
    if (!porEtapa.has(r.etapa_id)) porEtapa.set(r.etapa_id, []);
    porEtapa.get(r.etapa_id).push(r);
  }
  const entradas = [];
  for (const [, lista] of porEtapa) {
    for (const p of pontuarEtapa(lista)) {
      entradas.push({ piloto_id: p.piloto_id, etapa_id: p.etapa_id, pontos: p.pontos });
    }
  }

  const ranking = rankingAnual(entradas);

  // enriquece com nome do piloto
  const { rows: pilotos } = await q('SELECT id, nome, apelido FROM pilotos');
  const mapaP = new Map(pilotos.map((p) => [p.id, p]));
  const linhas = ranking.map((l) => ({
    ...l,
    nome: mapaP.get(l.piloto_id)?.nome || '—',
    apelido: mapaP.get(l.piloto_id)?.apelido || null,
  }));

  res.json({ etapas_realizadas: etapas, ranking: linhas });
}));

export default router;
