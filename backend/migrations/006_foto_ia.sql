-- Brunner 22/10/2026: "o piloto joga a foto dele e transformamos nele vestido de piloto nesse padrão" — 1 geração
-- por piloto ("maximo de 1 para cada"). foto_ia_em marca que ele já gastou a dele; foto_ia guarda o resultado pra
-- não perder a única tentativa se ele fechar o app antes de usar.
ALTER TABLE pilotos ADD COLUMN IF NOT EXISTS foto_ia_em TIMESTAMPTZ;
ALTER TABLE pilotos ADD COLUMN IF NOT EXISTS foto_ia TEXT;
