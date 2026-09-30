# Match Day automático (tickets por partido) + tickets manuales simplificados — Especificación

**Fecha:** 2026-09-30 · **Estado:** diseño aprobado en conversación por Gerardo, pendiente de revisión escrita
**Origen:** reunión con la agencia (2026-09-29), puntos 1, 2, 3 y 5 de `avances.md` §5 "Cambios pedidos
por la agencia". La carga del Excel de fechas (punto 6) va en otra spec.

## 1. Objetivo y criterio de éxito

Que el Diseñador lleve el seguimiento de **todos** los partidos de Match Day sin que nadie tenga que
crear tickets, y que el Administrador y el Community Manager vean de un vistazo, en el calendario y en
la pantalla Tickets, qué está **pendiente (rojo)**, **completado (verde)** o **vencido (amarillo)**.
Éxito: Maxi abre un partido, sube el diseño a Dropbox, tilda "Completado" y el partido se pone verde en
el calendario de Felipe; un partido que llegó a su fecha límite sin tildar se ve amarillo.

## 2. Decisiones tomadas (Gerardo, 2026-09-30)

| Tema | Decisión |
|---|---|
| Qué es automático | Solo los **partidos de Match Day**: un ticket por partido **por jugador** |
| Fechas de Contenido y de First | Van al Calendario general **sin ticket y sin color** |
| Colores | 🔴 pendiente · 🟢 completado · 🟡 vencido |
| Cómo se completa | El Diseñador sube a Dropbox y tilda **Completado**; **sin link** |
| Desde cuándo | Desde el **día en que se publica** esta versión; lo anterior, sin estado |
| Tickets manuales | Se mantienen para pedidos puntuales de Admin/CM y se simplifican igual: pendiente → completado (sin revisión/aprobación, sin link) |
| Modelo | Estado **calculado** (no se fabrican tickets): solo se guarda la marca de "completado" |
| Número rojo / lucecita | Cuentan solo **vencidos + por vencer (≤ 2 días)** |

## 3. Reglas

- **Ticket automático** = fila (partido, jugador) de un jugador de Match Day (`proximos_partidos`).
- **Fecha límite** = día del partido en Uruguay − `ticket_dias_anticipacion()` (2).
- **Estado** (para partidos con día ≥ `match_day_desde()`):
  - `completado` si hay marca en `disenos_partido`;
  - `vencido` si hoy (Uruguay) > fecha límite y no hay marca;
  - `pendiente` en otro caso.
  - Partidos con día < `match_day_desde()` → **sin estado** (`null`): se ven como hoy.
  - Partido sin fecha → `pendiente` sin fecha límite.
- **Por vencer** = pendiente con fecha límite en 0–2 días (mismo criterio que la pantalla Tickets).
- **Quién marca:** solo el **Diseñador** (activo) puede marcar y desmarcar "Completado". Queda quién y cuándo.
- Partido reprogramado → la fecha límite se recalcula sola. Partido que desaparece → su ticket también.
- **Tickets manuales:** estados en uso `pendiente`, `completado`, `cancelado`. El Diseñador completa (y
  puede reabrir a pendiente); quien lo creó o el Administrador cancela (solo si está pendiente). Comentarios
  como hoy. Vencido = pendiente con la fecha límite pasada (color amarillo).
  - Migración de datos: `en_revision`, `aprobado`, `publicado` → `completado` (hoy hay 1 ticket de prueba
    de la agencia en `en_revision`). El historial registra el cambio como evento `sistema`.

## 4. Base de datos — migración `0030_match_day_automatico.sql`

- `match_day_desde()` → `date` inmutable con la fecha de publicación (se completa al aplicar).
- Tabla `disenos_partido (partido_id uuid → partidos on delete cascade, jugador_id uuid → jugadores,
  completado_por uuid → perfiles, completado_en timestamptz default now(), primary key (partido_id, jugador_id))`.
  RLS: SELECT para usuarios activos; sin escritura directa (revoke all), solo por función.
- RPC `diseno_partido_marcar(p_partido uuid, p_jugador uuid, p_completado boolean)` — `security definer`:
  cargo Diseñador (si no → 42501); el par (partido, jugador) debe existir en `partidos_jugadores` y el
  jugador ser de Match Day (si no → P0001 "Ese jugador no figura en ese partido de Match Day.");
  `true` inserta (idempotente), `false` borra.
- Vista `tickets_match_day` (security_invoker): por fila de `proximos_partidos`: `partido_id`,
  `jugador_id`, `jugador_nombre`, `dia_uy`, `inicio_utc`, `fecha_limite`, `estado`
  (`'pendiente' | 'completado' | 'vencido' | null`), `completado_por_nombre`, `completado_en`.
- Tickets manuales: `alter type estado_ticket add value 'completado'`; RPC nuevas `ticket_completar(p_ticket, p_texto)`
  y `ticket_reabrir(p_ticket, p_texto)` (Diseñador); `ticket_cancelar` sigue igual. Las RPC viejas
  (`entregar`, `aprobar`, `devolver`, `publicar`) quedan pero la UI deja de ofrecerlas.
  `tipo_evento_ticket` suma `'completado'` y `'reabierto'`.
- Tests de base en `scripts/tickets.test.mjs` (ROLLBACK): permisos de marcar, estados por fecha
  (antes de publicación → null, vencido, pendiente, completado), reprogramación, manual completar/reabrir/cancelar,
  migración de estados.

## 5. Front

- **Lógica pura (tests):** `estadoMatchDay`, conteo para el globito (vencidos + por vencer), `textoCopiar(partido)`:
  ```
  Toluca vs Atlante
  Sábado 4 de octubre
  20:00 hora local · 23:00 hora de Uruguay
  Estadio Nemesio Díez, Toluca
  ```
  (misma hora → "20:00 hora de Uruguay (misma hora local)"; sin estadio/ciudad → se omite la línea).
- **Detalle del partido (panel):** por jugador: casilla **Pendiente** (tildada, deshabilitada) + casilla
  **Completado** (solo el Diseñador la cambia), pastilla de estado con "vence el …", botón **Copiar**
  (ícono `copiar`, dos hojas, sin círculo de fondo) con aviso "Copiado" (`role="status"`).
- **/partidos:** pastilla de estado por jugador en cada tarjeta; lucecita solo en vencidos/por vencer (Diseñador).
- **Calendario Match Day:** cada chip de partido con el color de su estado; tickets manuales como hoy.
- **Calendario general:** fechas sin color; solo los tickets manuales de fecha llevan color.
- **Pantalla Tickets:** junta automáticos y manuales; contadores Vencidos / Por vencer / Al día; filtros
  Abiertos / Completados / Todos; el Diseñador tilda Completado desde la fila.
- **Globito + barra inferior:** solo vencidos + por vencer.
- **Tickets manuales:** el panel muestra "Completar" (Diseñador), "Reabrir", "Cancelar" y comentarios.
- **Colores:** tokens `--tk-rojo`, `--tk-verde`, `--tk-amarillo` existentes (AA en claro y oscuro).

## 5b. Un solo calendario con filtros (pedido de Gerardo, 2026-09-30)

Los jefes quieren ver todo en **un solo calendario**. `Match Day` (/calendario) y `Calendario general`
(/calendario-general) pasan a ser una sola vista **"Calendario"** (/calendario) con chips de filtro, como
en /partidos:

| Filtro | Qué muestra |
|---|---|
| **Todos** (por defecto) | Todo junto |
| **Match Day** | Partidos de Match Day (con su color de estado) y los tickets manuales de esos partidos |
| **Contenido** | Fechas de los jugadores (cumpleaños, aniversarios…), fechas de First (cuando se carguen, punto 6), partidos de los jugadores solo-Contenido (`proximos_partidos_contenido`) y tickets manuales de fecha |

- Un evento repetido en dos fuentes (p.ej. el cumpleaños de un jugador de Match Day, que hoy está en
  `agenda_anual` y en `agenda_contenido`) se muestra una sola vez.
- **Navegación:** queda `Partidos · Calendario · Jugadores · Tickets` (arriba y en la barra inferior del
  celular, 4 pestañas). `/calendario-general` redirige a `/calendario?f=contenido`.
- El filtro elegido queda en la dirección (`?f=`) para poder compartir el enlace.
- Las "Fechas señaladas" (notas de agenda) de arriba siguen el filtro elegido.

## 6. Pruebas
Unitarias (lógica pura), base (ROLLBACK), navegador con los 4 usuarios en 390/1280 px (marcar/desmarcar,
colores en calendarios, Copiar, globito), revisión final independiente. Nada se da por terminado sin QA.

## 7. Fuera de alcance
Carga del Excel de fechas (punto 6, otra spec); tickets automáticos para fechas de Contenido (descartado);
partidos de uruguayos y de la selección (puntos 4 y 9); historial/comentarios en tickets automáticos.
