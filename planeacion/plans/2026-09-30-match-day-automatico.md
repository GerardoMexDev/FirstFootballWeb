# Match Day automático + tickets simplificados + calendario unificado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada partido de Match Day es un ticket automático por jugador (🔴 pendiente / 🟢 completado / 🟡 vencido) que el Diseñador tilda; los tickets manuales pasan a pendiente → completado; un solo calendario con filtros Todos / Match Day / Contenido; botón Copiar en el partido.

**Architecture:** El estado automático se CALCULA en la vista `tickets_match_day` (0030) a partir de `proximos_partidos` + una tabla chica `disenos_partido` con las marcas de "completado". En el front, cada fila automática se adapta a `ResumenTicket` (id sintético `md:<partido>:<jugador>`, `automatico: true`) para que la pantalla Tickets, los contadores y el globito los traten igual que a los manuales. "Completado" de un ticket manual se guarda como el estado existente `publicado` (no se agrega valor al enum: Postgres no deja usar un valor nuevo del enum en la misma transacción que lo crea).

**Tech Stack:** Postgres 17/Supabase (RLS, security definer), `pg` + ROLLBACK para tests de base, Next.js 14 App Router, React 18, TypeScript, Luxon, `node --test`.

**Spec:** `planeacion/specs/2026-09-30-match-day-automatico.md`

## Global Constraints

- CSS nuevo SOLO en `styles/app.css` con tokens (`--tk-rojo*`, `--tk-verde*`, `--tk-amarillo*`); nunca `styles/demo.css`.
- Módulos de `lib/` con tests: solo paquetes o `import type` (`@/` no resuelve en `node --test`).
- Cabecera en todo archivo nuevo no-test ("Football First. Creado 2026-09-30.").
- WCAG 2.2 AA: casillas con `<label>`, foco visible, estado no solo por color (siempre texto), aviso "Copiado" con `role="status"`.
- Textos: "Pendiente", "Completado", "Vencido", "Por vencer", "Copiar datos del partido", "Copiado", "Completar", "Reabrir", "Cancelar ticket".
- Colores: 🔴 pendiente = `--tk-rojo`, 🟢 completado = `--tk-verde`, 🟡 vencido = `--tk-amarillo`.
- Solo el **Diseñador** marca/desmarca Completado (automáticos y manuales).
- `match_day_desde()` = fecha de publicación (la fecha del día en que Gerardo aplica 0030).
- Migraciones: las aplica Gerardo (SQL Editor, copiar con Ctrl+A); Claude prueba con ROLLBACK y verifica leyendo filas reales.
- NUNCA `npm run build`/`next start`. QA con `npx next dev -p 3100` + TaskStop + matar hijo.
- Commits con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; nunca `git push`.

## Review Focus

1. **Partido con dos representados** (Toluca vs Atlante): dos casillas independientes; el calendario pinta el partido con el peor estado (vencido > pendiente > completado). → test de `peorEstado` (Task 2) + QA.
2. **Partido de hoy o de mañana (ya pasado el límite)**: nace vencido 🟡 si no se tildó — y NO si es anterior a `match_day_desde()`. → tests de base (Task 1).
3. **Desmarcar por error**: el Diseñador destilda y vuelve a pendiente/vencido según la fecha. → test de base (Task 1) + QA.
4. **Globito del Diseñador con muchos partidos**: solo cuenta vencidos + por vencer (≤ 2 días), nunca los 80 futuros. → test de `pendientesDe` (Task 2).
5. **Copiar sin permiso de portapapeles** (http, navegador viejo): el botón avisa "No se pudo copiar" en vez de fallar callado. → QA (Task 3).

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/0030_match_day_automatico.sql` | `match_day_desde`, `disenos_partido`, `diseno_partido_marcar`, vista `tickets_match_day`, `ticket_completar`/`ticket_reabrir`, datos |
| `scripts/tickets.test.mjs` | Tests de base de 0030 |
| `lib/tickets/tipos.ts` | `ResumenTicket.automatico?`, `EstadoVisual` |
| `lib/tickets/semaforo.ts` (+test) | `estadoVisual`, `peorEstado`, `META_VISUAL` |
| `lib/tickets/copiar.ts` (+test) | `textoCopiarPartido` |
| `lib/tickets/permisos.ts`, `estados.ts`, `pantalla.ts`, `vencimiento.ts` (+tests) | Reglas nuevas (completar/reabrir; globito; abiertos/completados) |
| `lib/repositorios/repositorio-tickets.ts` | `listarMatchDay`, `listarMatchDayDePartido`, `aResumenAutomatico` |
| `lib/tickets/acciones.ts` | `marcarDiseno`, acciones `completar`/`reabrir` |
| `lib/tickets/pendientes-de-sesion.ts` | Suma automáticos |
| `components/tickets/PastillaSemaforo.tsx`, `CasillasDiseno.tsx`, `BotonCopiar.tsx` | UI nueva |
| `components/comunes/Ico.tsx` | Ícono `copiar` |
| `components/paneles/PanelPartido.tsx`, `lib/paneles/cargar-detalle-partido.ts` | Casillas + Copiar por jugador |
| `components/tickets/PanelTicket.tsx`, `ContadorTickets.tsx`, `SeccionTickets.tsx`, `FilaTicket.tsx` | Flujo simple + automáticos |
| `components/partidos/*`, `app/(app)/partidos/page.tsx` | Pastilla por jugador en tarjetas |
| `lib/calendario/eventos.ts` (+test), `components/calendario/Calendario.tsx`, `app/(app)/calendario/page.tsx`, `app/(app)/calendario-general/page.tsx`, `lib/navegacion/secciones.ts` | Calendario unificado |

---

### Task 1: Migración 0030 + tests de base

**Files:** Create `supabase/migrations/0030_match_day_automatico.sql`; Modify `scripts/tickets.test.mjs` (antes del `export { … }` final).

**Interfaces — Produces:** `match_day_desde() returns date`; tabla `disenos_partido(partido_id, jugador_id, completado_por, completado_en)`; `diseno_partido_marcar(p_partido uuid, p_jugador uuid, p_completado boolean) returns void`; vista `tickets_match_day(partido_id, jugador_id, jugador_nombre, titulo, dia_uy, inicio_utc, fecha_limite, estado text, completado_por_nombre, completado_en)`; `ticket_completar(p_ticket uuid, p_texto text default null)`, `ticket_reabrir(p_ticket uuid, p_texto text default null)`.

- [ ] **Step 1: Tests de base (RED)** — agregar a `scripts/tickets.test.mjs`:

```js
// ═════════════ 0030: Match Day automático + tickets simplificados ═════════════
const MIGRACION_0030 = readFileSync(new URL('../supabase/migrations/0030_match_day_automatico.sql', import.meta.url), 'utf8')
  .replace(/^\s*begin;\s*$/m, '')
  .replace(/^\s*commit;\s*$/m, '');
let aplicada0030 = false;
before(async () => {
  const { rows } = await c.query(`select to_regprocedure('public.diseno_partido_marcar(uuid,uuid,boolean)') is not null as ok`);
  aplicada0030 = rows[0].ok;
});
async function enTransaccion0030(fn) {
  await c.query('begin');
  try {
    if (!aplicada) await c.query(MIGRACION);
    if (!aplicada0030) await c.query(MIGRACION_0030);
    await fn(c);
  } finally {
    await c.query('rollback');
  }
}
const HOY = `(now() at time zone 'America/Montevideo')::date`;
/** Partido de prueba a `dias` de hoy (hora 20:00 UY), con el jugador de Match Day. */
async function partidoEnDias(cl, dias) {
  const { rows } = await cl.query(`select ((${HOY} + $1::int)::text || 'T23:00:00Z') as iso`, [dias]);
  return partidoDePrueba(cl, ids.jugadorMd, rows[0].iso);
}
async function estadoMd(cl, partido) {
  await como(cl, ids.felipe);
  const { rows } = await cl.query(`select estado, fecha_limite from tickets_match_day where partido_id = $1 and jugador_id = $2`, [partido, ids.jugadorMd]);
  return rows[0];
}

test('0030: partido futuro sin marca → pendiente; con marca del Diseñador → completado; desmarcar vuelve', () =>
  enTransaccion0030(async (cl) => {
    const p = await partidoEnDias(cl, 10);
    assert.equal((await estadoMd(cl, p)).estado, 'pendiente');
    await como(cl, ids.maxi);
    await cl.query(`select diseno_partido_marcar($1, $2, true)`, [p, ids.jugadorMd]);
    await cl.query(`select diseno_partido_marcar($1, $2, true)`, [p, ids.jugadorMd]); // idempotente
    assert.equal((await estadoMd(cl, p)).estado, 'completado');
    await como(cl, ids.maxi);
    await cl.query(`select diseno_partido_marcar($1, $2, false)`, [p, ids.jugadorMd]);
    assert.equal((await estadoMd(cl, p)).estado, 'pendiente');
  }));

test('0030: pasado el límite y sin marca → vencido; anterior a match_day_desde → sin estado', () =>
  enTransaccion0030(async (cl) => {
    const manana = await partidoEnDias(cl, 1); // límite = ayer
    assert.equal((await estadoMd(cl, manana)).estado, 'vencido');
    await comoDueno(cl);
    const { rows } = await cl.query(`select (match_day_desde() - 3) as d`);
    const viejo = await partidoDePrueba(cl, ids.jugadorMd, `${rows[0].d.toISOString().slice(0, 10)}T23:00:00Z`);
    assert.equal((await estadoMd(cl, viejo)).estado, null);
  }));

test('0030: la fecha límite sigue al partido si se reprograma', () =>
  enTransaccion0030(async (cl) => {
    const p = await partidoEnDias(cl, 10);
    const antes = (await estadoMd(cl, p)).fecha_limite;
    await comoDueno(cl);
    await cl.query(`update partidos set inicio_utc = inicio_utc + interval '5 days' where id = $1`, [p]);
    const despues = (await estadoMd(cl, p)).fecha_limite;
    assert.equal(Math.round((despues - antes) / 86400000), 5);
  }));

test('0030: solo el Diseñador marca; par partido-jugador inexistente → error', () =>
  enTransaccion0030(async (cl) => {
    const p = await partidoEnDias(cl, 10);
    for (const quien of [ids.felipe, ids.pedro, ids.alexis]) {
      await como(cl, quien);
      const e = await debeFallar(cl, `select diseno_partido_marcar($1, $2, true)`, [p, ids.jugadorMd], /Solo el Diseñador puede hacer esto\./);
      assert.equal(e.code, '42501');
    }
    await como(cl, ids.maxi);
    await debeFallar(cl, `select diseno_partido_marcar($1, $2, true)`, [p, ids.felipe], /Ese jugador no figura en ese partido de Match Day\./);
    await comoAnon(cl);
    await debeFallar(cl, `select diseno_partido_marcar($1, $2, true)`, [p, ids.jugadorMd], /permission denied/);
  }));

test('0030: ticket manual pendiente → completar (Diseñador) → reabrir; cancelar sigue siendo del creador/Admin', () =>
  enTransaccion0030(async (cl) => {
    const p = await partidoEnDias(cl, 10);
    await como(cl, ids.pedro);
    const t = (await cl.query(`select ticket_crear($1, $2, 'pieza puntual') id`, [p, ids.jugadorMd])).rows[0].id;
    await como(cl, ids.felipe);
    await debeFallar(cl, `select ticket_completar($1)`, [t], /Solo el Diseñador puede hacer esto\./);
    await como(cl, ids.maxi);
    await cl.query(`select ticket_completar($1)`, [t]);
    let v = await cl.query(`select estado from tickets where id = $1`, [t]);
    assert.equal(v.rows[0].estado, 'publicado');
    await cl.query(`select ticket_reabrir($1, 'faltó una versión')`, [t]);
    v = await cl.query(`select estado from tickets where id = $1`, [t]);
    assert.equal(v.rows[0].estado, 'pendiente');
    const h = await cl.query(`select tipo from tickets_historial where ticket_id = $1 order by id`, [t]);
    assert.deepEqual(h.rows.map((x) => x.tipo), ['creado', 'publicado', 'devuelto']);
    await como(cl, ids.pedro);
    await cl.query(`select ticket_cancelar($1, 'ya no va')`, [t]);
  }));

test('0030: la migración pasa en_revision/aprobado a completado (publicado) con evento sistema', () =>
  enTransaccion0030(async (cl) => {
    // Con 0030 ya aplicada no quedan tickets en esos estados.
    await comoDueno(cl);
    const { rows } = await cl.query(`select count(*)::int n from tickets where estado in ('en_revision','aprobado')`);
    assert.equal(rows[0].n, 0);
  }));
```

- [ ] **Step 2: RED** — `npm run test:tickets 2>&1 | grep -E "^ℹ (pass|fail)|ENOENT"` → Expected: ENOENT de 0030.

- [ ] **Step 3: La migración** — `supabase/migrations/0030_match_day_automatico.sql`:

```sql
-- ============================================================================
-- 0030 — Match Day automático + tickets manuales simplificados. Sesión 15, 2026-09-30.
-- Spec: planeacion/specs/2026-09-30-match-day-automatico.md
-- ============================================================================
-- 1) Cada partido de Match Day es un "ticket" automático por jugador. El estado se CALCULA
--    (vista tickets_match_day): completado si el Diseñador lo tildó (tabla disenos_partido),
--    vencido si pasó la fecha límite (partido − ticket_dias_anticipacion()) sin tildar,
--    pendiente si no. Partidos anteriores a match_day_desde() (día de publicación) → sin estado.
-- 2) Tickets manuales: pendiente → completado. "Completado" se guarda como el estado existente
--    'publicado' (agregar un valor al enum no se puede usar en la misma transacción). Los que
--    estaban en 'en_revision' o 'aprobado' pasan a 'publicado' con un evento 'sistema'.
-- Reversible: drop view tickets_match_day; drop function diseno_partido_marcar, ticket_completar,
-- ticket_reabrir, match_day_desde; drop table disenos_partido. (El cambio de estados no se revierte.)
-- ============================================================================
begin;

create or replace function match_day_desde()
returns date language sql immutable as $$ select date '2026-10-01' $$;
comment on function match_day_desde() is 'Día de publicación del Match Day automático (0030): antes, los partidos no tienen estado.';

create table disenos_partido (
  partido_id     uuid not null references partidos (id) on delete cascade,
  jugador_id     uuid not null references jugadores (id) on delete cascade,
  completado_por uuid not null references perfiles (id) on delete restrict,
  completado_en  timestamptz not null default now(),
  primary key (partido_id, jugador_id)
);
comment on table disenos_partido is 'Marca de "Completado" del Diseñador por partido de Match Day y jugador (0030).';
alter table disenos_partido enable row level security;
create policy disenos_partido_select on disenos_partido for select using (es_usuario_activo());
revoke all on disenos_partido from anon, authenticated;
grant select on disenos_partido to authenticated;

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
    on conflict (partido_id, jugador_id) do nothing;
  else
    delete from disenos_partido where partido_id = p_partido and jugador_id = p_jugador;
  end if;
end;
$$;
revoke execute on function diseno_partido_marcar(uuid, uuid, boolean) from public, anon;
grant execute on function diseno_partido_marcar(uuid, uuid, boolean) to authenticated;

create view tickets_match_day with (security_invoker = true) as
select
  pp.partido_id,
  pp.jugador_id,
  coalesce(pp.jugador_apodo, pp.jugador_nombre)                          as jugador_nombre,
  'Match Day — ' || coalesce(pp.jugador_apodo, pp.jugador_nombre) || ' · '
    || coalesce(pp.club_nombre, '?') || ' vs ' || coalesce(pp.rival_nombre, '?') as titulo,
  pp.dia_uy,
  pp.inicio_utc,
  case when pp.dia_uy is null then null else pp.dia_uy - ticket_dias_anticipacion() end as fecha_limite,
  case
    when pp.dia_uy is not null and pp.dia_uy < match_day_desde() then null
    when d.partido_id is not null then 'completado'
    when pp.dia_uy is not null
         and (now() at time zone 'America/Montevideo')::date > pp.dia_uy - ticket_dias_anticipacion() then 'vencido'
    else 'pendiente'
  end                                                                    as estado,
  pc.nombre_completo                                                     as completado_por_nombre,
  d.completado_en
from proximos_partidos pp
left join disenos_partido d on d.partido_id = pp.partido_id and d.jugador_id = pp.jugador_id
left join perfiles_publicos pc on pc.id = d.completado_por;
comment on view tickets_match_day is 'Ticket automático por partido de Match Day y jugador (0030): estado calculado.';
revoke all on tickets_match_day from anon, authenticated;
grant select on tickets_match_day to authenticated;

create or replace function ticket_completar(p_ticket uuid, p_texto text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform ticket__mover(p_ticket, 'pendiente', 'publicado', 'publicado', 'disenador',
                        ticket__texto(p_texto, false, null));
end;
$$;

create or replace function ticket_reabrir(p_ticket uuid, p_texto text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform ticket__mover(p_ticket, 'publicado', 'pendiente', 'devuelto', 'disenador',
                        ticket__texto(p_texto, false, null));
end;
$$;
revoke execute on function ticket_completar(uuid, text), ticket_reabrir(uuid, text) from public, anon;
grant execute on function ticket_completar(uuid, text), ticket_reabrir(uuid, text) to authenticated;

-- Datos: los manuales en revisión o aprobados pasan a completado (el diseño ya se entregó).
insert into tickets_historial (ticket_id, tipo, autor_id, texto, estado_desde, estado_hasta)
select id, 'sistema', null, 'Pasó a Completado: el recorrido de tickets se simplificó (pendiente → completado).', estado, 'publicado'
from tickets where estado in ('en_revision', 'aprobado');
update tickets set estado = 'publicado' where estado in ('en_revision', 'aprobado');

commit;
```

> Al aplicar: cambiar `date '2026-10-01'` por la fecha del día en que Gerardo la aplique.

- [ ] **Step 4: GREEN** — `npm run test:tickets` → `ℹ fail 0` (40 + 6 = 46).
- [ ] **Step 5: Commit** — `feat(db): 0030 Match Day automático + tickets manuales simplificados`.
- [ ] **Step 6: PARADA — Gerardo aplica 0030** (SQL Editor, Ctrl+A). Verificar: `select('partido_id, estado').limit(3)` de `tickets_match_day` devuelve filas; luego `npm run test:tickets` → fail 0; `npm run tipos:db`.

---

### Task 2: Tipos, lecturas, acciones y lógica pura

**Files:** Modify `lib/tickets/tipos.ts`, `permisos.ts`(+test), `estados.ts`(+test), `pantalla.ts`(+test), `vencimiento.ts`(+test), `lib/repositorios/repositorio-tickets.ts`, `lib/tickets/acciones.ts`, `lib/tickets/pendientes-de-sesion.ts`; Create `lib/tickets/semaforo.ts`(+test), `lib/tickets/copiar.ts`(+test).

**Interfaces — Produces:**
- `ResumenTicket.automatico?: boolean` (true en los de Match Day; `id = 'md:<partidoId>:<jugadorId>'`, `creadoPor = ''`, `creadoPorNombre = null`, `estado`: `'pendiente'` o `'publicado'`).
- `type EstadoVisual = 'pendiente' | 'completado' | 'vencido'`; `estadoVisual(t: ResumenTicket, hoyUy: string): EstadoVisual | null` (null para cancelado); `peorEstado(estados: (EstadoVisual|null)[]): EstadoVisual | null`; `META_VISUAL: Record<EstadoVisual, { etiqueta: string; simbolo: string }>`.
- `textoCopiarPartido(p: { local: string|null; visitante: string|null; inicioUtc: string|null; zona: string|null; estadio: string|null; ciudad: string|null }): string`.
- `accionesPermitidas` → `'completar' | 'reabrir' | 'cancelar' | 'comentar'`; `Accion` = esos 4.
- `pendientesDe(cargo, usuarioId, tickets, hoyUy)` → solo no-Prueba, estado pendiente, urgencia vencido|por_vencer; CM: manuales propios + todos los automáticos.
- `RepositorioTicketsSupabase.listarMatchDay(desdeIso: string, hastaIso: string): Promise<ResumenTicket[]>`; `listarMatchDayDePartido(partidoId: string): Promise<Array<ResumenTicket & { completadoPorNombre: string | null }>>`.
- `marcarDiseno(supabase, partidoId, jugadorId, completado: boolean): Promise<Resultado<null>>`.

- [ ] **Step 1: Tests (RED).**

`lib/tickets/semaforo.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoVisual, peorEstado } from './semaforo.ts';
import type { ResumenTicket } from './tipos.ts';

const HOY = '2026-10-05';
const tk = (estado: ResumenTicket['estado'], fechaLimite: string | null): ResumenTicket => ({
  id: 't', partidoId: 'p', jugadorId: 'j', jugadorNombre: 'N', titulo: 'T', estado, creadoPor: '', creadoPorNombre: null,
  inicioUtc: null, fechaLimite, partidoEliminado: false, creadoEn: '2026-10-01T00:00:00Z', fechaEvento: null, motivo: null,
});

test('estadoVisual: publicado → completado; pendiente vencido → vencido; pendiente al día → pendiente; cancelado → null', () => {
  assert.equal(estadoVisual(tk('publicado', '2026-10-01'), HOY), 'completado');
  assert.equal(estadoVisual(tk('pendiente', '2026-10-04'), HOY), 'vencido');
  assert.equal(estadoVisual(tk('pendiente', '2026-10-05'), HOY), 'pendiente');
  assert.equal(estadoVisual(tk('pendiente', null), HOY), 'pendiente');
  assert.equal(estadoVisual(tk('cancelado', '2026-10-01'), HOY), null);
});

test('peorEstado: vencido > pendiente > completado; sin estados → null', () => {
  assert.equal(peorEstado(['completado', 'vencido', 'pendiente']), 'vencido');
  assert.equal(peorEstado(['completado', 'pendiente']), 'pendiente');
  assert.equal(peorEstado(['completado', null]), 'completado');
  assert.equal(peorEstado([null]), null);
});
```

`lib/tickets/copiar.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textoCopiarPartido } from './copiar.ts';

test('textoCopiarPartido: equipos, fecha, hora local y de Uruguay, estadio', () => {
  assert.equal(
    textoCopiarPartido({ local: 'Toluca', visitante: 'Atlante', inicioUtc: '2026-10-05T02:00:00Z', zona: 'America/Mexico_City', estadio: 'Estadio Nemesio Díez', ciudad: 'Toluca' }),
    'Toluca vs Atlante\nSábado 4 de octubre\n20:00 hora local · 23:00 hora de Uruguay\nEstadio Nemesio Díez, Toluca',
  );
});

test('textoCopiarPartido: misma hora que Uruguay; sin estadio ni hora', () => {
  assert.equal(
    textoCopiarPartido({ local: 'RB Bragantino', visitante: 'Mirassol', inicioUtc: '2026-10-05T21:30:00Z', zona: 'America/Sao_Paulo', estadio: null, ciudad: null }),
    'RB Bragantino vs Mirassol\nDomingo 5 de octubre\n18:30 hora de Uruguay (misma hora local)',
  );
  assert.equal(
    textoCopiarPartido({ local: 'Genk', visitante: null, inicioUtc: null, zona: null, estadio: 'Cegeka Arena', ciudad: 'Genk' }),
    'Genk vs ?\nFecha a confirmar\nCegeka Arena, Genk',
  );
});
```

Reemplazar en `lib/tickets/permisos.test.ts` los tests de `accionesPermitidas`, `pendientesDe` y `debeActuar` por:
```ts
test('accionesPermitidas: Diseñador completa (pendiente) y reabre (completado); creador/Admin cancelan pendiente; comentan', () => {
  assert.deepEqual(accionesPermitidas({ cargo: 'Diseñador', esCreador: false, estado: 'pendiente' }), ['completar', 'comentar']);
  assert.deepEqual(accionesPermitidas({ cargo: 'Diseñador', esCreador: false, estado: 'publicado' }), ['reabrir', 'comentar']);
  assert.deepEqual(accionesPermitidas({ cargo: 'Administrador', esCreador: false, estado: 'pendiente' }), ['cancelar', 'comentar']);
  assert.deepEqual(accionesPermitidas({ cargo: 'Community Manager', esCreador: true, estado: 'pendiente' }), ['cancelar', 'comentar']);
  assert.deepEqual(accionesPermitidas({ cargo: 'Community Manager', esCreador: false, estado: 'pendiente' }), ['comentar']);
  assert.deepEqual(accionesPermitidas({ cargo: 'Prueba', esCreador: false, estado: 'pendiente' }), []);
});

test('pendientesDe: solo vencidos y por vencer; CM ve sus manuales y todos los automáticos; Prueba nada', () => {
  const HOY = '2026-10-05';
  const l = [
    { ...r('v', 'pendiente', 'felipe', '2026-10-01') },                      // vencido
    { ...r('p', 'pendiente', 'pedro', '2026-10-06') },                       // por vencer
    { ...r('a', 'pendiente', 'felipe', '2026-10-20') },                      // al día → no
    { ...r('c', 'publicado', 'felipe', '2026-10-01') },                      // completado → no
    { ...r('md', 'pendiente', '', '2026-10-04'), automatico: true },         // automático vencido
  ];
  assert.deepEqual(pendientesDe('Diseñador', 'maxi', l, esUrgenteHoy(HOY)).map((x) => x.id), ['v', 'md', 'p']);
  assert.deepEqual(pendientesDe('Administrador', 'felipe', l, esUrgenteHoy(HOY)).map((x) => x.id), ['v', 'md', 'p']);
  assert.deepEqual(pendientesDe('Community Manager', 'pedro', l, esUrgenteHoy(HOY)).map((x) => x.id), ['md', 'p']);
  assert.deepEqual(pendientesDe('Prueba', 'alexis', l, esUrgenteHoy(HOY)), []);
});
```
(borrar los tests viejos de `debeActuar` y el de huérfanos; `debeActuar` pasa a ser `(cargo, usuarioId, t, hoyUy) => pendientesDe(cargo, usuarioId, [t], hoyUy).length > 0`, con un test:)
```ts
test('debeActuar: igual criterio que pendientesDe para un ticket', () => {
  assert.equal(debeActuar('Diseñador', 'maxi', r('v', 'pendiente', 'felipe', '2026-10-01'), esUrgenteHoy('2026-10-05')), true);
  assert.equal(debeActuar('Diseñador', 'maxi', r('a', 'pendiente', 'felipe', '2026-10-20'), esUrgenteHoy('2026-10-05')), false);
});
```

Actualizar `lib/tickets/estados.test.ts`: `TEXTO_ALERTA` pasa a `{ vencido: 'Vencido', por_vencer: 'Vence pronto' }` (claves de urgencia) y `alertasPorPartido(pendientes, hoyUy)`:
```ts
test('alertasPorPartido: "Vencido" le gana a "Vence pronto" en el mismo partido; completados no', () => {
  const HOY = '2026-10-05';
  const a = alertasPorPartido([
    { ...t('a', 'p1', 'pendiente'), fechaLimite: '2026-10-06' },
    { ...t('b', 'p1', 'pendiente'), fechaLimite: '2026-10-01' },
    { ...t('c', 'p2', 'pendiente'), fechaLimite: '2026-10-07' },
    { ...t('d', 'p3', 'publicado'), fechaLimite: '2026-10-01' },
  ], HOY);
  assert.deepEqual(a, { p1: 'Vencido', p2: 'Vence pronto' });
});
```
(reemplaza los 3 tests viejos de `alertasPorPartido`/`TEXTO_ALERTA`; `alertasPorTicket(pendientes, hoyUy)` análogo por id con un test: vencido → 'Vencido').

`lib/tickets/pantalla.test.ts`: `esAbierto('publicado') === false`, `esAbierto('pendiente') === true`, `esAbierto('en_revision') === true`; `urgencia` de `publicado` → null; `filtrarPantalla` con `estado: 'completados'` devuelve solo `publicado`. `FiltroEstado = 'abiertos' | 'completados' | 'todos'`. Reemplazar los tests que usan `'cerrados'` y `'aprobado'` por:
```ts
test('filtrarPantalla: abiertos (pendientes) / completados / todos', () => {
  const l = [tk('a', 'pendiente', null), tk('b', 'publicado', null), tk('c', 'cancelado', null)];
  assert.deepEqual(filtrarPantalla(l, { estado: 'abiertos', urgencia: null }, HOY).map((t) => t.id), ['a']);
  assert.deepEqual(filtrarPantalla(l, { estado: 'completados', urgencia: null }, HOY).map((t) => t.id), ['b']);
  assert.deepEqual(filtrarPantalla(l, { estado: 'todos', urgencia: null }, HOY).map((t) => t.id), ['a', 'b', 'c']);
});
```
y en `urgencia`: `aprobado` deja de existir en el flujo; `urgencia(tk('a','publicado', ...))` → null.

`lib/tickets/vencimiento.test.ts`: `textoVencimiento(..., 'publicado', ...)` → null (ya lo era).

- [ ] **Step 2: RED** — `npm test` → fallan semaforo/copiar (no existen) y los reescritos.

- [ ] **Step 3: Implementar (GREEN).**

`lib/tickets/tipos.ts`: en `ResumenTicket` agregar `/** Ticket automático de Match Day (0030): id 'md:<partido>:<jugador>', se abre el partido. */ automatico?: boolean;`; `export type Accion = 'completar' | 'reabrir' | 'cancelar' | 'comentar';`; `export type EstadoVisual = 'pendiente' | 'completado' | 'vencido';`.

`lib/tickets/semaforo.ts`:
```ts
/**
 * Semáforo de los tickets (0030): 🔴 pendiente, 🟢 completado, 🟡 vencido. Sirve para
 * automáticos y manuales ("completado" de un manual es el estado 'publicado'). Puro.
 *
 * Football First. Creado 2026-09-30.
 */
import { DateTime } from 'luxon';
import type { EstadoVisual, ResumenTicket } from '@/lib/tickets/tipos';

export const META_VISUAL: Record<EstadoVisual, { etiqueta: string; simbolo: string }> = {
  pendiente: { etiqueta: 'Pendiente', simbolo: '●' },
  completado: { etiqueta: 'Completado', simbolo: '✓' },
  vencido: { etiqueta: 'Vencido', simbolo: '!' },
};

export function estadoVisual(t: ResumenTicket, hoyUy: string): EstadoVisual | null {
  if (t.estado === 'cancelado') return null;
  if (t.estado === 'publicado' || t.estado === 'aprobado' || t.estado === 'en_revision') return 'completado';
  if (t.fechaLimite && DateTime.fromISO(t.fechaLimite) < DateTime.fromISO(hoyUy)) return 'vencido';
  return 'pendiente';
}

const ORDEN: EstadoVisual[] = ['vencido', 'pendiente', 'completado'];
export function peorEstado(estados: (EstadoVisual | null)[]): EstadoVisual | null {
  for (const e of ORDEN) if (estados.includes(e)) return e;
  return null;
}
```

`lib/tickets/copiar.ts`:
```ts
/**
 * Texto que copia el botón "Copiar datos del partido" (0030): lo pega el Diseñador en
 * Photoshop sin tipear. Hora local y de Uruguay (si coinciden, una sola línea). Puro.
 *
 * Football First. Creado 2026-09-30.
 */
import { DateTime } from 'luxon';

const UY = 'America/Montevideo';
export function textoCopiarPartido(p: {
  local: string | null; visitante: string | null; inicioUtc: string | null;
  zona: string | null; estadio: string | null; ciudad: string | null;
}): string {
  const lineas = [`${p.local ?? '?'} vs ${p.visitante ?? '?'}`];
  if (p.inicioUtc) {
    const enSede = DateTime.fromISO(p.inicioUtc, { zone: 'utc' }).setZone(p.zona ?? UY).setLocale('es');
    const enUy = DateTime.fromISO(p.inicioUtc, { zone: 'utc' }).setZone(UY);
    const fecha = enSede.toFormat("cccc d 'de' LLLL");
    lineas.push(fecha.charAt(0).toUpperCase() + fecha.slice(1));
    const hl = enSede.toFormat('HH:mm');
    const hu = enUy.toFormat('HH:mm');
    lineas.push(hl === hu ? `${hu} hora de Uruguay (misma hora local)` : `${hl} hora local · ${hu} hora de Uruguay`);
  } else {
    lineas.push('Fecha a confirmar');
  }
  const lugar = [p.estadio, p.ciudad].filter(Boolean).join(', ');
  if (lugar) lineas.push(lugar);
  return lineas.join('\n');
}
```

`lib/tickets/permisos.ts` (reemplazar el cuerpo; mantener cabecera + agregar "2026-09-30: flujo simple (0030)"):
```ts
import type { Accion, EstadoTicket, ResumenTicket } from '@/lib/tickets/tipos';
import { urgencia } from './pantalla';
```
⚠ Import de valor entre módulos testeados: NO permitido. Por eso `pendientesDe` recibe la urgencia ya calculada por el llamador: **`pendientesDe(cargo, usuarioId, tickets, esUrgente: (t) => boolean)`**. Ruling del plan: la firma real es
```ts
export function pendientesDe(cargo: string, usuarioId: string, tickets: ResumenTicket[], esUrgente: (t: ResumenTicket) => boolean): ResumenTicket[]
export function debeActuar(cargo: string, usuarioId: string, t: ResumenTicket, esUrgente: (t: ResumenTicket) => boolean): boolean
```
y los llamadores pasan `(t) => { const u = urgencia(t, hoyUy); return u === 'vencido' || u === 'por_vencer'; }` (helper `esUrgenteHoy(hoyUy)` en `pantalla.ts`). En los tests de arriba, reemplazar el 4.º argumento `HOY` por `esUrgenteHoy(HOY)` importado de `./pantalla.ts` (el test sí puede importar dos módulos).

```ts
const CREADORES = ['Administrador', 'Community Manager'];
const COMENTAN = ['Administrador', 'Community Manager', 'Diseñador'];
export function puedeCrear(cargo: string): boolean { return CREADORES.includes(cargo); }

export function accionesPermitidas(p: { cargo: string; esCreador: boolean; estado: EstadoTicket }): Accion[] {
  const a: Accion[] = [];
  const esRevisor = p.cargo === 'Administrador' || (p.cargo === 'Community Manager' && p.esCreador);
  if (p.cargo === 'Diseñador' && p.estado === 'pendiente') a.push('completar');
  if (p.cargo === 'Diseñador' && p.estado === 'publicado') a.push('reabrir');
  if (esRevisor && p.estado === 'pendiente') a.push('cancelar');
  if (COMENTAN.includes(p.cargo)) a.push('comentar');
  return a;
}

export function debeActuar(cargo: string, usuarioId: string, t: ResumenTicket, esUrgente: (t: ResumenTicket) => boolean): boolean {
  if (cargo === 'Prueba' || !COMENTAN.includes(cargo)) return false;
  if (t.estado !== 'pendiente' || !esUrgente(t)) return false;
  if (cargo === 'Community Manager') return !!t.automatico || t.creadoPor === usuarioId;
  return true;
}

export function pendientesDe(cargo: string, usuarioId: string, tickets: ResumenTicket[], esUrgente: (t: ResumenTicket) => boolean): ResumenTicket[] {
  return tickets
    .filter((t) => debeActuar(cargo, usuarioId, t, esUrgente))
    .sort((a, b) => (a.fechaLimite ?? '9999-12-31').localeCompare(b.fechaLimite ?? '9999-12-31') || a.titulo.localeCompare(b.titulo, 'es'));
}
```

`lib/tickets/pantalla.ts`: `ABIERTOS = ['pendiente']` (+ `'en_revision'`, `'aprobado'` por compatibilidad); `FiltroEstado = 'abiertos' | 'completados' | 'todos'`; en `filtrarPantalla`: `'completados'` → `t.estado === 'publicado'`; `urgencia`: `publicado`/`cancelado` → null, pendiente sin fecha → al_dia; agregar
```ts
export function esUrgenteHoy(hoyUy: string): (t: ResumenTicket) => boolean {
  return (t) => { const u = urgencia(t, hoyUy); return u === 'vencido' || u === 'por_vencer'; };
}
```

`lib/tickets/estados.ts`: `META_ESTADO.publicado = { etiqueta: 'Completado', corta: 'Completado', simbolo: '✓' }`; `TEXTO_ALERTA` → `{ vencido: 'Vencido', por_vencer: 'Vence pronto' } as const`; `alertasPorPartido(pendientes, hoyUy)` y `alertasPorTicket(pendientes, hoyUy)` usan un `urgenciaSimple(fechaLimite, hoyUy)` local (días con luxon; ≤ 2 → por_vencer; < 0 → vencido) — sin importar `pantalla.ts`.

`lib/tickets/vencimiento.ts`: sin cambios de firma (`aprobado`/`publicado` → null).

`lib/repositorios/repositorio-tickets.ts`:
```ts
type FilaMd = { partido_id: string; jugador_id: string; jugador_nombre: string; titulo: string; dia_uy: string | null;
  inicio_utc: string | null; fecha_limite: string | null; estado: 'pendiente' | 'completado' | 'vencido' | null;
  completado_por_nombre: string | null; completado_en: string | null };
const CAMPOS_MD = 'partido_id, jugador_id, jugador_nombre, titulo, dia_uy, inicio_utc, fecha_limite, estado, completado_por_nombre, completado_en';

/** Ticket automático de Match Day como ResumenTicket (0030). `null` si el partido es anterior al arranque. */
export function aResumenAutomatico(f: FilaMd): (ResumenTicket & { completadoPorNombre: string | null }) | null {
  if (f.estado === null) return null;
  return {
    id: `md:${f.partido_id}:${f.jugador_id}`, partidoId: f.partido_id, jugadorId: f.jugador_id, jugadorNombre: f.jugador_nombre,
    titulo: f.titulo, estado: f.estado === 'completado' ? 'publicado' : 'pendiente', creadoPor: '', creadoPorNombre: null,
    inicioUtc: f.inicio_utc, fechaLimite: f.fecha_limite, partidoEliminado: false, creadoEn: f.completado_en ?? f.inicio_utc ?? '',
    fechaEvento: null, motivo: null, automatico: true, completadoPorNombre: f.completado_por_nombre,
  };
}
```
métodos:
```ts
  async listarMatchDay(desdeIso: string, hastaIso: string): Promise<ResumenTicket[]> {
    const { data, error } = await this.supabase.from('tickets_match_day').select(CAMPOS_MD)
      .gte('dia_uy', desdeIso).lte('dia_uy', hastaIso).order('dia_uy', { ascending: true }).returns<FilaMd[]>();
    if (error) throw new Error(`No se pudo leer los tickets de Match Day: ${error.message}`);
    return (data ?? []).map(aResumenAutomatico).filter((t): t is NonNullable<typeof t> => t !== null);
  }
  async listarMatchDayDePartido(partidoId: string) {
    const { data, error } = await this.supabase.from('tickets_match_day').select(CAMPOS_MD).eq('partido_id', partidoId).returns<FilaMd[]>();
    if (error) throw new Error(`No se pudo leer el estado del partido: ${error.message}`);
    return (data ?? []).map(aResumenAutomatico).filter((t): t is NonNullable<typeof t> => t !== null);
  }
```

`lib/tickets/acciones.ts`: `FUNCION` → `{ completar: 'ticket_completar', reabrir: 'ticket_reabrir', cancelar: 'ticket_cancelar', comentar: 'ticket_comentar' }` (quitar `p_link`), y
```ts
export async function marcarDiseno(supabase: Cliente, partidoId: string, jugadorId: string, completado: boolean): Promise<Resultado<null>> {
  const { error } = await supabase.rpc('diseno_partido_marcar', { p_partido: partidoId, p_jugador: jugadorId, p_completado: completado });
  if (error) return { ok: false, mensaje: mensajeError(error) };
  return { ok: true, valor: null };
}
```

`lib/tickets/pendientes-de-sesion.ts`: leer también `listarMatchDay(hoy − 30 días, hoy + 30 días)` y devolver `pendientesDe(cargo, id, [...manuales, ...automáticos], esUrgenteHoy(hoyUy))`.

Corregir todos los llamadores que el compilador marque (`pendientesDe`/`debeActuar`/`alertasPorPartido`/`alertasPorTicket` con el argumento nuevo): `app/(app)/partidos/page.tsx`, `app/(app)/calendario/page.tsx`, `app/(app)/calendario-general/page.tsx`, `components/paneles/PanelPartido.tsx`, `components/tickets/TicketsJugador.tsx`, `components/tickets/SeccionTickets.tsx`, `components/calendario/Calendario.tsx`.

- [ ] **Step 4: GREEN** — `npm test` fail 0; `npx tsc --noEmit -p . | grep -v TS5097` sin salida; lint OK.
- [ ] **Step 5: Commit** — `feat(tickets): lógica, lecturas y acciones de Match Day automático y flujo simple`.

---

### Task 3: Detalle del partido (casillas + Copiar), panel de ticket manual y tarjetas de /partidos

**Files:** Create `components/tickets/PastillaSemaforo.tsx`, `components/tickets/CasillasDiseno.tsx`, `components/tickets/BotonCopiar.tsx`; Modify `components/comunes/Ico.tsx`, `lib/paneles/cargar-detalle-partido.ts`, `components/paneles/PanelPartido.tsx`, `components/tickets/PanelTicket.tsx`, `components/partidos/TarjetaPartido.tsx`, `ListaPartidos.tsx`, `SeccionPartidos.tsx`, `app/(app)/partidos/page.tsx`, `styles/app.css`.

- [ ] **Step 1: Ícono `copiar`** en `Ico.tsx` (acordado por Gerardo 2026-09-30, sin círculo de fondo):
```ts
  copiar: '<rect x="8.5" y="8.5" width="11" height="12" rx="2"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2"/>',
```

- [ ] **Step 2: Componentes.**

`PastillaSemaforo.tsx`:
```tsx
/** Pastilla del semáforo (0030): texto + símbolo + color (el estado no depende solo del color). Football First. Creado 2026-09-30. */
import { META_VISUAL } from '@/lib/tickets/semaforo';
import type { EstadoVisual } from '@/lib/tickets/tipos';
export function PastillaSemaforo({ estado, detalle }: { estado: EstadoVisual; detalle?: string }) {
  const m = META_VISUAL[estado];
  return (
    <span className={`sem sem--${estado}`}>
      <span aria-hidden="true">{m.simbolo}</span> {m.etiqueta}{detalle ? ` · ${detalle}` : ''}
    </span>
  );
}
```

`CasillasDiseno.tsx` (cliente): props `{ partidoId, jugadorId, jugadorNombre, completado: boolean, puedeMarcar: boolean }`; dos `<label className="csd">` con `<input type="checkbox">`: "Pendiente" (`checked`, `disabled`, `aria-describedby` no hace falta) y "Completado" (`checked={completado}`, `disabled={!puedeMarcar || enviando}`, `onChange` → `marcarDiseno(crearClienteNavegador(), partidoId, jugadorId, e.target.checked)` → si ok `router.refresh()` y `await onCambio?.()`; si error, mensaje en `<span role="alert">`). Etiqueta accesible: `Completado — ${jugadorNombre}`.

`BotonCopiar.tsx` (cliente): props `{ texto: string }`; botón `.btn btn--g btn--sm` con `<Ico nombre="copiar" />` y `aria-label="Copiar datos del partido"`; al click: `navigator.clipboard.writeText(texto)` → estado "Copiado" 2 s; si falla → "No se pudo copiar"; el aviso en `<span role="status" aria-live="polite">`.

- [ ] **Step 3: Bundle y panel del partido.** `cargarDetallePartido` suma `matchDay: await repo.listarMatchDayDePartido(partidoId)` (catch → `[]`). En `PanelPartido`, arriba de "Jugadores a cubrir", `<BotonCopiar texto={textoCopiarPartido({ local: d.local.nombre, visitante: d.visitante.nombre, inicioUtc: d.inicioUtc, zona: d.zonaHorariaEvento, estadio: d.estadio, ciudad: d.ciudad })} />`; por jugador, antes de `.tkp`: si hay fila automática `md` para ese jugador → `<PastillaSemaforo estado={estadoVisual(md, bundle.hoyUy)!} detalle={md.fechaLimite ? `vence el ${fechaCortaUy(md.fechaLimite)}` : undefined} />` + `<CasillasDiseno … completado={md.estado === 'publicado'} puedeMarcar={bundle.usuario?.cargo === 'Diseñador'} />` + si completado: `<small>Completado por {md.completadoPorNombre}</small>`.

- [ ] **Step 4: Panel de ticket manual.** `CON_CAMPO` solo `cancelar`; `BOTON` = `{ completar: 'Completar' (btn--a), reabrir: 'Reabrir' (btn--g), cancelar: 'Cancelar ticket' (btn--g) }`; `AVISO_OK` completar/reabrir; pastilla de arriba: `<PastillaSemaforo estado={estadoVisual(ticket, hoyUy) ?? 'pendiente'} />` si no está cancelado (cancelado → `PastillaEstado`); textos del historial: `publicado: 'lo marcó como completado'`, `devuelto: 'lo reabrió'`.

- [ ] **Step 5: Tarjetas de /partidos.** `page.tsx` lee `listarMatchDay(hoyUy, hasta)` y arma `estadoPorPartidoJugador: Record<'<partido>:<jugador>', EstadoVisual>`; `TarjetaPartido` recibe `estadoDiseno?: EstadoVisual` y muestra `<PastillaSemaforo estado={…} />` junto a la cara; la lucecita (`alertaTicket`) viene de `alertasPorPartido(pendientes, hoyUy)` (solo vencidos/por vencer).

- [ ] **Step 6: CSS** (al final de `app.css`):
```css
/* Semáforo de diseño (0030): rojo pendiente, verde completado, amarillo vencido. */
.sem { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 999px; font-size: var(--t-xs); font-weight: 600; white-space: nowrap; }
.sem--pendiente { background: var(--tk-rojo-bg); color: var(--tk-rojo); }
.sem--completado { background: var(--tk-verde-bg); color: var(--tk-verde); }
.sem--vencido { background: var(--tk-amarillo-bg); color: var(--tk-amarillo); }
.csd { display: inline-flex; align-items: center; gap: 8px; min-height: 36px; font-size: var(--t-sm); cursor: pointer; }
.csd input { width: 18px; height: 18px; accent-color: var(--tk-verde-borde); }
.csd input:disabled { cursor: default; }
.mdj { display: flex; align-items: center; gap: 10px 16px; flex-wrap: wrap; padding: 6px 16px 4px; }
```

- [ ] **Step 7: Verificar** tsc/lint/test → limpios. **Commit** `feat(tickets): casillas Pendiente/Completado, botón Copiar y semáforo en partidos`.

---

### Task 4: Pantalla Tickets + globito con automáticos

**Files:** Modify `app/(app)/tickets/page.tsx`, `components/tickets/SeccionTickets.tsx`, `FilaTicket.tsx`, `ContadorTickets.tsx`, `components/layout/BarraInferior.tsx` (sin cambios de lógica: recibe el número).

- [ ] **Step 1:** `page.tsx` lee manuales (`listarParaPantalla`) + automáticos (`listarMatchDay(hoy − 60, hoy + 300)`), concatena y ordena: pendientes primero por fecha límite ascendente, después completados del más nuevo al más viejo. `visiblesPara`: los automáticos los ven Admin, CM y Diseñador (CM: todos los automáticos + sus manuales).
- [ ] **Step 2:** `SeccionTickets`: chips `Abiertos · Completados · Todos`; contadores igual; `FilaTicket` recibe `puedeMarcar` y para `t.automatico` muestra `<CasillasDiseno …>` en la fila (en vez de abrir un ticket, el clic en el título abre `abrir('partido', t.partidoId)`); para manuales sigue abriendo el ticket; la pastilla es `PastillaSemaforo`.
- [ ] **Step 3:** `ContadorTickets`: cada ítem abre `partido` si `t.automatico`, `ticket` si no; la pastilla es `PastillaSemaforo`.
- [ ] **Step 4:** tsc/lint/test; **Commit** `feat(tickets): pantalla Tickets y globito con los tickets automáticos de Match Day`.

---

### Task 5: Calendario unificado con filtros

**Files:** Modify `lib/calendario/eventos.ts` (+test), `lib/repositorios/repositorio-agenda.ts`, `components/calendario/Calendario.tsx`, `app/(app)/calendario/page.tsx`, `app/(app)/calendario-general/page.tsx`, `lib/navegacion/secciones.ts`.

**Interfaces — Produces:** `EventoCalendario.grupo: 'matchday' | 'contenido'`; `type FiltroCalendario = 'todos' | 'matchday' | 'contenido'`; `filtrarCalendario(eventos, filtro)`; `unirEventos(matchday: EventoCalendario[], contenido: EventoCalendario[]): EventoCalendario[]` (sin duplicar por `fuente+refId+diaUy`).

- [ ] **Step 1: Tests (RED)** en `lib/calendario/eventos.test.ts`:
```ts
test('unirEventos + filtrarCalendario: sin duplicados; Match Day solo partidos MD; Contenido fechas y partidos de Contenido', () => {
  const ev = (fuente: EventoCalendario['fuente'], refId: string, diaUy: string, grupo: 'matchday' | 'contenido'): EventoCalendario => ({
    fuente, refId, titulo: refId, diaUy, diaLocalSede: diaUy, cuandoUtc: null, competenciaCodigo: null, esInternacional: false, tentativo: false, grupo,
  });
  const md = [ev('partido', 'p1', '2026-10-03', 'matchday'), ev('cumpleanos', 'j1', '2026-10-01', 'matchday')];
  const co = [ev('cumpleanos', 'j1', '2026-10-01', 'contenido'), ev('partido', 'p9', '2026-10-10', 'contenido')];
  const todos = unirEventos(md, co);
  assert.deepEqual(todos.map((e) => `${e.fuente}:${e.refId}`), ['partido:p1', 'cumpleanos:j1', 'partido:p9']);
  assert.deepEqual(filtrarCalendario(todos, 'matchday').map((e) => e.refId), ['p1']);
  assert.deepEqual(filtrarCalendario(todos, 'contenido').map((e) => e.refId).sort(), ['j1', 'p9']);
});
```
- [ ] **Step 2: Implementar.** `unirEventos`: toma de `matchday` solo `partido`/`convocatoria`/`hito` (las fechas fijas de Match Day ya están en `agenda_contenido`), concatena `contenido`, deduplica por `fuente|refId|diaUy`. `filtrarCalendario('matchday')` = `grupo === 'matchday'`; `'contenido'` = `grupo === 'contenido'`; `'todos'` = todo. `RepositorioAgendaSupabase.listarEventos` agrega `grupo` según la vista (`agenda_anual` → matchday, `agenda_contenido` → contenido); nuevo `listarPartidosContenido(desde, hasta)` lee `proximos_partidos_contenido` y devuelve `EventoCalendario` `fuente:'partido'`, `grupo:'contenido'`, `titulo: \`${club_nombre} vs ${rival_nombre}\``.
- [ ] **Step 3: Página.** `/calendario` lee las 3 fuentes + tickets manuales + `listarMatchDay` → `estadoPorPartido = peorEstado` por partido; recibe `searchParams.f` (`todos` por defecto) y pasa a `Calendario` `filtroInicial`. `Calendario` suma la barra `.barra` de chips (Todos / Match Day / Contenido) que actualiza `?f=` con `router.replace`, y pinta los chips de partido con `sem--<estado>` (clase `ev--sem-<estado>` que colorea el borde izquierdo). `/calendario-general/page.tsx` → `redirect('/calendario?f=contenido')`. Título de la vista: "Calendario".
- [ ] **Step 4: Navegación.** `SECCIONES`: quitar `calendario-general`; `calendario` → `{ etiqueta: 'Calendario', corta: 'Calendario', icono: 'calendario' }`.
- [ ] **Step 5:** CSS `.ev--sem-pendiente { border-left: 3px solid var(--tk-rojo-borde) } .ev--sem-completado { … --tk-verde-borde } .ev--sem-vencido { … --tk-amarillo-borde }`. tsc/lint/test; **Commit** `feat(calendario): un solo calendario con filtros y semáforo de Match Day`.

---

### Task 6: QA en navegador + avances

- [ ] **Step 1:** Script `qa-match-day.mjs` (scratchpad) contra `:3100`: Maxi abre un partido futuro, tilda Completado (verifica en `disenos_partido` con service role), el chip del calendario queda verde; destilda → rojo; Felipe no puede tildar (casilla deshabilitada); Copiar (`navigator.clipboard.readText()` con permisos del contexto) devuelve el texto esperado; `/calendario?f=matchday` y `?f=contenido` muestran lo correcto; `/calendario-general` redirige; globito de Maxi = vencidos + por vencer; 390 px sin scroll; pantalla Tickets con automáticos y la casilla en la fila. Limpieza: destildar todo lo tildado y cancelar tickets manuales de QA.
- [ ] **Step 2:** Apagar dev (TaskStop + Stop-Process).
- [ ] **Step 3:** `avances.md` §5: marcar puntos 1, 2, 3 y 5 hechos, con la fecha de `match_day_desde()` usada.
- [ ] **Step 4: Commit.**
