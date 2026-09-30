-- ============================================================================
-- 0029 — Cartel de avisos para el Administrador + códigos de SportMonks de los uruguayos.
-- Pedido de la agencia (2026-09-30, puntos 7 y 8): la API-Football estuvo caída 8 días sin que
-- nadie se enterara, y la revisión de traspasos no veía nada. Sesión 15.
-- ============================================================================
-- 1) Códigos de SportMonks de los 4 jugadores de Contenido de Uruguay y de sus 2 clubes, para que
--    `sync-roster` (ahora con SportMonks) pueda revisarlos. Verificados en vivo 2026-09-30:
--    Abel (1568) y Silvera (261815) por /players; Franco Romero (260747) y Martirena (37420346)
--    en el plantel de su club, por fecha de nacimiento (la búsqueda por nombre da un homónimo).
-- 2) `avisos_sistema()`: lo que el cartel le muestra al Administrador (a nadie más):
--    - una fuente de datos que no se actualiza (última corrida con error o sin corridas
--      recientes, y sin un "ok" dentro de su tolerancia);
--    - los traspasos detectados en la última revisión semanal (no se aplican solos);
--    - los jugadores que SportMonks ya no muestra en su club (a revisar).
--    security definer: lee `sincronizaciones` con los permisos del dueño; devuelve vacío si quien
--    llama no es un Administrador activo.
-- Reversible: drop function avisos_sistema(); y poner en null los 6 códigos.
-- ============================================================================
begin;

update jugadores set id_externo_sportmonks = v.sm
from (values
  ('Abel Hernández',      '1568'),
  ('Franco Romero',       '260747'),
  ('Gastón Martirena',    '37420346'),
  ('Maximiliano Silvera', '261815')
) as v(nombre, sm)
where jugadores.nombre = v.nombre and jugadores.id_externo_sportmonks is null;

update clubes set id_externo_sportmonks = v.sm
from (values
  ('CA Peñarol',    '3338'),
  ('Club Nacional', '828')
) as v(nombre, sm)
where clubes.nombre = v.nombre
  and clubes.proveedor_externo = 'api-football'
  and clubes.id_externo_sportmonks is null;

create or replace function avisos_sistema()
returns table (clave text, texto text, desde timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  v_cargo text;
begin
  select p.cargo into v_cargo from perfiles p where p.id = auth.uid() and p.activo;
  if v_cargo is distinct from 'Administrador' then
    return;
  end if;

  return query
  with fuentes(proveedor, recurso, nombre, tolerancia) as (
    values
      ('sportmonks',   'partidos',     'partidos de las 5 ligas',           interval '36 hours'),
      ('api-football', 'partidos',     'partidos de copas y selección',     interval '36 hours'),
      ('api-football', 'estadisticas', 'estadísticas de copas y selección', interval '36 hours'),
      ('sportmonks',   'roster',       'revisión semanal de traspasos',     interval '8 days')
  ),
  ultima as (
    select distinct on (s.proveedor, s.recurso) s.proveedor, s.recurso::text as recurso, s.estado::text as estado, s.finalizado_en
    from sincronizaciones s
    order by s.proveedor, s.recurso, s.finalizado_en desc nulls last
  ),
  ultimo_ok as (
    select s.proveedor, s.recurso::text as recurso, max(s.finalizado_en) as ok
    from sincronizaciones s
    where s.estado = 'ok'
    group by 1, 2
  ),
  roster as (
    select s.parametros, s.finalizado_en
    from sincronizaciones s
    where s.proveedor = 'sportmonks' and s.recurso = 'roster'
    order by s.finalizado_en desc nulls last
    limit 1
  )
  select
    'fuente:' || f.proveedor || '/' || f.recurso,
    'La fuente de ' || f.nombre || ' no se actualiza'
      || coalesce(' desde el ' || to_char(o.ok at time zone 'America/Montevideo', 'DD/MM'), '')
      || '. Avisar a Mazdesign.',
    o.ok
  from fuentes f
  join ultima u on u.proveedor = f.proveedor and u.recurso = f.recurso
  left join ultimo_ok o on o.proveedor = f.proveedor and o.recurso = f.recurso
  where (u.estado <> 'ok' or u.finalizado_en < now() - f.tolerancia)
    and (o.ok is null or o.ok < now() - f.tolerancia)
  union all
  select
    'traspaso:' || (d ->> 'jugador'),
    'Traspaso detectado: ' || (d ->> 'jugador') || ' pasó de ' || coalesce(d ->> 'desde', '?')
      || ' a ' || (d ->> 'hacia')
      || coalesce(' (' || to_char((d ->> 'fecha')::date, 'DD/MM/YYYY') || ')', '')
      || '. Mazdesign lo aplica.',
    r.finalizado_en
  from roster r, jsonb_array_elements(coalesce(r.parametros -> 'detectados', '[]'::jsonb)) d
  union all
  select 'revisar:' || md5(x), 'Revisar club: ' || x, r.finalizado_en
  from roster r, jsonb_array_elements_text(coalesce(r.parametros -> 'sin_dato', '[]'::jsonb)) x;
end;
$$;

revoke all on function avisos_sistema() from public, anon;
grant execute on function avisos_sistema() to authenticated;

commit;
