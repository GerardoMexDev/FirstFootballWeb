-- ============================================================================
-- Football First — Migración 0033: copas de Match Day desde ESPN
--
-- Punto 10 de la agencia (lista de torneos de Gerardo, 2026-09-30). Las copas de los 6 clubes de
-- Match Day venían solo de API-Football gratis (~3 días adelante) → el ticket automático (0030)
-- nacía vencido. Ahora las trae ESPN con meses de anticipación (`sync-espn-uruguay`).
--
-- 1. Competencias de ESPN que no teníamos (proveedor_externo='espn', id_externo=<slug>).
-- 2. `proximos_partidos`: cuerpo EXACTO de 0032; solo cambia la prioridad del dedupe por
--    (jugador, día UY, selección): sportmonks → espn → api-football (antes: api-football primero).
--    Ligas: SportMonks (sin cambio real). Copas: ESPN → el ticket queda en el mismo partido cuando
--    API-Football trae la misma copa días después (no se pierde el Completado del Diseñador).
--
-- Reversible: `create or replace view proximos_partidos` con el cuerpo de 0032; delete de las
-- competencias espn nuevas si no tienen partidos.
-- Football First. Creado 2026-09-30.
-- ============================================================================

begin;

insert into competencias (nombre, pais, tipo, codigo, origen, proveedor_externo, id_externo)
select v.nombre, v.pais, v.tipo::tipo_competencia, v.codigo, 'api'::origen_dato, 'espn', v.id_externo
from (values
  ('Campeón de Campeones',       'México', 'copa',        'CDC',  'mex.campeon'),
  ('Campeones Cup',              null,     'continental', 'CCUP', 'campeones.cup'),
  ('Mundial de Clubes',          null,     'continental', 'MDC',  'fifa.cwc'),
  ('Copa Intercontinental',      null,     'continental', 'INT',  'fifa.intercontinental_cup'),
  ('Supercopa de Brasil',        'Brasil', 'copa',        'SCB',  'bra.supercopa_do_brazil'),
  ('Campeonato Paulista',        'Brasil', 'copa',        'PAU',  'bra.camp.paulista'),
  ('Supercopa de Chile',         'Chile',  'copa',        'SCC',  'chi.super_cup'),
  ('Recopa Sudamericana',        null,     'continental', 'REC',  'conmebol.recopa'),
  ('UEFA Champions League',      null,     'continental', 'UCL',  'uefa.champions'),
  ('UEFA Conference League',     null,     'continental', 'UECL', 'uefa.europa.conf')
) as v(nombre, pais, tipo, codigo, id_externo)
where not exists (select 1 from competencias c where c.proveedor_externo = 'espn' and c.id_externo = v.id_externo);

create or replace view proximos_partidos
with (security_invoker = true) as
select distinct on (
  pj.jugador_id,
  pj.con_seleccion,
  coalesce((p.inicio_utc at time zone 'America/Montevideo')::date::text, 'sinfecha:' || p.id::text)
)
  p.id                         as partido_id,
  pj.jugador_id,
  j.nombre                     as jugador_nombre,
  j.apodo                      as jugador_apodo,
  j.foto_url                   as jugador_foto_url,
  j.seleccion                  as jugador_seleccion,
  pj.con_seleccion,
  pj.convocado,
  c.id                         as competencia_id,
  c.nombre                     as competencia_nombre,
  c.codigo                     as competencia_codigo,
  c.tipo                       as competencia_tipo,
  (c.tipo in ('continental', 'seleccion')) as es_internacional,
  c.cobertura                  as competencia_cobertura,
  cl.id                        as club_id,
  cl.nombre                    as club_nombre,
  cl.escudo_url                as club_escudo_url,
  riv.id                       as rival_id,
  riv.nombre                   as rival_nombre,
  riv.escudo_url               as rival_escudo_url,
  p.es_local,
  p.inicio_utc,
  p.zona_horaria_evento,
  (p.inicio_utc at time zone p.zona_horaria_evento)      as inicio_local_sede,
  (p.inicio_utc at time zone 'America/Montevideo')       as inicio_local_uy,
  (p.inicio_utc at time zone 'America/Montevideo')::date as dia_uy,
  p.estado,
  p.ronda,
  p.estadio,
  p.ciudad,
  p.marcador_local,
  p.marcador_visitante,
  (p.inicio_utc is not null and p.inicio_utc > now() + interval '90 days') as tentativo,
  p.sincronizado_en,
  coalesce(
    (p.inicio_utc at time zone p.zona_horaria_evento)::date,
    (p.inicio_utc at time zone 'America/Montevideo')::date
  ) as dia_local_sede
from partidos p
join partidos_jugadores pj on pj.partido_id = p.id
join jugadores j           on j.id = pj.jugador_id and j.servicio_match_day -- NUEVO (0017)
left join competencias c   on c.id = p.competencia_id
left join clubes loc       on loc.id = p.club_local_id
-- 0032: jugando con la selección, "su club" es el lado que se llama como su selección.
left join clubes cl        on cl.id = case
  when pj.con_seleccion and loc.nombre = j.seleccion then p.club_local_id
  when pj.con_seleccion then p.club_visitante_id
  else j.club_actual_id
end
left join clubes riv on riv.id = case
  when pj.con_seleccion and loc.nombre = j.seleccion then p.club_visitante_id
  when pj.con_seleccion then p.club_local_id
  when j.club_actual_id = p.club_local_id then p.club_visitante_id
  else p.club_local_id
end
order by
  pj.jugador_id,
  pj.con_seleccion,
  coalesce((p.inicio_utc at time zone 'America/Montevideo')::date::text, 'sinfecha:' || p.id::text),
  -- 0033: prioridad por fuente — ligas: SportMonks; copas: ESPN (llega meses antes que API-Football,
  -- así el ticket no cambia de partido cuando API-Football trae la misma copa 2 días antes).
  case p.proveedor_externo when 'sportmonks' then 0 when 'espn' then 1 when 'api-football' then 2 else 3 end,
  p.sincronizado_en desc nulls last,
  p.id;

comment on view proximos_partidos is 'Fuente única de la vista partidos del frontend. Una fila por representado de Match Day (0017: servicio_match_day, nunca Contenido) por partido, de-duplicada por (jugador, día en Uruguay, con_selección). `dia_local_sede` (0013) = día civil en la sede. Prioridad 0033: sportmonks → espn → api-football.';

commit;
