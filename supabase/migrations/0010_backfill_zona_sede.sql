-- ============================================================================
-- Football First — Migración 0010: backfill de la zona horaria de la sede
--
-- `sync-partidos` ponía `zona_horaria_evento` = zona del club LOCAL. Nuestros 6
-- clubes la tienen (seed); un rival descubierto por la API, no → los partidos de
-- VISITANTE quedaban con `zona_horaria_evento` NULL y la tarjeta no mostraba la
-- hora local (la agencia la necesita para los pósters).
--
-- A partir de ahora `sync-partidos` deriva la zona del PAÍS de la competencia
-- (`_shared/zona-pais.ts`) y, para las copas continentales, de `GET /venues`.
-- Esta migración hace el backfill de una vez para los partidos ya sincronizados,
-- usando el país de la competencia (cubre todas las ligas domésticas).
-- ============================================================================

begin;

update partidos p
set zona_horaria_evento = case c.pais
  when 'México'          then 'America/Mexico_City'
  when 'Brasil'          then 'America/Sao_Paulo'
  when 'Chile'           then 'America/Santiago'
  when 'Bélgica'         then 'Europe/Brussels'
  when 'Arabia Saudita'  then 'Asia/Riyadh'
  when 'Uruguay'         then 'America/Montevideo'
end
from competencias c
where p.competencia_id = c.id
  and p.zona_horaria_evento is null
  and c.pais in ('México', 'Brasil', 'Chile', 'Bélgica', 'Arabia Saudita', 'Uruguay');

commit;
