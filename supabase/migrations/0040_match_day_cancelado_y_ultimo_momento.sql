-- ============================================================================
-- 0040 — Match Day: casilla "Cancelado" (con motivo) + señal "de último momento". 2026-10-05.
-- Pedidos del fin de semana 03–04/10 (avances.md §5, puntos 4 y 5):
-- 1) Cancelado: un jugador pidió no hacer el Match Day de un amistoso y el ticket quedaba
--    pendiente/vencido para siempre. Lo marcan Administrador, Community Manager y Diseñador, con
--    motivo obligatorio. Se guarda en `disenos_partido` (la misma fila que "Completado": las dos
--    marcas se excluyen). `completado_por` / `completado_en` pasan a ser "quién marcó y cuándo".
-- 2) Último momento: partido que apareció en la base después de su fecha límite normal
--    (día del partido − ticket_dias_anticipacion()), p. ej. amistosos que API-Football publica
--    1 día antes. Su ticket vence el MISMO día del partido (no nace vencido) y la vista lo marca
--    con `ultimo_momento` para mostrar la señal.
-- Reversible: drop function diseno_partido_cancelar; volver a crear diseno_partido_marcar y
-- tickets_match_day con el cuerpo de 0030 (drop view antes: se quitan columnas);
-- alter table disenos_partido drop column cancelado, drop column motivo_cancelacion.
-- ============================================================================
begin;

alter table disenos_partido
  add column cancelado          boolean not null default false,
  add column motivo_cancelacion text,
  add constraint disenos_partido_motivo_si_cancelado
    check (not cancelado or length(btrim(coalesce(motivo_cancelacion, ''))) > 0);
comment on column disenos_partido.cancelado is 'true = el Match Day no se hace (0040); false = Completado.';
comment on column disenos_partido.completado_por is 'Quién marcó Completado o Cancelado.';

-- Completado (solo Diseñador): pisa un Cancelado; destildar no borra un Cancelado.
create or replace function diseno_partido_marcar(p_partido uuid, p_jugador uuid, p_completado boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if ticket__cargo_actual() <> 'Diseñador' then
    raise exception 'Solo el Diseñador puede hacer esto.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from partidos_jugadores pj
    join jugadores j on j.id = pj.jugador_id and j.activo and j.servicio_match_day
    where pj.partido_id = p_partido and pj.jugador_id = p_jugador
  ) then
    raise exception 'Ese jugador no figura en ese partido de Match Day.';
  end if;
  if p_completado then
    insert into disenos_partido (partido_id, jugador_id, completado_por)
    values (p_partido, p_jugador, auth.uid())
    on conflict (partido_id, jugador_id) do update
      set cancelado = false, motivo_cancelacion = null,
          completado_por = excluded.completado_por, completado_en = now()
      where disenos_partido.cancelado;
  else
    delete from disenos_partido where partido_id = p_partido and jugador_id = p_jugador and not cancelado;
  end if;
end;
$$;

-- Cancelado (Admin, CM, Diseñador). p_motivo con texto = cancelar (pisa un Completado);
-- p_motivo null = quitar la cancelación (el ticket vuelve a pendiente/vencido).
create or replace function diseno_partido_cancelar(p_partido uuid, p_jugador uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  if ticket__cargo_actual() not in ('Administrador', 'Community Manager', 'Diseñador') then
    raise exception 'No tenés permiso para cancelar un Match Day.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from partidos_jugadores pj
    join jugadores j on j.id = pj.jugador_id and j.activo and j.servicio_match_day
    where pj.partido_id = p_partido and pj.jugador_id = p_jugador
  ) then
    raise exception 'Ese jugador no figura en ese partido de Match Day.';
  end if;
  if p_motivo is not null and v_motivo is null then
    raise exception 'Escribí el motivo de la cancelación.';
  end if;
  if v_motivo is not null and length(v_motivo) > 300 then
    raise exception 'El motivo es demasiado largo (máximo 300 caracteres).';
  end if;
  if v_motivo is not null then
    insert into disenos_partido (partido_id, jugador_id, completado_por, cancelado, motivo_cancelacion)
    values (p_partido, p_jugador, auth.uid(), true, v_motivo)
    on conflict (partido_id, jugador_id) do update
      set cancelado = true, motivo_cancelacion = excluded.motivo_cancelacion,
          completado_por = excluded.completado_por, completado_en = now();
  else
    delete from disenos_partido where partido_id = p_partido and jugador_id = p_jugador and cancelado;
  end if;
end;
$$;
revoke execute on function diseno_partido_cancelar(uuid, uuid, text) from public, anon;
grant execute on function diseno_partido_cancelar(uuid, uuid, text) to authenticated;

-- Misma vista que 0030 + estado 'cancelado', vencimiento de último momento y 2 columnas al final.
create or replace view tickets_match_day with (security_invoker = true) as
with base as (
  select
    pp.*,
    pp.dia_uy is not null
      and (p.creado_en at time zone 'America/Montevideo')::date > pp.dia_uy - ticket_dias_anticipacion() as ultimo_momento
  from proximos_partidos pp
  join partidos p on p.id = pp.partido_id
)
select
  b.partido_id,
  b.jugador_id,
  coalesce(b.jugador_apodo, b.jugador_nombre)                          as jugador_nombre,
  'Match Day — ' || coalesce(b.jugador_apodo, b.jugador_nombre) || ' · '
    || coalesce(b.club_nombre, '?') || ' vs ' || coalesce(b.rival_nombre, '?') as titulo,
  b.dia_uy,
  b.inicio_utc,
  case
    when b.dia_uy is null then null
    when b.ultimo_momento then b.dia_uy
    else b.dia_uy - ticket_dias_anticipacion()
  end                                                                  as fecha_limite,
  case
    when b.dia_uy is not null and b.dia_uy < match_day_desde() then null
    when d.cancelado then 'cancelado'
    when d.partido_id is not null then 'completado'
    when b.dia_uy is not null
         and (now() at time zone 'America/Montevideo')::date
             > case when b.ultimo_momento then b.dia_uy else b.dia_uy - ticket_dias_anticipacion() end
      then 'vencido'
    else 'pendiente'
  end                                                                  as estado,
  pc.nombre_completo                                                   as completado_por_nombre,
  d.completado_en,
  d.motivo_cancelacion,
  b.ultimo_momento
from base b
left join disenos_partido d on d.partido_id = b.partido_id and d.jugador_id = b.jugador_id
left join perfiles_publicos pc on pc.id = d.completado_por;
comment on view tickets_match_day is 'Ticket automático por partido de Match Day y jugador (0030; cancelado y último momento: 0040).';

commit;
