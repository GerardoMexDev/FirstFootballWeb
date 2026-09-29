# Spec — Tickets de diseño (Admin / CM → Diseñador)

> Football First. Pedido de la agencia vía Gerardo (Sesión 12, 2026-09-28).
> Diseño acordado con Gerardo en 5 partes, todas aprobadas en el chat. Enfoque **B** (tablas
> nuevas a medida; las de Fase 2 quedan sin tocar).

## 1. Problema y objetivo

El Administrador (Felipe) y el Community Manager (Pedro) le encargan diseños al Diseñador
(Maxi) — hoy por fuera de la web. Se necesita que el encargo, su seguimiento y la conversación
queden **dentro de la web y por escrito**, como respaldo ante problemas de entregas.

Flujo pedido:

1. Admin o CM crea un **ticket atado a un partido** de Match Day (y a un jugador de ese partido).
2. En el calendario de Match Day el chip del partido se pinta **🔴 Pendiente**. El Diseñador lo
   ve desde el lunes con los partidos de la semana.
3. El Diseñador termina, pega el **link de Dropbox del diseño** y lo marca **🟡 En revisión**.
4. Quien lo creó (o el Admin) lo revisa: **🟢 Aprobado**, o lo **devuelve a 🔴** con qué corregir.
   El ciclo se repite hasta aprobarlo.
5. El Diseñador lo publica y lo marca **✅ Publicado**.
6. Toda la conversación, cada cambio de estado y cada entrega quedan en un **historial
   imborrable**, con fecha, hora y autor. El sistema agrega avisos solos si el partido se
   reprograma, se suspende o desaparece de la fuente.

El diseño en sí **sigue compartiéndose por Dropbox**: esto es solo seguimiento.

## 2. Alcance

### Entra

- Migración `0025_tickets_diseno.sql`: tipos, 2 tablas, vista, 7 funciones de acción, triggers
  de inmutabilidad y de avisos del sistema, RLS.
- Estados: 🔴 `pendiente` · 🟡 `en_revision` · 🟢 `aprobado` · ✅ `publicado` · ⚪ `cancelado`.
- Chip del calendario de Match Day coloreado por estado + ícono/palabra (no solo color).
- Tarjeta del ticket en el panel lateral (`?panel=ticket&id=…`), con borde del color del estado.
- "Crear ticket de diseño" en el panel del partido, por cada "Jugador a cubrir".
- Contador en la barra superior + lista desplegable de "lo que te toca".
- Tests unitarios, tests de seguridad/estado contra la base real en transacción que se
  deshace (`npm run test:tickets`), QA de navegador del ciclo completo.
- Script de limpieza de tickets de prueba para la entrega.

### No entra (YAGNI / fases siguientes)

- Notificaciones por mail (depende del correo, en espera — ver `avances.md` §5).
- Actualización "en vivo" (realtime): lo que hace otro usuario se ve al navegar/recargar.
- Subir archivos a la web (el diseño vive en Dropbox).
- Tickets sobre fechas de Contenido (cumpleaños, etc.) o sin partido.
- Prioridad, tipo de pieza, campañas.
- Borrar las tablas vacías de Fase 2 (`piezas*`, `campanas`) — se decide aparte con Gerardo.

## 3. Decisiones de Gerardo (registro)

| Tema | Decisión |
|---|---|
| Quién crea / recibe | Crean Admin y CM; recibe el Diseñador |
| A qué se ata | A un **partido** (y un jugador de ese partido); el partido da el día |
| Qué se pinta | El **chip del partido** (no la celda entera) |
| Estados | 🔴 → 🟡 → 🟢 → ✅; devolución 🟡 → 🔴; ⚪ Cancelado (agregado en la parte 1) |
| Quién revisa | Quien lo creó; **el Admin puede aprobar/devolver cualquiera** (respaldo) |
| Fecha límite | **2 días antes del partido** (configurable; a confirmar con la agencia, mínimo 1) |
| Tickets por partido | Lo normal es 1; la base admite más (a confirmar con la agencia) |
| Datos del ticket | Nota + **link de Dropbox del diseño** obligatorio al entregar (opción b) |
| Cómo se entera cada uno | Calendario + **contador en la barra** con lista de pendientes (opción a) |
| Historial | Imborrable; tickets no se borran (se cancelan) |
| Avisos del sistema | Reprogramación, suspensión, vuelta a programado, desaparición de la fuente |
| Alexis ("Prueba") | **Solo lectura** (ve todo, no actúa) |

## 4. Modelo de datos (`0025`)

### 4.1 Tipos

```sql
create type estado_ticket as enum ('pendiente', 'en_revision', 'aprobado', 'publicado', 'cancelado');
create type tipo_evento_ticket as enum
  ('creado', 'comentario', 'entrega', 'aprobado', 'devuelto', 'publicado', 'cancelado', 'sistema');
```

### 4.2 `tickets`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `partido_id` | uuid null → `partidos(id)` **on delete set null** | El ticket sobrevive si la sync borra el partido |
| `jugador_id` | uuid not null → `jugadores(id)` on delete restrict | |
| `titulo` | text not null | Armado al crear: `Match Day — <apodo/nombre> · <local> vs <visitante>` |
| `nota` | text not null, 1–2000 caracteres | |
| `estado` | `estado_ticket` not null default `pendiente` | |
| `link_entrega` | text null, check `~ '^https://'` | Último link entregado |
| `inicio_utc_conocido` | timestamptz null | Última fecha conocida del partido (para cuando desaparece) |
| `creado_por` | uuid not null → `perfiles(id)` | |
| `creado_en` / `actualizado_en` | timestamptz | trigger `set_updated_at` existente |

Índices: `(partido_id)`, `(estado)`, `(creado_por)`.
**Sin** unique `(partido_id, jugador_id)` — la base admite más de uno.

### 4.3 `tickets_historial` (línea de tiempo única)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | bigint identity pk | orden estable |
| `ticket_id` | uuid not null → `tickets(id)` on delete restrict | |
| `tipo` | `tipo_evento_ticket` not null | |
| `autor_id` | uuid null → `perfiles(id)` | null solo en `sistema` |
| `texto` | text null, ≤ 2000 | nota / comentario / motivo / aviso |
| `link` | text null, check `~ '^https://'` | en `entrega` |
| `estado_desde`, `estado_hasta` | `estado_ticket` null | en cambios de estado |
| `creado_en` | timestamptz not null default now() | |

Índice: `(ticket_id, id)`.

### 4.4 Inmutabilidad

- Trigger `before update or delete on tickets_historial` → **siempre** `raise exception`
  (cualquier rol, incluido `service_role`).
- Trigger `before delete on tickets` → `raise exception` (un ticket se cancela, no se borra).
- `tickets` solo se actualiza desde las funciones de acción (§5) y los triggers de sistema.
- **Única salida:** el script de limpieza de entrega (§9), corrido por el dueño de la base,
  deshabilita los triggers dentro de una transacción.

### 4.5 Fecha límite (calculada, no guardada)

```sql
create function ticket_dias_anticipacion() returns int language sql immutable as $$ select 2 $$;
```

`fecha_limite` (date, hora de Uruguay) = `(partidos.inicio_utc at time zone 'America/Montevideo')::date
− ticket_dias_anticipacion()`. Si el partido no tiene hora o ya no existe → se usa
`inicio_utc_conocido`; si tampoco hay → null ("sin fecha límite").

### 4.6 Vista `tickets_vista` (`security_invoker = true`)

`tickets` + datos del partido (inicio_utc, estado del partido, competencia) + `fecha_limite` +
nombre del creador + nombre/apodo del jugador. La consume la UI (calendario, tarjeta,
contador). La conversación se lee de `tickets_historial` ordenada por `id`.

## 5. Permisos y acciones

### 5.1 Regla general

- **RLS:** `select` en `tickets`, `tickets_historial` y `tickets_vista` para
  `es_usuario_activo()`. **Ninguna** política de insert/update/delete para clientes.
- Toda escritura pasa por 7 funciones `security definer` (`set search_path = public`),
  llamadas por RPC. Cada una, en una sola transacción:
  1. Lee el perfil de `auth.uid()`: debe existir y estar `activo`; toma `cargo`.
  2. Bloquea el ticket con `select … for update` (concurrencia: la 2ª acción espera, ve el
     estado nuevo y falla con "el ticket cambió").
  3. Valida puesto + estado + (si aplica) ser el creador o Admin.
  4. Cambia el estado / link y escribe la fila de historial.
- Errores con `errcode` `42501` (permiso) o `P0001` + mensaje en español para la UI.

### 5.2 Tabla de acciones

| Función | Quién | Desde → hasta | Requiere | Historial |
|---|---|---|---|---|
| `ticket_crear(partido, jugador, nota)` | Administrador, Community Manager | → `pendiente` | jugador del partido en `partidos_jugadores`, partido de Match Day, nota 1–2000 | `creado` (texto = nota) |
| `ticket_entregar(ticket, link, texto?)` | Diseñador | `pendiente` → `en_revision` | link `https://` | `entrega` (link) |
| `ticket_aprobar(ticket, texto?)` | creador o Administrador | `en_revision` → `aprobado` | — | `aprobado` |
| `ticket_devolver(ticket, texto)` | creador o Administrador | `en_revision` → `pendiente` | texto 1–2000 | `devuelto` |
| `ticket_publicar(ticket, texto?)` | Diseñador | `aprobado` → `publicado` | — | `publicado` |
| `ticket_cancelar(ticket, texto)` | creador o Administrador | `pendiente` → `cancelado` | texto 1–2000 | `cancelado` |
| `ticket_comentar(ticket, texto)` | Administrador, CM, Diseñador | cualquier estado | texto 1–2000 | `comentario` |

Cargo `Prueba` (Alexis): ninguna acción (solo lectura). Perfil inactivo: ninguna acción.

## 6. Avisos del sistema (triggers sobre `partidos`)

Solo para tickets del partido con estado ∉ {`publicado`, `cancelado`}. Texto en español,
hora de Uruguay (días de la semana armados con un array propio — no depender de `lc_time`).

| Disparador | Condición | Texto |
|---|---|---|
| `after update of inicio_utc` | antes y después no nulos y `abs(diff) ≥ 1 min` | "El partido se reprogramó: antes <sáb 4/10 20:00>, ahora <dom 5/10 18:00> (hora Uruguay). Nueva fecha límite: <vie 3/10>." + " ⚠️ La nueva fecha límite ya pasó." si corresponde |
| idem | antes nulo, después no nulo | "Hora confirmada: <dom 5/10 18:00> (hora Uruguay). Fecha límite: <vie 3/10>." |
| `after update of estado` | → `suspendido` | "El partido figura como suspendido en la fuente." |
| idem | `suspendido` → `programado` | "El partido vuelve a figurar como programado para <…>." |
| `before delete` | — | "El partido ya no figura en la fuente de datos. El ticket se conserva." (y guarda `inicio_utc_conocido`) |

`finalizado` y `en_juego` no generan aviso. Cada `update` de `inicio_utc` válido también
actualiza `tickets.inicio_utc_conocido`.

## 7. Pantallas

### 7.1 Calendario de Match Day (`components/calendario/Calendario.tsx`)

- La página trae los tickets no cancelados de la ventana (`tickets_vista`) y arma un mapa
  `partidoId → estado más urgente` (🔴 > 🟡 > 🟢 > ✅).
- El chip de un partido con ticket suma la clase `ev--t-<estado>` (colores en `app.css`) y un
  prefijo accesible (ícono + palabra corta: "Pendiente", "Revisión", "Aprobado", "Publicado").
- Clic: 1 ticket activo → `?panel=ticket&id=<ticket>`; 2+ → panel del partido (como hoy).
- Hay **un chip por partido** (dedupe existente), no por jugador: de ahí la regla del más urgente.
- Calendario General: sin cambios.

### 7.2 Tarjeta del ticket (`PanelTicket`, `TipoPanel` += `'ticket'`)

Endpoint `GET /api/paneles/ticket?id=` (mismo patrón que los otros paneles, cliente SSR con
cookies → RLS). Contenido:

1. Pastilla de estado + título + partido (día/hora UY) + **fecha límite** ("vence en N días" /
   "vence hoy" / "⚠️ vencido" en rojo; ninguna si ya está aprobado/publicado/cancelado).
2. Nota.
3. "Abrir diseño" (último `link_entrega`, pestaña nueva) si hay.
4. Botones según `accionesPermitidas(cargo, esCreador, estado)` (función pura). Entregar /
   Devolver / Cancelar abren un campo obligatorio (link / qué corregir / motivo).
5. Conversación: historial en orden, autor + fecha/hora UY; `sistema` con estilo propio;
   `entrega` muestra su link.
6. Caja de comentario (oculta para `Prueba`).

Borde del panel con el color del estado (`.panel--t-<estado>`). Después de cada acción:
recarga del bundle + `router.refresh()` (actualiza chip y contador). Error de la RPC →
`.aviso` con el mensaje humano.

### 7.3 Crear ticket (`PanelPartido`)

Por cada "Jugador a cubrir", para Admin/CM: si no hay ticket activo de ese jugador en ese
partido → "Crear ticket de diseño" → textarea (nota) + "Crear". Si hay → pastilla de estado
que abre la tarjeta. El bundle del panel del partido suma los tickets del partido y el
cargo del usuario.

### 7.4 Contador (`BarraSuperior`)

- Número = `pendientesDe(cargo, usuarioId, tickets)` (función pura):
  - Diseñador: `pendiente` + `aprobado`.
  - Community Manager: `en_revision` creados por él.
  - Administrador: todos los `en_revision`.
  - Prueba: 0 (sin globito).
- Clic → desplegable "Lo que te toca", ordenado por fecha límite (vencidos primero); cada
  ítem abre su tarjeta. Los datos los trae el layout `(app)` junto con la sesión.

### 7.5 Mobile

El panel lateral ya es de pantalla completa en mobile. QA en 390 px: tarjeta, conversación,
campos obligatorios, desplegable del contador, sin scroll horizontal.

## 8. Tests

### 8.1 Unitarios (`npm test`, puros, sin `@/` en runtime)

`lib/tickets/`: `accionesPermitidas`, `pendientesDe`, `estadoMasUrgente`, `textoVencimiento`
(bordes: hoy, mañana, vencido, sin fecha), metadatos de estado (clase/etiqueta/ícono),
orden de la lista de pendientes, validación de link (reusa `linkSeguro`).

### 8.2 Seguridad y estado contra la base real (`npm run test:tickets`)

`scripts/tickets.test.mjs`, conexión `pg` directa; **cada test corre en una transacción con
`rollback`** (cero rastro en prod; necesario porque el historial es imborrable). Usuarios
simulados con `set local role authenticated` + `set local request.jwt.claims` (sub = id real
de Felipe / Pedro / Maxi / Alexis). Casos:

- Cada acción × cada cargo (permitido / rechazado), incluido "CM no aprueba ticket de otro"
  y "Admin sí aprueba ticket del CM".
- Transiciones inválidas rechazadas (p.ej. `pendiente` → `publicado`, entregar dos veces).
- Link `http:` / `javascript:` rechazado; texto > 2000 rechazado; nota vacía rechazada.
- Sin sesión (`anon`): no lee `tickets` / `tickets_historial` / `tickets_vista`.
- `authenticated` no puede `insert/update/delete` directo en ninguna de las dos tablas.
- Historial: `update`/`delete` fallan **también como `service_role`**; `delete` de ticket falla.
- Alexis (`Prueba`) y un perfil inactivo: toda acción rechazada.
- Concurrencia: dos conexiones, una aprueba y otra devuelve el mismo ticket → una sola gana.
- Avisos: `update inicio_utc` (+2 h) → 1 aviso con texto esperado; +30 s → 0 avisos;
  → `suspendido` → aviso; `delete` del partido → ticket vive, `partido_id` null, aviso.
  (El partido de prueba se crea dentro de la misma transacción.)

Requiere la conexión `pg` directa (IPv6, ver §10b). Si la red del día no la tiene, los tests
se corren otro día o desde otra red: **no** se pasan a REST, porque por REST no hay rollback y
dejarían historial imborrable en producción.

### 8.3 QA de navegador (contra el `npm run dev` de Gerardo si está abierto)

Ciclo completo: Felipe crea → 🔴 → Maxi entrega (link) → 🟡 → Felipe devuelve → 🔴 → Maxi
entrega → 🟡 → Felipe aprueba → 🟢 → Maxi publica → ✅. En cada paso: color del chip,
contador de cada uno, conversación. Además: Pedro no ve "Aprobar" en el ticket de Felipe;
Alexis no ve botones; Pedro crea uno y Felipe (Admin) lo aprueba. Desktop 1280 + mobile 390,
0 errores de consola. Los tickets de QA se **cancelan** al terminar.

## 9. Limpieza para la entrega

`scripts/limpiar-tickets.sql` (lo corre Gerardo en el SQL Editor, como dueño):
`begin; alter table … disable trigger …; delete from tickets_historial; delete from tickets;
alter table … enable trigger …; commit;` — con un `select count(*)` antes/después. Se corre
junto con `npm run seed:usuarios -- --reset-clave` al entregar.

## 10. Puesta en marcha

1. `0025` es **aditiva** (no toca datos existentes). La aplica Claude con `npm run migracion`;
   si el auto-mode la bloquea, Gerardo (§10b). Después: `npm run tipos:db`.
2. Código detrás de la migración (la UI asume que existen las tablas).
3. Sin `npm run build` mientras Gerardo tenga `npm run dev` abierto (§10b): lint, `tsc`, tests
   y QA contra su dev.
4. `git push` lo hace Gerardo; Claude verifica en producción.

## 11. Pendientes con la agencia

- Días de anticipación de la fecha límite (hoy 2; `ticket_dias_anticipacion()`).
- ¿Siempre un ticket por partido o a veces más?
