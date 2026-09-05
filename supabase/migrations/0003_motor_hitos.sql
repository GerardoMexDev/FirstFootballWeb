-- ============================================================================
-- Football First — Migración 0003: base para el motor de hitos
--
-- El motor de hitos (lib/motor-hitos/) necesita saber cuántos partidos/goles/asistencias
-- lleva HOY cada jugador (carrera y con la selección) para calcular el próximo número
-- redondo. Nuestra sync (sync-partidos) solo trae partidos hacia ADELANTE — no hay forma
-- de reconstruir el historial completo de la carrera desde la API (y menos con el plan
-- free). Por eso estos 5 números son `origen='manual'`: los da la agencia una vez, y de
-- ahí en más el total corriente = esta base + lo que sume `estadisticas_partido` a medida
-- que se sincronizan partidos reales (ver la vista `totales_jugador` más abajo).
--
-- Todas NULL-ABLES a propósito: si no se sabe un número, esa métrica puntual queda
-- "Sin datos" — nunca se asume 0 (contexto.md §10, cero invenciones). Con NULL, la suma
-- en la vista da NULL solita (aritmética de Postgres), sin lógica extra.
-- ============================================================================

begin;

alter table jugadores
  add column carrera_partidos_base    int check (carrera_partidos_base is null or carrera_partidos_base >= 0),
  add column carrera_goles_base       int check (carrera_goles_base is null or carrera_goles_base >= 0),
  add column carrera_asistencias_base int check (carrera_asistencias_base is null or carrera_asistencias_base >= 0),
  add column seleccion_partidos_base  int check (seleccion_partidos_base is null or seleccion_partidos_base >= 0),
  add column seleccion_goles_base     int check (seleccion_goles_base is null or seleccion_goles_base >= 0),
  add column base_actualizada_en      date; -- informativo: a qué fecha corresponden estos números

comment on column jugadores.carrera_partidos_base is
  'Partidos jugados en carrera HASTA la fecha en base_actualizada_en. Dato manual (agencia), no de la API.';
comment on column jugadores.base_actualizada_en is
  'Fecha de corte de los *_base. Todo lo que se sincroniza después se suma en la vista totales_jugador.';

-- Total corriente por jugador: base manual + lo que ya trajo la sync (estadisticas_partido,
-- que hoy está vacía porque sync-estadisticas todavía no existe — por eso da lo mismo que
-- la base, y eso es correcto). con_seleccion (en partidos_jugadores) separa carrera de selección.
create view totales_jugador
with (security_invoker = true) as
select
  j.id as jugador_id,
  j.carrera_partidos_base
    + coalesce(count(ep.id) filter (where pj.con_seleccion = false), 0)       as carrera_partidos,
  j.carrera_goles_base
    + coalesce(sum(ep.goles) filter (where pj.con_seleccion = false), 0)      as carrera_goles,
  j.carrera_asistencias_base
    + coalesce(sum(ep.asistencias) filter (where pj.con_seleccion = false), 0) as carrera_asistencias,
  j.seleccion_partidos_base
    + coalesce(count(ep.id) filter (where pj.con_seleccion = true), 0)       as seleccion_partidos,
  j.seleccion_goles_base
    + coalesce(sum(ep.goles) filter (where pj.con_seleccion = true), 0)      as seleccion_goles
from jugadores j
left join partidos_jugadores pj on pj.jugador_id = j.id
left join estadisticas_partido ep on ep.partido_id = pj.partido_id and ep.jugador_id = pj.jugador_id
group by j.id;

comment on view totales_jugador is
  'Base manual (jugadores.*_base) + lo acumulado en estadisticas_partido. NULL si la base no se cargó — nunca 0 por defecto.';

commit;
