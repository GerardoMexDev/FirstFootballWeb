# Spec — Calendario General (2º calendario) + "Match Day"

> Football First (Fase 1). Pedido de la agencia, previo al cierre de Fase 1.
> Diseño acordado con Gerardo el 2026-09-10 (Sesión 7). Camino A.

## 1. Problema y objetivo

La agencia ofrece **dos servicios** distintos sobre distintos grupos de jugadores:

- **Match Day** — seguimiento de fixture (partidos, horarios, hitos). Es lo que hoy
  vive en `/calendario`. Cubre a los **6 representados** de siempre.
- **Contenido / "otros servicios"** — la agencia prepara arte y comunicación para un
  grupo más amplio (12 jugadores), sin seguir sus partidos. Para eso necesitan un
  segundo calendario con **fechas de contenido**: cumpleaños, aniversario de fundación
  del club, aniversario del debut en selección y aniversario del debut profesional.

Objetivo de este cambio:

1. Renombrar la vista actual `/calendario` a **"Match Day"** (solo el rótulo; nada de
   su lógica ni sus datos cambia).
2. Agregar una vista nueva **"Calendario general"** en `/calendario-general` con las
   fechas de contenido de los 12 jugadores de la pestaña **"Nuevos"** del Excel
   `Datos de jugadores y clubes.xlsx`.
3. Los 7 jugadores genuinamente nuevos aparecen también en la vista **Jugadores** y en
   el **buscador ⌘K**, marcados como servicio "Contenido", con una **ficha slim**
   (sin bloques de partidos / estadísticas / hitos).

**Restricción dura de Gerardo:** este cambio "no debe mover mucho". Match Day queda
**idéntico byte a byte**; el resto de la Fase 1 no se toca salvo lo estrictamente
necesario para enganchar la vista nueva.

## 2. Alcance

### Entra

- Nav de 4 ítems: **Partidos · Match Day · Calendario general · Jugadores**.
- Rótulo de `/calendario` → "Match Day" (ruta y carpeta **sin renombrar**).
- Ruta y página nuevas `/calendario-general`, misma estructura visual que `/calendario`
  (`.head` + `<NotasAgenda>` + `<Calendario>`), alimentada por una vista nueva.
- Migración `0014`: 2 columnas de servicio en `jugadores`, guardia en `agenda_anual`,
  vista nueva `agenda_contenido`.
- Los 7 jugadores nuevos + sus 4 clubes nuevos, cargados por un seed idempotente.
- `servicio_contenido = true` en los 5 jugadores que ya existían y están en "Nuevos".
- Badge "Contenido" en la grilla y en el buscador; ficha slim + su panel + su endpoint.
- Enriquecer posición / nacionalidad / foto de los 7 nuevos desde API-Football (free);
  lo que no resuelva queda "Sin datos".

### No entra

- Fixtures / partidos de los jugadores nuevos (el servicio Contenido no los sigue).
- Cambiar cualquier dato de Match Day, incluidas las fundaciones de club del seed
  actual. **Ver §9 — tarea de investigación** por la discrepancia de fundaciones
  (Atlante, Bragantino) entre la pestaña "Nuevos" y el seed vigente.
- Nahitan Nández en el Calendario General (no está en la pestaña "Nuevos"; decisión de
  Gerardo: el roster del Calendario General es exactamente esa lista).
- Foto grande en la ficha slim, edición de estos datos desde la UI (sigue siendo seed).

## 3. Datos de origen — pestaña "Nuevos" del Excel

12 filas. Columnas: `Jugador`, `Fecha de nacimiento`, `Fecha de debut` (profesional),
`Equipo actual`, `País actual`, `Fundación del equipo`, `Debut en selección`.

| Jugador | ¿Ya existía? | Club en "Nuevos" |
|---|---|---|
| Rodrigo Aguirre | nuevo | Tigres UANL |
| Sergio Rochet | nuevo | SC Internacional |
| Abel Hernández | nuevo | CA Peñarol |
| Gastón Martirena | nuevo | Club Nacional |
| Luis Mejía | nuevo | Club Nacional |
| Maximiliano Silvera | nuevo | Club Nacional |
| Franco Romero | nuevo | CA Peñarol |
| Federico Pereira | sí (id_externo 67884) | Deportivo Toluca FC |
| Ignacio Sosa | sí (310307) | Red Bull Bragantino |
| Javier Méndez | sí (6122) | Colo-Colo |
| Kevin Amaro | sí (377326) | KRC Genk |
| Martín Fernández | sí (51549) | CF Atlante |

Clubes nuevos a crear: **Tigres UANL, SC Internacional, CA Peñarol, Club Nacional**
(los otros 5 clubes ya existen).

Fechas en la pestaña vienen en texto libre en español ("1 de octubre de 1994",
"Mayo de 2022", "Temp. 2013-14", "No aplica", "Sin debut en la mayor",
"9 de septiembre de 2025 (Panamá)"). **No se parsea**: el seed lleva los valores ISO
normalizados a mano (mismo patrón interino que `scripts/seed-datos-manuales.mjs`).
Regla: si falta el día → la fecha va `null` (no se proyecta ese aniversario); si dice
"No aplica" / "Sin debut" → `null`. El paréntesis con país ("(Panamá)") se ignora
(la nacionalidad viene de API-Football; ver §7).

## 4. Navegación y rótulos

### `components/layout/Nav.tsx`

`SECCIONES` pasa a 4 entradas:

```ts
{ v: 'partidos', etiqueta: 'Partidos' }
{ v: 'calendario', etiqueta: 'Match Day' }
{ v: 'calendario-general', etiqueta: 'Calendario general' }
{ v: 'jugadores', etiqueta: 'Jugadores' }
```

`.nav` de la demo ya hace `overflow-x:auto` en ≤720px (demo.css línea 399), así que 4
botones no rompen el header en mobile. Sin CSS nuevo por esto.

### `app/(app)/calendario/page.tsx`

Único cambio: el `<h1 class="d1">` deja de decir "Calendario / anual" y dice
**"Match Day"**; la `<p class="sub">` se ajusta a una bajada acorde (sigue hablando de
fixture y horarios). Nada más de este archivo cambia.

### `app/(app)/calendario-general/page.tsx` (nuevo)

Copia de la estructura de `calendario/page.tsx`:

- `hoyUy` + `anio` igual.
- `new RepositorioAgendaSupabase(cliente, 'agenda_contenido')` (ver §6).
- `repo.listarEventosParaNotas(hoyUy)` + `repo.listarEventos(<ventana [-1,+2] años>)`.
- `notasProximas(eventosNota, hoyUy, { fuentes: FUENTES_CONTENIDO })` donde
  `FUENTES_CONTENIDO` incluye `aniversario_debut` (ver §6).
- Render: `<section class="vista on" id="v-calendario-general">` con `.head`
  (`<h1>Calendario general</h1>` + bajada), `<NotasAgenda>`, `<Calendario>`.

## 5. Migración `supabase/migrations/0014_calendario_general.sql`

`begin; … commit;`. Cabecera de comentario con el porqué (dos servicios) y cómo
revertir.

### 5.1 Columnas de servicio en `jugadores`

```sql
alter table jugadores
  add column servicio_match_day boolean not null default true,
  add column servicio_contenido boolean not null default false;

comment on column jugadores.servicio_match_day is
  'Servicio "Match Day": la agencia sigue el fixture de este jugador. Los 6 representados históricos. Alimenta agenda_anual y la vista partidos.';
comment on column jugadores.servicio_contenido is
  'Servicio "Contenido": la agencia prepara arte/comunicación para este jugador. Alimenta agenda_contenido (Calendario General). Puede coincidir con servicio_match_day.';
```

`default true` en `servicio_match_day` deja a los 6 actuales dentro de Match Day sin
tocar una fila. El seed (§7) pone `servicio_match_day = false` a los 7 nuevos y
`servicio_contenido = true` a los 12.

### 5.2 `create or replace view agenda_anual`

Mismo cuerpo que `0013` con **un guardia** en los bloques que proyectan por jugador /
club:

- Bloque 4 (cumpleaños): `where jg.fecha_nacimiento is not null and jg.servicio_match_day`
- Bloque 6 (aniversario_seleccion): `where jg.debut_seleccion is not null and jg.servicio_match_day`
- Bloque 5 (aniversario_club): `where cbb.fecha_fundacion is not null and exists (
    select 1 from jugadores jx where jx.club_actual_id = cbb.id and jx.servicio_match_day)`
- Bloques 1–3 (partidos / convocatorias / hitos): **sin tocar**. Partidos entra por
  `proximos_partidos` (INNER `join partidos_jugadores` → los nuevos no tienen filas);
  convocatorias e hitos son filas reales que solo existen para los 6.

**Efecto hoy:** salida idéntica. Los 6 son todos `servicio_match_day`; cada uno de sus
6 clubes tiene al menos un jugador `servicio_match_day`. Se verifica con un diff del
set de eventos antes/después (ver §8).

### 5.3 `create view agenda_contenido`

`with (security_invoker = true)`. Cuatro `union all` de fecha fija, **misma lista de
columnas y en el mismo orden** que `agenda_anual` (`fuente, ref_id, jugador_id,
club_id, titulo, cuando_utc, dia_uy, competencia_codigo, es_internacional, tentativo,
dia_local_sede`) para poder reusar `EventoCalendario` y el mapeo del repositorio.
Todos los bloques: `cuando_utc` = `(dia + time '12:00') at time zone 'America/Montevideo'`,
`dia_local_sede` = `dia_uy`, `competencia_codigo` = `null`, `es_internacional` =
`false`, `tentativo` = `false`.

1. `cumpleanos` — de `jugadores` con `fecha_nacimiento is not null and servicio_contenido`,
   proyectado a la ventana de años `[-1, +2]` (mismo `generate_series` +
   `make_date` que `agenda_anual`). `titulo` = `'Cumpleaños de ' || coalesce(apodo, nombre)`.
2. `aniversario_club` — de `clubes` con `fecha_fundacion is not null and exists (
   jugador servicio_contenido en ese club)`, misma proyección de años.
   `titulo` = `'Aniversario de ' || nombre`.
3. `aniversario_seleccion` — de `jugadores` con `debut_seleccion is not null and
   servicio_contenido`. `titulo` = `'Aniversario del debut con la selección de ' || coalesce(apodo, nombre)`.
4. `aniversario_debut` (**fuente nueva**) — de `jugadores` con `debut is not null and
   servicio_contenido`. `titulo` = `'Aniversario del debut profesional de ' || coalesce(apodo, nombre)`.

`comment on view agenda_contenido is 'Fechas de contenido (cumpleaños, aniversarios de club / debut en selección / debut profesional) del servicio Contenido — roster servicio_contenido. Alimenta la vista /calendario-general. Sin sede: dia_local_sede = dia_uy.';`

### 5.4 RLS

Sin cambios. `security_invoker = true` hace que la vista lea con las policies de
`jugadores` / `clubes` del usuario que consulta, igual que `agenda_anual`. Las filas
nuevas de `jugadores` / `clubes` quedan cubiertas por las policies de tabla existentes.

### 5.5 Reversión

`create or replace view agenda_anual` con el cuerpo de `0013` + `drop view
agenda_contenido` + `alter table jugadores drop column servicio_contenido,
drop column servicio_match_day`.

### 5.6 Post-migración

`npm run tipos:db` → regenera `lib/supabase/tipos-db.ts` con `agenda_contenido` y las
2 columnas nuevas.

## 6. Capa de datos (lib)

### `lib/agenda/notas-proximas.ts`

- `FuenteAgenda` suma `'aniversario_debut'`.
- `textoFuente`: caso `'aniversario_debut'` → `'Aniversario de debut profesional'`.
- Export nuevo `FUENTES_CONTENIDO: readonly FuenteAgenda[] = ['cumpleanos',
  'aniversario_club', 'aniversario_seleccion', 'aniversario_debut']`.
- `FUENTES_NOTA` (Match Day) **no cambia**.

### `lib/repositorios/repositorio-agenda.ts`

- Constructor: `constructor(private supabase, private vista: 'agenda_anual' |
  'agenda_contenido' = 'agenda_anual')`. Los `.from('agenda_anual')` pasan a
  `.from(this.vista)`.
- `FUENTES_FECHA_FIJA` suma `'aniversario_debut'` (inocuo para `agenda_anual`: no
  tiene esas filas).
- `listarEventos` y `listarEventosParaNotas` sin más cambios: `agenda_contenido`
  tiene la misma forma de columnas, `select('*')` + el mapeo actual funcionan.

### `lib/calendario/eventos.ts`

- `EventoCalendario` no cambia de forma (la `fuente` ahora puede ser
  `aniversario_debut` vía el tipo `FuenteAgenda`).
- Sin lógica de sede para la fuente nueva (`diaLocalSede === diaUy`, ya lo garantiza
  la vista).

### `components/calendario/Calendario.tsx`

- `chipEvento`: caso `'aniversario_debut'` → `{ etiqueta: 'Debut profesional', texto: e.titulo }`.
- Nada más (los chips de aniversario ya son `<div>` no interactivos).

### `lib/repositorios/tipos.ts` + `repositorio-jugadores.ts`

- `JugadorPlantel` suma `soloContenido: boolean`.
- `CAMPOS_PLANTEL` suma `servicio_match_day, servicio_contenido`.
- `FilaJugadorPlantel` suma esos 2 boolean; `aJugadorPlantel` deriva
  `soloContenido = fila.servicio_contenido && !fila.servicio_match_day`.
- `listar()` sigue con `.eq('activo', true)` → los 7 nuevos entran solos.

## 7. Jugadores nuevos: grilla, buscador, ficha slim

### `components/jugadores/GrillaPlantel.tsx`

- Cuando `jugador.soloContenido` y no hay `hitoFrase`: en el hueco de la píldora
  (`jug__pais` / `jug__hito`) se muestra un pill **"Contenido"** con clase nueva
  `jug__servicio` (definida en `styles/app.css`, **no** en `demo.css`).
- `onAbrir`: si `soloContenido` → `abrir('jugador-contenido', id)`, si no → `abrir('jugador', id)`.
- Fila de stats: sin cambios (los `null` ya se pintan "—").

### `lib/paneles/use-panel.ts`

- `TipoPanel` suma `'jugador-contenido'`; `TIPOS` también.

### `components/paneles/PanelLateral.tsx`

- `Contenido` suma `{ fase: 'jugador-contenido'; datos: FichaContenidoBundle }`.
- El `useEffect` de fetch: para `tipo === 'jugador-contenido'` pega a
  `/api/paneles/jugador-contenido?id=…` (misma mecánica de 404 / error).
- `titulo` para ese tipo: `'Ficha del jugador'`.
- Render: `<PanelJugadorContenido bundle={…} />`.

### `lib/jugadores/cargar-ficha-contenido.ts` (nuevo)

```ts
export interface ProximaFecha {
  fuente: 'cumpleanos' | 'aniversario_seleccion' | 'aniversario_debut'; // aniversario_club se arma aparte
  etiqueta: string;      // "Cumpleaños", "Debut en selección", "Debut profesional", "Fundación del club"
  proximaIso: string;    // YYYY-MM-DD de la próxima ocurrencia (>= hoyUy)
}
export interface FichaContenidoBundle {
  jugador: JugadorFicha;   // ya trae fecha_nacimiento, debut, debut_seleccion, fichaje, instagram, nacionalidad, club
  proximas: ProximaFecha[]; // ordenadas por proximaIso; vacío si el jugador no tiene ninguna
  hoyUy: string;
}
export async function cargarFichaContenido(supabase, jugadorId): Promise<FichaContenidoBundle | null>
```

`obtener(id)` + `hoyUy` + `proximas` calculado con un helper puro nuevo
`proximoAniversario(fechaIso, hoyUy): string | null` en `lib/jugadores/datos-contenido.ts`
(ancla mes/día, lo lleva al año en curso o al siguiente si ya pasó). La fundación del
club sale de `jugador.clubNombre` + un `select fecha_fundacion` puntual del club.
Devuelve `null` si el jugador no existe, está inactivo, **o no es `servicio_contenido`**.
`CAMPOS_FICHA` ya hereda las 2 banderas de `CAMPOS_PLANTEL` (§6), así que `obtener`
puede exponer `soloContenido` sin columnas extra; solo se agrega el campo a
`FilaJugadorFicha` / el mapeo.

### `app/api/paneles/jugador-contenido/route.ts` (nuevo)

Espejo de `app/api/paneles/jugador/route.ts`: cliente SSR (cookies → RLS),
`cargarFichaContenido`, 404 si `null`, si no JSON del bundle.

### `components/paneles/PanelJugadorContenido.tsx` (nuevo) + `components/jugadores/FichaContenido.tsx` (nuevo)

`FichaContenido` = render puro, clases 1:1 de la demo. Contenido:

- Cabecera igual que `FichaJugador`: `<Escudo crest--lg>` + `<h2 class="d2">` con el
  nombre; `<div class="linea">` con club / país del club / posición / edad.
- **Un** `.bloque` "Datos para contenido" — markup calcado del bloque homónimo de
  `FichaJugador` (edad, años/meses en el club, años de carrera; línea con cumpleaños +
  nacionalidad; `.redes` con Instagram o "Sin datos"). Usa `datosParaContenido`.
- **Un** `.bloque` "Fechas señaladas" — lista `.lst` con `bundle.proximas` (cada ítem:
  etiqueta + fecha de la próxima ocurrencia en texto). Si `bundle.proximas` está vacío
  → `<EstadoSinDatos>`.
- **No** hay bloques de Hitos, Este año, Carrera, Selección ni Próximos partidos.

`PanelJugadorContenido` envuelve `<FichaContenido {...bundle} />` (igual que
`PanelJugador` con `FichaJugador`).

### `app/(app)/jugadores/[jugadorId]/page.tsx`

Si el jugador resuelto es `soloContenido` → renderiza `<FichaContenido>` en vez de la
ficha completa (evita una página llena de "Sin datos"). Rama mínima.

### Buscador

- `lib/buscador/indexar.ts`: sin cambios (indexa `jugadores` genérico; los nuevos
  entran por `listar()`).
- `components/buscador/Buscador.tsx`: el row de resultado de jugador, si
  `j.soloContenido`, enruta a `rutaPanel(pathname, 'jugador-contenido', id)` y muestra
  un tag chico "Contenido" (clase nueva en `styles/app.css`).
- `app/api/buscador/route.ts`: sin cambios.

### `styles/app.css`

Solo reglas nuevas (nunca se toca `demo.css`): `.jug__servicio` (pill de la grilla) y
el tag "Contenido" del buscador. Mismos tokens que la demo.

## 8. Seeds y enriquecimiento

### `scripts/seed-jugadores-contenido.mjs` — `npm run seed:jugadores-contenido`

Mismo molde que `seed-datos-manuales.mjs`: `process.loadEnvFile('.secretos/.env')`,
`service_role`, idempotente, matchea por `(proveedor_externo, id_externo)`, siempre
`update` (o `insert` la primera vez), imprime diff.

1. **Clubes** (upsert 4): Tigres UANL, SC Internacional, CA Peñarol, Club Nacional.
   `origen='manual'`, `proveedor_externo='api-football'`, `id_externo` = id de equipo
   de API-Football (fijo en el script, buscado una vez con `GET /teams?search=`),
   `pais`, `fecha_fundacion` (ISO, normalizada de la pestaña "Nuevos").
2. **Jugadores nuevos** (upsert 7): `origen='manual'`,
   `proveedor_externo='api-football'`, `id_externo` = id de jugador de API-Football
   (fijo en el script), `nombre`, `fecha_nacimiento`, `debut`, `debut_seleccion`
   (ISO normalizado; `null` donde falta día o dice "No aplica"),
   `club_actual_id` ← id del club del paso 1, `activo=true`,
   `servicio_match_day=false`, `servicio_contenido=true`.
3. **Los 5 que ya existían**: `update servicio_contenido=true` por `id_externo`
   (67884, 310307, 6122, 377326, 51549). No se les toca `servicio_match_day` ni
   ningún otro campo.

### `scripts/enriquecer-jugadores-contenido.mjs` — `npm run enriquecer:jugadores-contenido`

Solo lectura contra API-Football (plan free) para los 7 nuevos:
`GET /players/profiles?player=<id>` (o `GET /players?id=<id>&season=<año>` de fallback)
→ `posicion`, `nacionalidad`, `foto_url` (URL `media.api-sports.io`). `update` solo de
esos 3 campos, y solo si vienen. Lo que no resuelva queda `null` → la UI muestra
"Sin datos". **Riesgo:** si el plan free no devuelve estos endpoints para estos ids,
Gerardo pasa las 7 posiciones + nacionalidades a mano y se cargan en el seed.

### Escudos de los 4 clubes nuevos

Re-correr `npm run seed:escudos` (ya deriva la URL del CDN del proveedor desde
`id_externo`). Los que el CDN no tenga quedan con iniciales (fallback de `<Escudo>`).

### `package.json`

Suma `seed:jugadores-contenido` y `enriquecer:jugadores-contenido` a `scripts`.

## 9. Tarea de investigación (no bloquea este cambio)

La pestaña "Nuevos" trae fundaciones que **no coinciden** con el seed vigente:

- **Atlante** — "Nuevos": 8 dic 1918 · seed (`seed-datos-manuales.mjs`): 1916-04-18.
- **RB Bragantino** — "Nuevos": 8 ene 1928 · seed: 2020-01-01 (fecha de la refundación
  como Red Bull, no del club histórico).

Se **deja el seed como está** (no se toca Match Day). Queda anotado en
`planeacion/avances.md` §5 como tarea: verificar cuál fundación quiere la agencia para
cada uno y unificar.

## 10. Verificación (interna, nunca en producción)

Orden:

1. `npm test` — casos nuevos en `lib/calendario/eventos.test.ts` (chip
   `aniversario_debut`) y en el helper puro de "próximo aniversario" si se agrega.
   `npm run build` + `npm run lint`.
2. Aplicar `0014`: `npm run migracion supabase/migrations/0014_calendario_general.sql`
   → `npm run tipos:db`.
3. **Gate "Match Day intacto":** en la BD, comparar el set de filas de `agenda_anual`
   en una ventana fija (p. ej. `dia_uy` de todo 2026) antes y después de `0014` — debe
   ser idéntico. Además `browser-automation` con login real sobre `/calendario`:
   mismos eventos, misma densidad, 0 errores.
4. `npm run seed:jugadores-contenido` → verificar contadores:
   `select count(*) from jugadores where servicio_contenido` = 12;
   `… where servicio_match_day` = 6; 7 filas nuevas de jugadores; 4 clubes nuevos.
5. `npm run enriquecer:jugadores-contenido` → ver cuántos de los 7 quedaron con
   posición / nacionalidad / foto.
6. `browser-automation` con login real:
   - `/calendario-general`: cumpleaños / aniversarios de los 12; nav con 4 ítems;
     "Fechas señaladas" con las fuentes de contenido; 0 errores.
   - `/jugadores`: 13 tarjetas, badge "Contenido" en 7, clic abre la ficha slim.
   - Buscador: un jugador nuevo aparece y abre el panel slim.
   - `/calendario` (Match Day): idéntico a antes.
7. Contadores de tests (subir el número en `avances.md`), `build` + `lint` OK.

## 11. Archivos

### Nuevos

- `supabase/migrations/0014_calendario_general.sql`
- `app/(app)/calendario-general/page.tsx`
- `components/paneles/PanelJugadorContenido.tsx`
- `components/jugadores/FichaContenido.tsx`
- `lib/jugadores/cargar-ficha-contenido.ts`
- `app/api/paneles/jugador-contenido/route.ts`
- `scripts/seed-jugadores-contenido.mjs`
- `scripts/enriquecer-jugadores-contenido.mjs`
- `lib/calendario/eventos.test.ts` (si no existe; casos del chip nuevo)

### Modificados

- `components/layout/Nav.tsx`
- `app/(app)/calendario/page.tsx` (solo rótulo)
- `lib/agenda/notas-proximas.ts`
- `lib/repositorios/repositorio-agenda.ts`
- `lib/repositorios/repositorio-jugadores.ts`
- `lib/repositorios/tipos.ts`
- `components/calendario/Calendario.tsx`
- `components/jugadores/GrillaPlantel.tsx`
- `components/buscador/Buscador.tsx`
- `lib/paneles/use-panel.ts`
- `components/paneles/PanelLateral.tsx`
- `app/(app)/jugadores/[jugadorId]/page.tsx`
- `styles/app.css`
- `package.json`
- `lib/supabase/tipos-db.ts` (regenerado)
- `planeacion/avances.md` (§4, §5, contadores — al cierre de sesión)

## 12. Decisiones tomadas (no reabrir sin motivo)

- Camino A (banderas en `jugadores`), no tablas separadas: los nuevos deben verse en
  la grilla y el buscador, que ya leen de `jugadores`.
- `/calendario` **no** se renombra como ruta (solo el rótulo) para no romper
  marcadores ni el deploy.
- `agenda_contenido` es una vista propia y chica, no un filtro sobre `agenda_anual`:
  deja Match Day sin riesgo y no arrastra partidos / convocatorias / hitos.
- Las fechas de la pestaña "Nuevos" se cargan a mano en el seed (texto libre en
  español, algunas parciales), igual que el resto de datos manuales de Fase 1.
- Nahitan Nández no va al Calendario General (no está en "Nuevos").
- Fundaciones del seed actual (Atlante, Bragantino): no se tocan → §9.
