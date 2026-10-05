-- ============================================================================
-- 0041 — Escudos de rivales de ESPN + amistosos de clubes. 2026-10-05.
-- 1) Escudos: Gerardo vio "Uruguay vs India" sin la bandera de India. sync-espn-uruguay creaba al
--    rival sin `escudo_url`; desde hoy lo completa sola (escudoEspn). Esto arregla los 9 que ya
--    estaban: ids verificados con HEAD → 200 en a.espncdn.com el 2026-10-05. Quedan sin escudo
--    (ESPN da 404 → la tarjeta muestra iniciales): Al Gharafa, Al Shamal, Neftchi Fergana,
--    Pakhtakor Tashkent, Shabab Al-Ahli.
-- 2) Amistosos de clubes (avances.md §5 punto 4, opción 1): sync-espn-uruguay suma `club.friendly`
--    a los 6 clubes de Match Day. Competencia "Amistoso de clubes" para ESPN y también para
--    API-Football (liga 667 "Friendlies Clubs"), así esos partidos dejan de verse sin competencia.
--    Los 2 amistosos ya cargados (Genk y Toluca, 3/10) pasan a esa competencia.
-- Reversible: escudos → null para esos ids; delete de las 2 competencias (los partidos quedan con
-- competencia_id null por el `on delete set null`).
-- ============================================================================
begin;

update clubes
set escudo_url = 'https://a.espncdn.com/i/teamlogos/soccer/500/' || id_externo || '.png'
where proveedor_externo = 'espn'
  and escudo_url is null
  and id_externo in ('7128', '7135', '131688', '4385', '19002', '6866', '4423', '9903', '451');

insert into competencias (nombre, pais, tipo, codigo, origen, proveedor_externo, id_externo)
select v.nombre, null, 'copa'::tipo_competencia, 'AMC', 'api'::origen_dato, v.proveedor, v.id_externo
from (values
  ('Amistoso de clubes', 'espn',         'club.friendly'),
  ('Amistoso de clubes', 'api-football', '667')
) as v(nombre, proveedor, id_externo)
where not exists (
  select 1 from competencias c where c.proveedor_externo = v.proveedor and c.id_externo = v.id_externo
);

update partidos p
set competencia_id = c.id
from competencias c
where c.proveedor_externo = 'api-football' and c.id_externo = '667'
  and p.proveedor_externo = 'api-football'
  and p.competencia_id is null
  and p.payload_crudo -> 'league' ->> 'id' = '667';

commit;
