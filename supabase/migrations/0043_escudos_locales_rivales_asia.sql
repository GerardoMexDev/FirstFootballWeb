-- ============================================================================
-- 0043 — Escudos locales de los 5 rivales asiáticos que ESPN no tiene (404). 2026-10-08.
-- Los consiguió Gerardo (WebFirst/escudos/); se pasaron a 300 px con transparencia y viven en
-- public/escudos/ (mismo criterio que al-faisaly.png, Sesión 6). Ids = clubes.id_externo de ESPN.
-- Con esto no queda ningún club sin escudo.
-- Reversible: update clubes set escudo_url = null where proveedor_externo = 'espn' and id_externo in (…).
-- ============================================================================
begin;

update clubes c
set escudo_url = v.ruta
from (values
  ('7129',  '/escudos/al-gharafa.png'),
  ('21575', '/escudos/al-shamal.png'),
  ('7530',  '/escudos/neftchi-fergana.png'),
  ('7123',  '/escudos/pakhtakor-tashkent.png'),
  ('790',   '/escudos/shabab-al-ahli.png')
) as v(id_externo, ruta)
where c.proveedor_externo = 'espn'
  and c.id_externo = v.id_externo
  and c.escudo_url is null;

commit;
