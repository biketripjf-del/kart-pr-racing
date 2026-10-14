-- Quadro AO VIVO do dia de corrida (3ª Copa, 23/10/2026): 1 linha por evento, estado inteiro em JSONB
-- (pilotos do dia + folha de cada sessão). O cálculo (pontos, grids, corte, final) é feito na
-- leitura por src/aoVivo.js — o banco guarda só o que saiu da folha do kartódromo.
CREATE TABLE IF NOT EXISTS ao_vivo (
  slug          TEXT PRIMARY KEY,
  estado        JSONB NOT NULL,
  versao        INTEGER NOT NULL DEFAULT 1,
  atualizado_em TIMESTAMPTZ DEFAULT now()
);
