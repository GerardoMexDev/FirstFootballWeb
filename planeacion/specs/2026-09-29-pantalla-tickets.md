# Pantalla "Tickets" + barra de pestañas inferior en celular — Especificación

**Fecha:** 2026-09-29 · **Estado:** diseño aprobado en conversación por Gerardo, pendiente de revisión escrita
**Pedido original (Gerardo, revisando en prod 2026-09-29):** "que Pedro tenga una opción *Tickets* o
*Historial de tickets* en la navegación, con una pantalla como el detalle de partido, con la lista
del más actual al más viejo, donde vea cómo va con sus pendientes, cuáles están por vencer y cuáles
ya vencieron, para que tome acción en el momento".

## 1. Objetivo y criterio de éxito

Que cada usuario vea **de un vistazo** el estado de los tickets de diseño que le importan y **actúe
ahí mismo**. Éxito: Pedro entra, ve "2 vencidos", toca, abre el ticket y lo aprueba o comenta sin
salir de la pantalla; la lista y los contadores se actualizan solos.

## 2. Decisiones tomadas (Gerardo, 2026-09-29)

| Tema | Decisión |
|---|---|
| Nombre | "Tickets" |
| Quién ve qué | Administrador: todos · Community Manager: los que creó · Diseñador: todos · Prueba: no ve la opción |
| Vista inicial | Abiertos (pendiente, en revisión, aprobado), del más nuevo al más viejo (por fecha de creación) |
| Filtros de estado | Abiertos · Cerrados (publicado + cancelado) · Todos |
| Urgencia | Tres contadores arriba que además filtran: **Vencidos · Por vencer · Al día** |
| "Por vencer" | Vence hoy, mañana o pasado mañana (≤ 2 días) |
| Carga de datos | Una sola lectura: abiertos + cerrados de los últimos 60 días, tope 300; filtros en el navegador |
| Celular | Barra de pestañas inferior (no hamburguesa), 5 pestañas: Partidos · Match Day · General · Jugadores · Tickets |

## 3. Datos

- **Lectura nueva** en `RepositorioTicketsSupabase`: `listarParaPantalla(desdeIso)` →
  tickets con estado abierto (cualquier fecha) **o** cerrados creados desde `desdeIso` (hoy − 60
  días), orden `creado_en` descendente, `limit(300)`. Misma vista `tickets_vista`.
- `ResumenTicket` suma **`creadoEn`** (ISO UTC) — hace falta para ordenar y para "hace 2 días".
  Las lecturas existentes lo pasan a incluir (una columna más en `CAMPOS_RESUMEN`).
- **Seguridad:** la RLS de 0025 deja leer tickets a todo usuario activo. "Pedro ve solo los suyos"
  es un **filtro de pantalla** (orden y foco), no un control de acceso — igual que hoy en el
  panel del partido. No se toca la base.
- **Prueba (Alexis):** sin pestaña; si entra por URL a `/tickets`, `redirect('/partidos')`.
- **Error de lectura:** la pantalla muestra "No pudimos cargar los tickets. Recargá la página."
  (`EstadoSinDatos`); el layout y la barra siguen andando.

## 4. Lógica pura (con tests, `lib/tickets/`)

- `visiblesPara(cargo, usuarioId, tickets)` → Admin y Diseñador: todos; CM: `creadoPor === usuarioId`;
  Prueba y otros: ninguno. (En `permisos.ts`.)
- `urgencia(t, hoyUy)` → `'vencido' | 'por_vencer' | 'al_dia' | null`:
  - `null` para cerrados (publicado, cancelado): no cuentan.
  - Aprobado o sin fecha límite → `'al_dia'` (no vence: ya se entregó o no tiene fecha).
  - Pendiente / en revisión: fecha límite < hoy → `'vencido'`; ≤ hoy + 2 → `'por_vencer'`; resto `'al_dia'`.
  (En `vencimiento.ts`, que ya tiene `textoVencimiento` con el mismo cálculo de días.)
- `contarUrgencias(tickets, hoyUy)` → `{ vencido, por_vencer, al_dia }` solo sobre abiertos.
- `filtrarPantalla(tickets, { estado: 'abiertos'|'cerrados'|'todos', urgencia: … | null }, hoyUy)`.
- `haceCuanto(iso, ahora)` → "hoy", "ayer", "hace 3 días", "hace 2 semanas" (texto de creación).

## 5. Pantalla `/tickets` (`app/(app)/tickets/page.tsx`, Server Component)

1. Cabecera `.head`: título **"Tickets"** (`d1`) + subtítulo "Lo que está en marcha, del más nuevo al más viejo."
2. **Contadores** (mismo estilo que `TarjetasKpi`): Vencidos (rojo), Por vencer (amarillo), Al día.
   Son `<button aria-pressed>`: tocar uno filtra la lista por esa urgencia (y fuerza "Abiertos");
   tocarlo de nuevo lo quita. El número es de los tickets visibles para el usuario.
3. **Chips de estado** (`.barra` / `.chip`, como `BarraFiltros`): Abiertos (por defecto) · Cerrados · Todos,
   con la cuenta a la derecha ("12 tickets").
4. **Lista**: cada ticket es un `<button>` a todo el ancho que abre `?panel=ticket&id=…` (`usePanel`):
   - Línea 1: `PastillaEstado` + título del ticket ("Match Day — Nacho · Atlético Mineiro vs RB Bragantino").
   - Línea 2: vencimiento (`textoVencimiento`, rojo si vencido) · "Creado por Pedro · hace 2 días".
   - `AlertaTicket` si `debeActuar` (misma lucecita que tarjetas y calendario).
   - Nombre accesible: título + estado + vencimiento + alerta.
5. **Vacíos**: "No hay tickets vencidos." / "No hay tickets abiertos." / "Todavía no hay tickets cerrados." /
   para el CM sin tickets: "Todavía no creaste tickets. Se crean desde el detalle de un partido."
6. **Actualización**: el panel del ticket ya hace `router.refresh()` después de cada acción → la
   página (Server Component) se vuelve a leer: lista y contadores al día sin código extra.
7. Parte cliente mínima: `SeccionTickets` (estado de filtros) — mismo patrón que `SeccionPartidos`.

## 6. Navegación

**Tablet y desktop (> 620 px):** "Tickets" se suma como 5.ª opción de `.nav` (oculta para Prueba).
**Celular (≤ 620 px):**
- La `.nav` de arriba se oculta; la barra superior vuelve a una sola fila (marca, buscador, globito,
  avatar) — reemplaza la 2.ª fila del arreglo de scroll de hoy (commit 22259bc).
- **Barra inferior fija** (`BarraInferior`, `<nav aria-label="Secciones">`), 5 botones con ícono +
  nombre corto: **Partidos · Match Day · General · Jugadores · Tickets**; `aria-current="page"` en la
  actual; Tickets con el número rojo de pendientes (`aria-label` "Tickets, 3 te esperan").
- Íconos: `reloj` (Partidos), `calendario` (Match Day), `torta` (General), `persona` (Jugadores) —
  existentes — y **uno nuevo `lista`** (portapapeles con tildes) para Tickets. ⚠ `Ico.tsx` dice
  "no agregar íconos nuevos sin acordarlo": **se acuerda en esta revisión**.
- Alto táctil ≥ 44 px; `padding-bottom: env(safe-area-inset-bottom)` (iPhone); el `main` suma
  espacio abajo para que la barra no tape la última tarjeta; el panel lateral (z-index 120) queda
  por encima de la barra; el toast sube para no quedar debajo.
- Las secciones se definen **una sola vez** (lista compartida por `Nav` y `BarraInferior`) para que
  no se desincronicen.

## 7. Accesibilidad y calidad (WCAG 2.2 AA)

Contadores y chips como botones con `aria-pressed`; foco visible; contraste ≥ 4.5:1 (tokens `--tk-*`);
la urgencia no depende solo del color (texto "Vencido hace…"); tamaño táctil 44 px en la barra
inferior; tema oscuro con los tokens existentes; sin scroll horizontal a 360/390 px.

## 8. Pruebas

- **Unitarias:** `visiblesPara`, `urgencia`, `contarUrgencias`, `filtrarPantalla`, `haceCuanto`.
- **Navegador** (dev de Claude en :3100, no el de Gerardo), con los 4 usuarios, a 390 / 768 / 1280 px:
  contadores y filtros, CM ve solo lo suyo, Prueba sin pestaña y redirigido, panel abre, aprobar →
  lista y contadores se actualizan, barra inferior sin tapar contenido, sin scroll lateral,
  tema oscuro. El ticket de QA se cancela al final.
- `npm test`, `npm run lint`, `tsc` sin errores nuevos.

## 9. Fuera de alcance

Buscador de tickets; historial de más de 60 días para cerrados (si hace falta: "Ver más" en otra
entrega); notificaciones por mail; tickets sin partido (van con "tickets desde la ficha del
jugador", punto 4 de los pedidos).
