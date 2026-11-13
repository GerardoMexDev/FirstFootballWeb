-- ============================================================================
-- 0050 — Se apaga API-Football (copas / estadísticas de copa)
--
-- La cuenta free de API-Football fue suspendida el 2026-11-11 (2da vez). Soporte confirmó
-- (2026-11-12) que la causa son las IPs compartidas de Supabase Edge Functions y que solo
-- reactivan con una IP dedicada. Decisión de Gerardo: no se paga un servidor propio;
-- se apagan las 2 sincronizaciones (ESPN + SportMonks siguen cubriendo ligas, Uruguay y
-- la mayoría de las copas). Se pierden: copas chicas, algunos amistosos y estadísticas por
-- jugador de partidos de copa.
--
-- 1. Saca los cron 'sync-partidos-diario' (0002) y 'sync-estadisticas-diario' (0006).
-- 2. avisos_sistema(): mismo cuerpo de 0031 sin las 2 fuentes de api-football.
--
-- Las Edge Functions sync-partidos / sync-estadisticas y su código quedan en el repo
-- (no se borran) por si algún día se vuelve con IP dedicada.
-- Reversible: re-correr el cron.schedule de 0002 y 0006 y el avisos_sistema de 0031.
-- Football First. Creado 2026-11-12.
-- ============================================================================
begin;

select cron.unschedule('sync-partidos-diario');
select cron.unschedule('sync-estadisticas-diario');

-- avisos_sistema(): cuerpo de 0031 sin las fuentes api-football/partidos y api-football/estadisticas (0050).
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
      ('sportmonks',   'roster',       'revisión semanal de traspasos',     interval '8 days'),
      ('espn',         'partidos',     'partidos de Uruguay (ESPN)',        interval '36 hours')
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
