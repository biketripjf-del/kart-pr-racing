// Regras de pontuação da P&R Racing Cup (configuráveis).
// Pontuação estilo F1 por posição + bônus.

export const PONTOS_POR_POSICAO = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const BONUS_MELHOR_VOLTA = 1;
export const BONUS_POLE = 1;
// Descarte da(s) pior(es) etapa(s) no ranking anual (0 = não descarta).
export const DESCARTES = 1;

export function pontosDaPosicao(posicao) {
  if (!posicao || posicao < 1) return 0;
  return PONTOS_POR_POSICAO[posicao - 1] || 0;
}

// resultados: [{ piloto_id, etapa_id, posicao, melhor_volta_ms, pole }]
// Retorna pontos por etapa por piloto, aplicando bônus de melhor volta da etapa.
export function pontuarEtapa(resultados) {
  // melhor volta da etapa (menor melhor_volta_ms)
  let melhorVoltaPilotoId = null;
  let melhorVoltaMs = Infinity;
  for (const r of resultados) {
    if (r.melhor_volta_ms != null && r.melhor_volta_ms < melhorVoltaMs) {
      melhorVoltaMs = r.melhor_volta_ms;
      melhorVoltaPilotoId = r.piloto_id;
    }
  }
  return resultados.map((r) => {
    let pts = pontosDaPosicao(r.posicao);
    let bonus = 0;
    if (r.piloto_id === melhorVoltaPilotoId) bonus += BONUS_MELHOR_VOLTA;
    if (r.pole) bonus += BONUS_POLE;
    return {
      piloto_id: r.piloto_id,
      etapa_id: r.etapa_id,
      posicao: r.posicao,
      pontos_posicao: pts,
      bonus,
      pontos: pts + bonus,
      melhor_volta_da_etapa: r.piloto_id === melhorVoltaPilotoId,
    };
  });
}

// Ranking anual: soma pontos por piloto descartando as N piores etapas.
// entradas: [{ piloto_id, etapa_id, pontos }]
export function rankingAnual(entradas, descartes = DESCARTES) {
  const porPiloto = new Map();
  for (const e of entradas) {
    if (!porPiloto.has(e.piloto_id)) porPiloto.set(e.piloto_id, []);
    porPiloto.get(e.piloto_id).push(e.pontos);
  }
  const linhas = [];
  for (const [piloto_id, pontosList] of porPiloto) {
    const ordenado = [...pontosList].sort((a, b) => a - b); // menor primeiro
    const total = pontosList.reduce((s, p) => s + p, 0);
    const descartados = descartes > 0 ? ordenado.slice(0, descartes) : [];
    const somaDescartada = descartados.reduce((s, p) => s + p, 0);
    linhas.push({
      piloto_id,
      etapas_disputadas: pontosList.length,
      pontos_totais: total,
      pontos_descartados: somaDescartada,
      pontos_liquidos: total - (pontosList.length > descartes ? somaDescartada : 0),
    });
  }
  linhas.sort((a, b) => b.pontos_liquidos - a.pontos_liquidos);
  return linhas.map((l, i) => ({ posicao: i + 1, ...l }));
}

// "hh:mm:ss.mmm" / "mm:ss.mmm" / "ss.mmm" -> ms. Retorna null se vazio.
export function tempoParaMs(str) {
  if (!str) return null;
  const s = String(str).trim().replace(',', '.');
  if (!s) return null;
  const partes = s.split(':').map((p) => parseFloat(p));
  if (partes.some((n) => Number.isNaN(n))) return null;
  let ms = 0;
  if (partes.length === 3) ms = ((partes[0] * 60 + partes[1]) * 60 + partes[2]) * 1000;
  else if (partes.length === 2) ms = (partes[0] * 60 + partes[1]) * 1000;
  else ms = partes[0] * 1000;
  return Math.round(ms);
}

export function msParaTempo(ms) {
  if (ms == null) return null;
  const totalSeg = ms / 1000;
  const min = Math.floor(totalSeg / 60);
  const seg = (totalSeg - min * 60).toFixed(3);
  return `${min}:${seg.padStart(6, '0')}`;
}
