-- App completo antes da 3ª Copa (pedido do Brunner 14/10/2026 17:42 BRT): ficha do piloto com foto,
-- mural de avisos e sorteio dos grupos ao vivo. O histórico NÃO ganha tabela: sai dos eventos (`ao_vivo`),
-- e `pilotos.id` é a identidade que liga um piloto entre eventos (estado.pilotos[].piloto_id).

-- ficha do piloto (preenchida por ele em /ficha). Dados pessoais NÃO saem em rota pública.
ALTER TABLE pilotos ADD COLUMN IF NOT EXISTS altura_cm INTEGER;
ALTER TABLE pilotos ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE pilotos ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE pilotos ADD COLUMN IF NOT EXISTS emergencia_nome TEXT;
ALTER TABLE pilotos ADD COLUMN IF NOT EXISTS emergencia_tel TEXT;
ALTER TABLE pilotos ADD COLUMN IF NOT EXISTS tipo_sanguineo TEXT;
ALTER TABLE pilotos ADD COLUMN IF NOT EXISTS camiseta TEXT;
ALTER TABLE pilotos ADD COLUMN IF NOT EXISTS foto TEXT;            -- data URL jpeg (≤ 300 KB), já reduzida no celular
ALTER TABLE pilotos ADD COLUMN IF NOT EXISTS foto_em TIMESTAMPTZ;
ALTER TABLE pilotos ADD COLUMN IF NOT EXISTS ficha_em TIMESTAMPTZ;  -- null = ficha nunca preenchida

-- mural de notícias e avisos
CREATE TABLE IF NOT EXISTS avisos (
  id         SERIAL PRIMARY KEY,
  titulo     TEXT NOT NULL,
  texto      TEXT NOT NULL,
  fixado     BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em  TIMESTAMPTZ DEFAULT now()
);

-- sorteio dos grupos ao vivo. A ordem nasce no INÍCIO (semente aleatória gravada) e a revelação é
-- função do relógio: revelados = (agora - iniciado_em) / passo_ms. Ninguém precisa clicar.
CREATE TABLE IF NOT EXISTS sorteios (
  id             SERIAL PRIMARY KEY,
  evento         TEXT NOT NULL,                 -- slug do ao_vivo (copa-3)
  status         TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado','concluido','cancelado')),
  agendado_para  TIMESTAMPTZ NOT NULL,
  passo_ms       INTEGER NOT NULL DEFAULT 5000,
  cabecas        JSONB NOT NULL DEFAULT '[]',   -- nomes; vazio = sorteio puro (decisão de 14/10)
  semente        TEXT,
  participantes  JSONB,
  ordem          JSONB,                         -- [{ nome, grupo }] na ordem da revelação
  iniciado_em    TIMESTAMPTZ,
  concluido_em   TIMESTAMPTZ,
  aplicado       BOOLEAN NOT NULL DEFAULT FALSE, -- grupos já gravados no evento
  criado_em      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sorteios_evento ON sorteios(evento);
