# Spec — Partidos de los uruguayos (Contenido) y de la selección uruguaya, desde ESPN

**Fecha:** 2026-09-30 · **Pedido:** puntos 4 y 9 de la agencia (avances.md §5) · **Aprobado en
conversación por Gerardo:** enfoque A (función nueva) + este diseño.

## 1. Qué se quiere

1. **Punto 4.** En el filtro **Contenido** (calendario y /partidos) aparecen los partidos de los 4
   jugadores solo-Contenido uruguayos: Abel Hernández y Franco Romero (**Peñarol**), Gastón
   Martirena y Maximiliano Silvera (**Nacional**). Fuente gratis: ESPN. La agencia sabe que es una
   fuente no oficial y con menos datos.
2. **Punto 9.** Los partidos de la **selección uruguaya** (amistosos, Eliminatorias, Copa América,
   Mundial) aparecen en un filtro nuevo **Selección** y también en **Todos** — en el calendario y en
   /partidos. Siempre, haya o no un representado convocado.
3. Contenido y Selección no generan ticket ni llevan color de estado (spec
   2026-09-30-match-day-automatico) — **salvo** la convocatoria (punto 4).
4. **Convocatoria (Gerardo, 2026-09-30):** si un representado de **Match Day** con selección
   Uruguay (hoy Nahitan Nández) está convocado, ese partido de Uruguay **es de Match Day**: tarjeta
   con su cara, "Uruguay vs <rival>", y su ticket automático para el Diseñador. Cómo se sabe:
   **tilde a mano** del Administrador o del Community Manager en la tarjeta del partido de la
   selección ("Convocado: Nández"). Motivo: ninguna fuente gratis publica la lista con tiempo, y
   API-Football nunca trajo los partidos de Nández con la selección (0 filas `con_seleccion` en la
   base; ESPN sí tiene Uruguay–Japón 24/9 y Corea 28/9).

**Fuera de alcance:** convocatoria automática; estadísticas de los uruguayos; Copa AUF
(ESPN no la tiene: `uru.copa` → 400); noticias (idea anotada para mantenimiento); tocar Match
Day / SportMonks.

## 2. Qué verificó el spike (2026-09-30, ESPN, solo lectura)

- `site.api.espn.com/apis/site/v2/sports/soccer/<liga>/teams/<id>/schedule?fixture=true` devuelve
  los próximos partidos con fecha y estadio: Peñarol (2683) 4/10 vs Racing (Centenario), 10/10 vs
  Plaza Colonia; Nacional (2684) 5/10 vs MCT, 11/10 vs Cerro; Uruguay (212) 6/10 vs India
  (`fifa.friendly`).
- ESPN publica **~2 fechas adelante** en `uru.1`: en Contenido se ve menos futuro que en Match Day.
- `conmebol.libertadores`, `conmebol.sudamericana`, `fifa.worldq.conmebol`, `conmebol.america`,
  `fifa.world` responden 200 pero hoy sin partidos futuros de estos equipos → se consultan igual y
  aparecen solos cuando haya.
- Las piezas ESPN que ya existen (`_shared/espn-api.ts`, `_shared/espn-partido.ts`,
  `_shared/zona-pais.ts`) usan el *core* API por temporada (`listarEventosDeTemporada`) y ya
  normalizan evento → partido. La función vieja `sync-fixtures-espn` está apagada desde 0016 y
  queda así.
- **Confirmado que el core API sirve también para esto** (`/leagues/<slug>/seasons/<año>/teams/<id>/events`
  con `dates=`): `uru.1` Peñarol 3 eventos, `fifa.friendly` Uruguay 2 eventos. `fifa.worldq.conmebol`
  devuelve temporada vigente 2023 (ciclo terminado) → 0 eventos hoy; cuando ESPN abra el ciclo nuevo
  la temporada cambia sola. Se reusa `_shared/espn-api.ts` tal cual.

## 3. Diseño

### 3.1 Edge Function nueva `sync-espn-uruguay`

- **Config fija** (en el código, como `CLUBES_ESPN`):
  - Peñarol → ESPN 2683, club nuestro `CA Peñarol`; ligas `uru.1`, `conmebol.libertadores`,
    `conmebol.sudamericana`.
  - Nacional → ESPN 2684, club nuestro `Club Nacional`; mismas ligas.
  - Uruguay → ESPN 212, "equipo" selección; ligas `fifa.friendly`, `fifa.worldq.conmebol`,
    `conmebol.america`, `fifa.world`.
- **Qué hace por equipo y liga:** trae los eventos de hoy −3 días a +300 días (misma ventana que la
  sync vieja: lo recién jugado pasa a `finalizado`), los normaliza con `normalizarEvento` y hace
  upsert en `partidos` por (`proveedor_externo='espn'`, `id_externo=<eventId>`), igual que
  `sync-fixtures-espn`. Una liga que falla no corta las demás (se anota en `parametros`).
- **Vínculo con jugadores:** los partidos de Peñarol se vinculan en `partidos_jugadores` a los
  jugadores **activos, `servicio_contenido`, sin `servicio_match_day`, con `club_actual_id` = ese
  club** (hoy Abel y Franco; Nacional → Martirena y Silvera). Se calcula en cada corrida: si un
  jugador cambia de club (lo detecta `sync-roster`), deja de vincularse solo. `con_seleccion=false`.
- **Selección:** los partidos de Uruguay se guardan con `club_local/visitante` = un club
  `Uruguay` (se crea una vez, `proveedor_externo='espn'`, `id_externo='212'`) y **sin**
  `partidos_jugadores`. La competencia se resuelve/crea por nombre con `tipo='seleccion'`
  (Eliminatorias ya existe: `ELIM`); amistosos → `Amistoso internacional` (`AMI`).
- **Competencias de clubes:** `uru.1` → `Primera División Uruguay` (`URU`, `tipo='liga'`), se crea
  si no existe; Libertadores/Sudamericana ya existen (`LIB`/`SUD`).
- **Zona horaria:** la de la sede por país (`zonaDePais`); si no se sabe, `America/Montevideo` solo
  para partidos de `uru.1` (sede en Uruguay); para la selección, `null` si ESPN no da país
  (el front ya maneja zona desconocida).
- **Bitácora:** fila en `sincronizaciones` con `proveedor='espn'`, `recurso='partidos'`,
  `parametros { alcance: 'uruguay', ligas, eventos, errores }`.
- **Disparo:** `pg_cron` diario 07:00 UTC (04:00 UY) + manual con `x-sync-secret`;
  `--no-verify-jwt`. Idempotente.

### 3.2 Base (migración `0031`)

- Cron de `sync-espn-uruguay`.
- Vista `partidos_seleccion` (`security_invoker`, revoke a anon): partidos cuya competencia es
  `tipo='seleccion'` **y** con Uruguay (`id_externo='212'`, espn) de local o visitante, desde hace
  3 días. Mismas columnas que `proximos_partidos` para reusar el tipo del front, con las de
  jugador en `null` (`jugador_id`, `jugador_nombre`, …).
- `proximos_partidos_contenido` (0027) **no cambia**: ya toma partidos de jugadores solo-Contenido,
  así que los de Peñarol/Nacional entran solos.
- `avisos_sistema()`: se suma la fuente `('espn', 'partidos', 'partidos de Uruguay (ESPN)',
  interval '36 hours')` para que el cartel del Administrador avise si se cae.

### 3.3 Front

- **Calendario** (`/calendario`): filtro nuevo `seleccion` → chips `Todos · Match Day · Contenido ·
  Selección`. Eventos de `partidos_seleccion` con `grupo: 'seleccion'`, sin clic (no hay panel),
  sin color. Se ven en `todos` y `seleccion`.
- **/partidos:** chip **Selección** en `BarraFiltros`. Tarjetas de la selección: mismas
  `TarjetaPartido` sin cara de jugador ni botones de Dropbox, no abren panel. En **Todos** se
  suman a los de Match Day, ordenados por fecha.
- **Duplicado Match Day ↔ Selección:** si un representado de Match Day está convocado, ese mismo
  partido puede venir también por API-Football como partido de Match Day (`con_seleccion`). En
  **Todos** se muestra una sola vez: gana el de Match Day (tiene ticket). Criterio: mismo día en
  Uruguay y competencia `tipo='seleccion'`. En el filtro Selección se ve siempre.
- **Fechas señaladas** del calendario: sin cambios (los partidos no son notas).

### 3.4 Convocatoria a mano (migración `0032`)

- RPC `seleccion_convocar(p_partido, p_jugador, p_convocado)` (security definer): solo
  Administrador o Community Manager; el partido tiene que estar en `partidos_seleccion`; el
  jugador, activo, de Match Day y con `seleccion = 'Uruguay'`. Tildar → fila en
  `partidos_jugadores` (`con_seleccion = true`, `convocado = true`); destildar → se borra esa fila.
- `proximos_partidos` (`create or replace`, mismas columnas): cuando `con_seleccion`, el "club"
  del jugador es el lado del partido que se llama como su selección (Uruguay) y el rival es el
  otro. Así la tarjeta, el calendario (`agenda_anual`) y el ticket (`tickets_match_day`) dicen
  "Uruguay vs India" y no "Al-Qadisiyah vs India". Lo demás sale solo de esa vista: tarjeta con
  la cara, ticket pendiente que vence 2 días antes, semáforo.
- Front: en la tarjeta de la selección, una casilla por representado convocable ("Convocado:
  Nández"): habilitada para Administrador y CM; el resto la ve deshabilitada. En **Todos** manda la
  tarjeta de Match Day (con cara), como en §3.3.
- Destildar después de que el Diseñador marcó Completado: el ticket desaparece (la marca en
  `disenos_partido` queda, inofensiva; si se vuelve a tildar, reaparece completado).

## 4. Errores y bordes

- ESPN caído o una liga con 400 → la corrida sigue con el resto; si todo falla, `estado='error'` y
  el cartel del Administrador lo muestra a las 36 h.
- Partido reprogramado → el upsert por `id_externo` actualiza fecha/estado; no quedan dobles.
- Rival sin nombre parseable → se usa el nombre del competidor del evento (como la sync vieja).
- Un uruguayo que deja Peñarol/Nacional para un club que no está en la config → sus partidos dejan
  de aparecer; el cartel de traspasos ya avisa, y agregar el club es sumar una línea de config.

## 5. Pruebas

- Unit (`node --test`): armado de la lista equipo×liga, vínculo jugadores↔club, resolución de
  competencia por slug, dedupe Match Day↔Selección en Todos, `filtrarCalendario('seleccion')`,
  filtro Selección de /partidos.
- DB (`scripts/*.test.mjs` con ROLLBACK): `partidos_seleccion` solo trae partidos de Uruguay de
  tipo selección; anon no lee; `avisos_sistema` incluye la fuente espn.
- Corrida manual en local de la función contra ESPN real (solo lectura + escritura en la base de
  siempre) antes de pedir el deploy; verificar filas en `partidos` / `partidos_jugadores`.
- QA en navegador (dev :3100 y prod): chips nuevos, Peñarol 4/10 en Contenido, Uruguay–India 6/10
  en Selección y Todos, 390 px.

## 6. Deploy (lo corre Gerardo)

1. Migraciones `0031` y `0032` en el SQL Editor.
2. `npm run deploy:funcion -- sync-espn-uruguay`.
3. Claude verifica la primera corrida (manual) y el cartel.
