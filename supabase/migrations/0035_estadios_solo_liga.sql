-- ============================================================================
-- Football First — Migración 0035: ajustes de la revisión final de 0034 (estadios de la agencia)
--
-- 1. El respaldo "si la fuente no trae estadio, el de la agencia" pasa a aplicarse SOLO en partidos
--    de LIGA (ida y vuelta en la cancha del local). En copas, continentales y torneos en sede neutral
--    (Mundial de Clubes, Intercontinental, finales) una sede todavía sin confirmar NO se completa con
--    la cancha del local: se mostraría como segura una cancha inventada.
-- 2. "Racing Club" deja de ser alias del Racing uruguayo: en ESPN ese nombre es el Racing ARGENTINO
--    (el uruguayo es "Racing (Montevideo)").
-- 3. "King Abdullah Sports City" (plural) también para Al Taawoun y Al Raed (Buraidah): si no, un
--    partido suyo con ese nombre se iba, por la regla 2, a la cancha homónima de Jeddah (Al Ittihad).
--
-- No re-toca los partidos: los ya cargados no cambian de nombre con esto (1 solo afecta estadios
-- vacíos que lleguen de ahora en más).
-- Reversible: create or replace de la función con el cuerpo de 0034; revertir los dos updates.
-- Football First. Creado 2026-09-30.
-- ============================================================================

begin;

update estadios_equipo
set alias = array_remove(alias, 'Racing Club')
where equipo = 'Racing Club';

update estadios_equipo
set nombres_fuente = nombres_fuente || array['King Abdullah Sports City']::text[]
where equipo in ('Al Taawoun', 'Al Raed')
  and not ('King Abdullah Sports City' = any(nombres_fuente));

create or replace function partidos_estadio_agencia()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_local   text;
  v_fila    estadios_equipo%rowtype;
  v_liga    boolean;
  v_n       int;
  v_estadio text;
  v_ciudad  text;
begin
  -- Regla 1 — cancha habitual del local: nombre y ciudad de la agencia. Sin dato de la fuente, el
  -- respaldo con la cancha del local SOLO en liga (0035: en copas/neutrales no se inventa la sede).
  if new.club_local_id is not null then
    select c.nombre into v_local from clubes c where c.id = new.club_local_id;
    select e.* into v_fila
    from estadios_equipo e
    where exists (select 1 from unnest(e.alias) a where lower(btrim(a)) = lower(btrim(v_local)))
    limit 1;
    if found then
      select (c.tipo = 'liga') into v_liga from competencias c where c.id = new.competencia_id;
      if (new.estadio is null and coalesce(v_liga, false))
         or lower(btrim(new.estadio)) = lower(btrim(v_fila.estadio))
         or exists (select 1 from unnest(v_fila.nombres_fuente) f where lower(btrim(f)) = lower(btrim(new.estadio))) then
        new.estadio := v_fila.estadio;
        new.ciudad  := coalesce(v_fila.ciudad, new.ciudad);
        return new;
      end if;
    end if;
  end if;
  -- Regla 2 — otra cancha (se respeta la fuente), pero si es la habitual de OTRO equipo de la tabla
  -- y el nombre no es ambiguo (una sola cancha de la agencia), se muestra con el nombre de la
  -- agencia. Ej.: Atlante de local en el Azteca → "Mexico City Stadium" = "Estadio Azteca".
  if new.estadio is not null then
    select count(distinct (e.estadio, e.ciudad)), min(e.estadio), min(e.ciudad)
      into v_n, v_estadio, v_ciudad
    from estadios_equipo e
    where lower(btrim(e.estadio)) = lower(btrim(new.estadio))
       or exists (select 1 from unnest(e.nombres_fuente) f where lower(btrim(f)) = lower(btrim(new.estadio)));
    if v_n = 1 then
      new.estadio := v_estadio;
      new.ciudad  := coalesce(v_ciudad, new.ciudad);
    end if;
  end if;
  return new;
end;
$$;

revoke all on function partidos_estadio_agencia() from public, anon, authenticated;

commit;
