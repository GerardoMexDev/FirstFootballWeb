-- ============================================================================
-- 0042 — Escudos de 12 clubes de API-Football que estaban sin escudo. 2026-10-05.
-- Todos verificados con HEAD → 200 en media.api-sports.io el 2026-10-05 (mismo CDN que el resto
-- de los clubes de API-Football). Los 5 de ESPN sin escudo (Al Gharafa, Al Shamal, Neftchi
-- Fergana, Pakhtakor Tashkent, Shabab Al-Ahli) los busca Gerardo → migración aparte.
-- Reversible: update clubes set escudo_url = null where proveedor_externo = 'api-football' and id_externo in (…).
-- ============================================================================
begin;

update clubes
set escudo_url = 'https://media.api-sports.io/football/teams/' || id_externo || '.png'
where proveedor_externo = 'api-football'
  and escudo_url is null
  and id_externo in ('2934', '2292', '2360', '132', '120', '631', '5635', '2378', '2872', '2363', '2329', '205');

commit;
