-- Brunner 14/10/2026 21:43 BRT: "a ficha do piloto nao pode ser publica (...) talvez um link que a pessoa gere e
-- click". Cada piloto tem um LINK PESSOAL (token secreto); quem abre o link uma vez fica reconhecido no celular
-- (ficha, caronas). O token é trocável pelo admin se vazar.
ALTER TABLE pilotos ADD COLUMN IF NOT EXISTS ficha_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS pilotos_ficha_token_uq ON pilotos (ficha_token);

-- caronas pro deslocamento JF → Volta Redonda (msg do Emmanuel 14/10: "serão sugeridos grupos para o deslocamento")
CREATE TABLE IF NOT EXISTS caronas (
  id            SERIAL PRIMARY KEY,
  evento        TEXT NOT NULL,
  motorista_id  INTEGER NOT NULL,
  vagas         INTEGER NOT NULL,
  saida_local   TEXT,
  saida_hora    TEXT,
  obs           TEXT,
  criado_em     TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS carona_passageiros (
  carona_id  INTEGER NOT NULL,
  piloto_id  INTEGER NOT NULL,
  criado_em  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (carona_id, piloto_id)
);
