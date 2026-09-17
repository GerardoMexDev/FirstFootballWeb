-- ============================================================================
-- Football First — Migración 0023: links de Dropbox por jugador (Fotografías / Match Day)
--
-- Pedido de la agencia 2026-09-17: los dos botones nuevos de la ficha de jugador
-- ("Fotografías" / "Match Day", agregados como placeholder sobre esta misma sesión) necesitan
-- un link de Dropbox por jugador — una carpeta con las fotos crudas, otra con los diseños ya
-- terminados. Datos manuales del mismo Excel de siempre (pestañas nuevas "Dropbox Fotografias"
-- / "Dropbox MatchDay"), cargados por `scripts/seed-datos-manuales.mjs`.
--
-- Aditiva y reversible: dos columnas nuevas en `jugadores`, nullable (cero invenciones — sin
-- link, el botón queda inerte). Reversión: `alter table jugadores drop column
-- dropbox_fotografias_url, drop column dropbox_matchday_url`.
-- ============================================================================

begin;

alter table jugadores
  add column dropbox_fotografias_url text,
  add column dropbox_matchday_url text;

comment on column jugadores.dropbox_fotografias_url is
  'Link a la carpeta de Dropbox con las fotos crudas del jugador (botón "Fotografías" de la ficha). Manual, del Excel.';
comment on column jugadores.dropbox_matchday_url is
  'Link a la carpeta de Dropbox con los diseños de Match Day ya terminados del jugador (botón "Match Day" de la ficha). Manual, del Excel.';

commit;
