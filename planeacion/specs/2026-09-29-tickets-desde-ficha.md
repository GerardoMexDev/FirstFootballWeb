# Tickets de diseño desde la ficha del jugador (sin partido) — Especificación

**Fecha:** 2026-09-29 · **Estado:** diseño aprobado en conversación por Gerardo, pendiente de revisión escrita
**Pedido original (Gerardo, revisando en prod 2026-09-29):** "en las fichas de jugador agregá la
posibilidad de hacer un ticket: el CM o el Admin pueden cargar que se haga un diseño sobre el
cumpleaños de Rodrigo Aguirre, por ejemplo". Ampliado en la conversación: también fechas que no
vienen de Contenido, p. ej. "convocado a la selección: Uruguay vs Brasil, tal día".
**Contexto:** la agencia va a probar este flujo junto con la pantalla Tickets
(`2026-09-29-pantalla-tickets.md`). Rodrigo Aguirre cumple el 1/10.

## 1. Objetivo y criterio de éxito

Que Felipe (Admin) o Pedro (CM) pidan un diseño para un jugador **atado a una fecha** (no a un
partido) desde su ficha, y que ese ticket viva el mismo ciclo que los de partido. Éxito: Felipe abre
la ficha de Aguirre, elige "Cumpleaños · jue 1/10", escribe la nota y crea; Maxi lo ve con la
lucecita en la ficha, en la pantalla Tickets, en el globito y en el Calendario general, lo entrega,
Felipe lo aprueba y Maxi lo publica.

## 2. Decisiones tomadas (Gerardo, 2026-09-29)

| Tema | Decisión |
|---|---|
| Quién crea | Administrador y Community Manager (igual que los de partido) |
| Qué fecha | Se elige de las **próximas fechas de Contenido** del jugador (cumpleaños, aniversario del club, debut en selección, debut profesional) o **"Otra fecha"** (fecha + motivo a mano) |
| Fecha límite | 2 días antes de la fecha del evento (`ticket_dias_anticipacion()`, la misma que los de partido) |
| Calendario general | Chip del ticket en el día del evento |
| Cantidad | Puede haber más de un ticket por jugador |
| Modelo de datos | Opción 1: dos columnas nuevas en `tickets` (no una tabla de eventos) |

## 3. Base de datos — migración `0028_tickets_evento.sql`

- `tickets` suma:
  - `fecha_evento date` (nullable) y `motivo text` (nullable, `char_length between 1 and 120`).
  - `check (partido_id is null or fecha_evento is null)` → un ticket es de partido **o** de fecha.
  - `check ((fecha_evento is null) = (motivo is null))` → fecha y motivo van juntos.
  - Índice `tickets_fecha_evento_idx on tickets (fecha_evento) where fecha_evento is not null`.
- `tickets_vista` (`create or replace`, mismas columnas + 2 nuevas al final — Postgres solo deja agregar columnas al final):
  - `fecha_limite` = la de hoy si hay partido/`inicio_utc_conocido`; si no, `fecha_evento − ticket_dias_anticipacion()`.
  - `partido_eliminado` = `t.partido_id is null and t.fecha_evento is null` (un ticket de fecha NO es huérfano).
  - Nuevas: `fecha_evento`, `motivo`.
  - Mantiene `security_invoker = true` y el `revoke all` a anon/authenticated (la vista se reemplaza: re-aplicar el revoke).
- Función nueva `ticket_crear_evento(p_jugador uuid, p_fecha date, p_motivo text, p_nota text) returns uuid`,
  `security definer`, `search_path = public`, mismo patrón que `ticket_crear`:
  - Cargo Administrador o Community Manager; si no → `42501` "Solo el Administrador o el Community Manager pueden crear tickets."
  - Nota: `ticket__texto(p_nota, true, 'Escribí qué hay que hacer.')`. Motivo: recortado, 1–120 caracteres → si no, error P0001 "Escribí el motivo (hasta 120 caracteres)."
  - Fecha: no nula y `>= hoy en Uruguay` → si no, P0001 "La fecha del evento no puede ser anterior a hoy."
  - Jugador activo y `servicio_contenido` → si no, P0001 "Ese jugador no está en el servicio de Contenido."
  - Título: `'Contenido — ' || coalesce(apodo, nombre) || ' · ' || motivo || ' (' || d/m || ')'` (ej. "Contenido — Rodrigo Aguirre · Cumpleaños (1/10)").
  - Inserta ticket (`partido_id` null, `fecha_evento`, `motivo`) + historial `creado`, igual que `ticket_crear`.
  - `revoke all … from public, anon; grant execute … to authenticated`.
- El resto de las funciones (`entregar`, `aprobar`, `devolver`, `publicar`, `cancelar`, `comentar`) **no cambian**: no miran el partido.
- Los avisos de partido (triggers sobre `partidos`) no aplican a estos tickets (no tienen partido).
- La aplica **Gerardo** en el SQL Editor; Claude la prueba antes en una transacción con ROLLBACK y verifica después con lecturas reales.

## 4. Front

### 4.1 Tipos y lecturas
- `ResumenTicket` suma `fechaEvento: string | null` (yyyy-mm-dd) y `motivo: string | null`.
- `RepositorioTicketsSupabase` lee las 2 columnas en `CAMPOS_RESUMEN`/`CAMPOS`, y suma:
  - `listarPorJugador(jugadorId)` → tickets no cancelados del jugador (de partido y de fecha), del más nuevo al más viejo.
  - `listarEventosEntre(desdeIso, hastaIso)` → tickets no cancelados con `fecha_evento` en el rango (para el Calendario general).
- Acción nueva `crearTicketEvento({ jugadorId, fecha, motivo, nota })` en `lib/tickets/acciones.ts` (llama a la RPC, errores por `mensajeError`).

### 4.2 Lógica pura (con tests)
- `proximasFechas(jugador, hoyUy)` (sacada de `cargar-ficha-contenido.ts`, que pasa a usarla): lista `{ etiqueta, proximaIso }` ordenada.
- `motivoDeFecha(etiqueta)` → el motivo que se guarda ("Cumpleaños", "Aniversario de Tigres UANL", "Debut en selección", "Debut profesional").
- `textoEvento(t)` → "Cumpleaños · jue 1/10" (para el panel del ticket y el chip).

### 4.3 Ficha del jugador — bloque "Tickets de diseño"
- Componente `TicketsJugador` en **las dos fichas** (`FichaJugador` de Match Day y `FichaContenido`), debajo de los botones de Dropbox:
  - Lista de tickets abiertos del jugador (`PastillaEstado` + título + `AlertaTicket` si `debeActuar`); clic → `abrir('ticket', id)`.
  - Botón "Crear ticket de diseño" solo si `puedeCrear(cargo)`. Si la lectura de tickets falló, no se ofrece crear (mismo criterio que el panel del partido).
- Formulario `CrearTicketEvento`:
  - "¿Para qué fecha?": radios con las próximas fechas de Contenido ("Cumpleaños · jue 1/10") + "Otra fecha".
  - "Otra fecha" muestra `<input type="date" min={hoyUy}>` + motivo (`maxLength=120`, placeholder "Convocado a la selección: Uruguay vs Brasil").
  - "¿Qué hay que hacer?": textarea obligatoria (`maxLength=2000`).
  - "Crear ticket" → al crear, `router.refresh()` y se abre el panel del ticket nuevo. Errores en `role="alert"`.
- Los bundles `cargarFichaJugador` y `cargarFichaContenido` suman `tickets`, `ticketsError`, `usuario { id, cargo }` y `proximas` (la de Match Day hoy no las trae).

### 4.4 Panel del ticket
- Si `fechaEvento`: en lugar de "Partido: …" muestra "**Cumpleaños · jue 1/10**" (`textoEvento`), y en lugar de "Ver partido" el botón "**Ver jugador**" (`abrir('jugador' | 'jugador-contenido', jugadorId)` según el tipo de jugador — el bundle del ticket suma `soloContenido`).

### 4.5 Calendario general
- `/calendario-general` lee `listarEventosEntre` (misma ventana que el calendario) y `pendientesDeSesion()`.
- `Calendario` recibe `ticketsPorDia: Record<yyyy-mm-dd, ResumenTicket[]>` y `alertasPorTicket: Record<id, texto>`; en la celda pinta un chip por ticket: pastilla de estado + "Aguirre — Cumpleaños" + lucecita si te toca; clic abre el ticket. Estilos reutilizan `.ev--t-<estado>`.

### 4.6 Lo que funciona sin cambios
Pantalla Tickets (contadores, filtros, filas), globito de la barra, barra inferior, lucecita, ciclo de estados, historial — todo usa `fecha_limite` de la vista.

## 5. Errores y bordes
- Fecha pasada / motivo vacío / jugador fuera de Contenido / cargo sin permiso → mensaje de la base mostrado tal cual (P0001/42501 por `mensajeError`).
- Jugador sin fechas de Contenido cargadas → solo aparece "Otra fecha".
- Un ticket de fecha con la fecha ya pasada y sin entregar → "Vencido" (misma regla que partidos).
- `pendientesDe` ya no lo trata como huérfano (usa `partidoEliminado`, que ahora es falso para estos tickets).

## 6. Pruebas
- **Base** (`scripts/tickets.test.mjs`, transacción con ROLLBACK): crear como Admin y CM ✓; Diseñador y Prueba → 42501; fecha de ayer → error; motivo vacío / > 120 → error; jugador inactivo o sin Contenido → error; `fecha_limite = fecha − 2`; `partido_eliminado = false`; `check` partido+fecha rechaza ambos; ciclo entregar → aprobar → publicar sobre un ticket de fecha.
- **Unitarias:** `proximasFechas`, `motivoDeFecha`, `textoEvento`.
- **Navegador** (dev :3100, 4 usuarios, 390 y 1280 px): el recorrido del §1, "Otra fecha" con Pedro, Alexis sin botón, chip en el Calendario general, "Ver jugador" desde el ticket. Los tickets de QA se cancelan al final.
- `npm test`, `npm run test:tickets`, lint, `tsc` sin errores nuevos.

## 7. Fuera de alcance
Lucecita en las tarjetas de fechas de /partidos; tickets de fecha en el calendario Match Day; avisos automáticos si cambia la fecha de un cumpleaños (no cambia); editar la fecha de un ticket ya creado (se cancela y se crea otro).
