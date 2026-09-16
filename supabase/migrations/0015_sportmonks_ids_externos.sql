-- ============================================================================
-- Football First — Migración 0015: ids externos de SportMonks (clubes + jugadores)
--
-- Prepara la migración de las 5 ligas domésticas de la cartera a SportMonks (plan Starter,
-- avances.md sección "Evaluación SportMonks"). Aditiva y reversible.
--
-- Por qué una columna aparte y NO se reusa `proveedor_externo`/`id_externo`: esos 2 campos
-- (existentes desde 0001) siguen apuntando a API-Football porque los mismos 6 clubes y
-- jugadores TAMBIÉN se sincronizan por API-Football para copas/continentales (Leagues Cup,
-- Concachampions, Libertadores, etc. — el plan Starter no las cubre). Pisar el par existente
-- rompería esa segunda vía. `id_externo_sportmonks` convive con el par api-football sin tocarlo.
--
-- Los 6 pares (id API-Football -> id SportMonks) se verificaron en vivo 2026-09-16 con
-- `scripts/consultar-sportmonks.mjs` (ver planeacion/avances.md).
--
-- Esta migración es SOLO el schema + backfill (segura, sin efecto hasta que se despliegue
-- `sync-partidos-sportmonks`). Apagar el cron de `sync-fixtures-espn` y agendar el de la
-- función nueva queda para una migración aparte (0016), recién cuando Gerardo confirme que la
-- función ya está desplegada y probada — así nunca hay una ventana sin cobertura de temporada
-- completa (avances.md).
-- ============================================================================

begin;

alter table clubes add column id_externo_sportmonks text;
create unique index clubes_sportmonks_externo_uidx
  on clubes (id_externo_sportmonks) where id_externo_sportmonks is not null;

alter table jugadores add column id_externo_sportmonks text;
create unique index jugadores_sportmonks_externo_uidx
  on jugadores (id_externo_sportmonks) where id_externo_sportmonks is not null;

-- Backfill de los 6 clubes de la cartera (id_externo = id de API-Football, ya sembrado).
update clubes set id_externo_sportmonks = v.sm
from (values
  ('742',  '2709'),  -- Genk — Pro League (Bélgica)
  ('2281', '967'),   -- Toluca — Liga MX
  ('2312', '7023'),  -- Atlante — Liga MX
  ('794',  '7808'),  -- RB Bragantino — Serie A (Brasil)
  ('2315', '7930'),  -- Colo-Colo — Primera División (Chile)
  ('2933', '13092')  -- Al-Qadsiah (Nández) — Pro League (Arabia)
) as v(af, sm)
where clubes.proveedor_externo = 'api-football' and clubes.id_externo = v.af;

-- Backfill de los 6 representados de Match Day (id_externo = id de API-Football, ya sembrado).
update jugadores set id_externo_sportmonks = v.sm
from (values
  ('6122',   '260657'),   -- Javi Méndez
  ('377326', '37646062'), -- Kevin Amaro
  ('51549',  '30081977'), -- Martín Fernández
  ('2614',   '260860'),   -- Nahitan Nández
  ('67884',  '34907430'), -- Fede Pereira
  ('310307', '37566154')  -- Nacho Sosa
) as v(af, sm)
where jugadores.id_externo = v.af;

commit;
