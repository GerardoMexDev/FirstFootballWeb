-- ============================================================================
-- Football First — Migración 0031: ESPN Uruguay (puntos 4 y 9 de la agencia)
--
-- 1. Competencias que trae ESPN y no teníamos (proveedor_externo='espn', id_externo=<slug>):
--    liga uruguaya, amistosos, Copa América, Mundial. Libertadores/Sudamericana/Eliminatorias
--    ya existen (api-football) y la sync las referencia por ese id.
-- 2. "Club" Uruguay (selección) con proveedor espn / id 212.
-- 3. Vista `partidos_seleccion`: partidos de Uruguay en competencias de selección, desde hace
--    3 días. MISMAS columnas que `proximos_partidos_contenido` (el front usa el mismo tipo);
--    las de jugador llevan los datos de Uruguay (no hay representado).
-- 4. `avisos_sistema()`: suma la fuente espn/partidos.
-- 5. Cron diario 07:00 UTC (04:00 UY) de `sync-espn-uruguay`.
--
-- Reversible: drop view partidos_seleccion; select cron.unschedule('sync-espn-uruguay-diario');
-- delete de las competencias/club espn si no tienen partidos; recrear avisos_sistema de 0029.
-- Football First. Creado 2026-09-30.
-- ============================================================================
begin;

insert into competencias (nombre, pais, tipo, codigo, origen, proveedor_externo, id_externo)
select v.nombre, v.pais, v.tipo::tipo_competencia, v.codigo, 'api'::origen_dato, 'espn', v.id_externo
from (values
  ('Primera División Uruguay', 'Uruguay', 'liga',      'URU', 'uru.1'),
  ('Amistoso internacional',   null,      'seleccion', 'AMI', 'fifa.friendly'),
  ('Copa América',             null,      'seleccion', 'CAM', 'conmebol.america'),
  ('Copa del Mundo',           null,      'seleccion', 'MUN', 'fifa.world')
) as v(nombre, pais, tipo, codigo, id_externo)
where not exists (
  select 1 from competencias c where c.proveedor_externo = 'espn' and c.id_externo = v.id_externo
);

insert into clubes (nombre, pais, zona_horaria, escudo_url, origen, proveedor_externo, id_externo)
select 'Uruguay', 'Uruguay', 'America/Montevideo', 'https://a.espncdn.com/i/teamlogos/countries/500/uru.png', 'api', 'espn', '212'
where not exists (select 1 from clubes where proveedor_externo = 'espn' and id_externo = '212');

create view partidos_seleccion
with (security_invoker = true) as
select
  p.id                         as partido_id,
  uy.id                        as jugador_id,
  uy.nombre                    as jugador_nombre,
  null::text                   as jugador_apodo,
  uy.escudo_url                as jugador_foto_url,
  'Uruguay'::text              as jugador_seleccion,
  true                         as con_seleccion,
  null::boolean                as convocado,
  c.id                         as competencia_id,
  c.nombre                     as competencia_nombre,
  c.codigo                     as competencia_codigo,
  c.tipo                       as competencia_tipo,
  true                         as es_internacional,
  c.cobertura                  as competencia_cobertura,
  uy.id                        as club_id,
  uy.nombre                    as club_nombre,
  uy.escudo_url                as club_escudo_url,
  riv.id                       as rival_id,
  riv.nombre                   as rival_nombre,
  riv.escudo_url               as rival_escudo_url,
  (p.club_local_id = uy.id)    as es_local,
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
join clubes uy       on uy.proveedor_externo = 'espn' and uy.id_externo = '212'
                    and uy.id in (p.club_local_id, p.club_visitante_id)
join competencias c  on c.id = p.competencia_id and c.tipo = 'seleccion'
left join clubes riv on riv.id = case when p.club_local_id = uy.id then p.club_visitante_id else p.club_local_id end
where p.inicio_utc is null or p.inicio_utc > now() - interval '3 days';

comment on view partidos_seleccion is 'Partidos de la selección uruguaya (ESPN, 0031). Filtro "Selección" y "Todos" del calendario y /partidos. Mismas columnas que proximos_partidos_contenido.';

revoke all on partidos_seleccion from anon, authenticated;
grant select on partidos_seleccion to authenticated;

-- avisos_sistema(): cuerpo de 0029 + la fuente espn/partidos (0031).
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

select cron.schedule(
  'sync-espn-uruguay-diario',
  '0 7 * * *',
  $cron$
  select net.http_post(
    url     := 'https://thplgzufenxrzegwfxkg.functions.supabase.co/sync-espn-uruguay',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sync_functions_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $cron$
);

commit;
