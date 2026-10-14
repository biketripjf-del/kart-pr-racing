-- Fotos e vídeos que os pilotos sobem no app (Brunner 14/10/2026 20:43 BRT: "cada um pudesse subir a midia que
-- criou. assim depois de tudo podemos juntar o material para o mkt"). O arquivo vai pro disco (volume /data);
-- aqui fica só o registro. `thumb` = miniatura jpeg em data URL feita no próprio celular.
CREATE TABLE IF NOT EXISTS midias (
  id         SERIAL PRIMARY KEY,
  evento     TEXT,
  piloto_id  INTEGER,
  autor      TEXT NOT NULL,
  tipo       TEXT NOT NULL,          -- foto | video
  mime       TEXT NOT NULL,
  nome_orig  TEXT,
  arquivo    TEXT NOT NULL,          -- nome no disco
  bytes      BIGINT NOT NULL DEFAULT 0,
  legenda    TEXT,
  thumb      TEXT,
  oculto     BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em  TIMESTAMPTZ DEFAULT now()
);
