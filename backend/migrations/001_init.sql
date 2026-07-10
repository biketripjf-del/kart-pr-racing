-- P&R Racing Cup — schema inicial
-- Campeonato de kart do escritório Pacheco & Reis Advogados.

CREATE TABLE IF NOT EXISTS pilotos (
  id              SERIAL PRIMARY KEY,
  nome            TEXT NOT NULL,
  apelido         TEXT,
  whatsapp        TEXT,
  data_nascimento DATE,
  peso_kg         NUMERIC(5,1),
  experiencia     TEXT CHECK (experiencia IN ('nunca','casual','frequente')),
  empresa         TEXT,               -- escritório/empresa do cliente
  indicado_por    TEXT,               -- quem trouxe (relacionamento)
  respostas       JSONB DEFAULT '{}', -- questionário extra pra cruzar em relatório
  consentimento   BOOLEAN DEFAULT FALSE,
  consentimento_em TIMESTAMPTZ,
  ativo           BOOLEAN DEFAULT TRUE,
  criado_em       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS etapas (
  id           SERIAL PRIMARY KEY,
  numero       INTEGER NOT NULL,
  nome         TEXT NOT NULL,
  data         DATE NOT NULL,
  kartodromo   TEXT,
  cidade       TEXT,
  valor_centavos INTEGER NOT NULL DEFAULT 18000, -- R$180 / 2 baterias
  status       TEXT NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada','realizada')),
  criado_em    TIMESTAMPTZ DEFAULT now()
);

-- inscrição de um piloto numa etapa + controle de pagamento
CREATE TABLE IF NOT EXISTS inscricoes (
  id          SERIAL PRIMARY KEY,
  etapa_id    INTEGER NOT NULL REFERENCES etapas(id) ON DELETE CASCADE,
  piloto_id   INTEGER NOT NULL REFERENCES pilotos(id) ON DELETE CASCADE,
  pago        BOOLEAN DEFAULT FALSE,
  pago_em     TIMESTAMPTZ,
  valor_centavos INTEGER,
  criado_em   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (etapa_id, piloto_id)
);

-- resultado de um piloto numa etapa
CREATE TABLE IF NOT EXISTS resultados (
  id             SERIAL PRIMARY KEY,
  etapa_id       INTEGER NOT NULL REFERENCES etapas(id) ON DELETE CASCADE,
  piloto_id      INTEGER NOT NULL REFERENCES pilotos(id) ON DELETE CASCADE,
  posicao        INTEGER,            -- posição de chegada
  melhor_volta_ms INTEGER,          -- melhor volta em milissegundos (null se não tiver)
  num_voltas     INTEGER,
  pole           BOOLEAN DEFAULT FALSE,
  obs            TEXT,
  criado_em      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (etapa_id, piloto_id)
);

CREATE TABLE IF NOT EXISTS admins (
  id        SERIAL PRIMARY KEY,
  usuario   TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inscricoes_etapa ON inscricoes(etapa_id);
CREATE INDEX IF NOT EXISTS idx_resultados_etapa ON resultados(etapa_id);
CREATE INDEX IF NOT EXISTS idx_resultados_piloto ON resultados(piloto_id);
