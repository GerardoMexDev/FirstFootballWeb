# Avances del Proyecto — Football First (Fase 1)

> Contexto persistente entre sesiones: el "cerebro" del proyecto, el resumen que
> reemplaza la memoria de la sesión anterior. Corto y factual.
> Se lee junto con `planeacion/contexto.md` (arquitectura completa) al iniciar cada sesión.

## Protocolo de sesión (ritual de inicio y cierre)

En Claude Code **no hay memoria entre sesiones**, así que este protocolo es obligatorio.

**Al INICIAR una sesión:**
1. Claude lee `planeacion/contexto.md` + este archivo y confirma dónde se quedó.
2. No se codea hasta acordar el enfoque con Gerardo (Regla 0 de la metodología).

**Al FINALIZAR una sesión:**
1. Claude regenera este archivo (hecho, decisiones, reglas técnicas nuevas, próximos pasos).
2. Se guarda el archivo.
3. Rutina de cierre Git: `git add . && git commit -m "Sesión N: ..." && git push`.
4. La sesión no se cierra hasta que `git push` terminó OK.

**Última actualización:** 2026-09-04/05 (Sesión 2, cont.: sync-partidos EN VIVO)
**Estado general:** **la vista `partidos` ya muestra partidos reales de la agencia**, traídos
de verdad por `sync-partidos` (Edge Function desplegada) + `pg_cron` diario. Roster real
cargado (`clubes`/`jugadores`, 6+6, con IDs de API-Football). Verificado con capturas de
pantalla: Toluca vs Puebla, Bragantino vs Bahia, Atlante vs Atlas, Genk vs Anderlecht,
Colo-Colo vs Huachipato — todo real, hoy. Falta: `estadisticas_partido`/`convocatorias`
(otra Edge Function), motor de hitos, Excel de fechas manuales, resto de vistas.

---

## 1. Descripción breve del proyecto

Plataforma web interna para una agencia de representación de futbolistas (~4 usuarios,
opera en hora de Uruguay). Sirve para seguir partidos (fixture, resultados, horarios),
ver trayectorias y estadísticas por jugador, y anticipar hitos (partido 50, gol 25,
cumpleaños, aniversarios de club/contrato). Fase 2 (no ahora): CRM de artes con flujo
diseñador → Community Manager.

## 2. Stack técnico

- **Frontend:** Next.js 14+ (App Router) + TypeScript + React. Deploy en Vercel (free).
- **Estilos:** CSS de `demo-fase1.html` SIN modificar → `styles/tokens.css` + `styles/demo.css`.
  Sin Tailwind, sin CSS-in-JS. Nunca renombrar una clase de la demo.
- **Backend / BD / Auth / Storage:** Supabase (free) — Postgres + Auth + Storage +
  Edge Functions (Deno/TS) + `pg_cron` + `pg_net`.
- **Datos deportivos:** API-Football (api-sports.io), plan Pro (~USD 19). Cascada de
  respaldo gratis: ESPN (no oficial) → TheSportsDB/Wikidata. Datos manuales vía Excel.
- **Fechas/horas:** Luxon + zonas IANA. Prohibido `date-fns` con offsets fijos.
- **Tipos:** `supabase gen types typescript` → `lib/supabase/tipos-db.ts` (regenerar tras cada migración).
- **Presupuesto:** Supabase 0 + Vercel 0 + API-Football ~19. Tope acordado 20–30 USD/mes.

## 3. Estructura de archivos clave

| Archivo / carpeta | Función | Estado |
|---|---|---|
| `planeacion/contexto.md` | Arquitectura completa Fase 1 (fuente de verdad) | ✅ existe |
| `planeacion/avances.md` | Este archivo — bitácora entre sesiones | ✅ |
| `planeacion/arquitectura-fase1.html` | Documento para la agencia (artifact) | ✅ existe |
| `planeacion/sistema-diseno.md` | Sistema de diseño derivado 1:1 de la demo | ✅ creado S1 |
| `planeacion/alcance-funcionalidades.md` | Alcance Fase 1 y Fase 2 (20 func. MVP + criterios) | ✅ creado S1 |
| `planeacion/demo-fase1.html` | UI/UX cerrada, fuente de todo el CSS (UTF-8, ~83 KB, 1229 líneas) | ✅ en el repo |
| `styles/tokens.css` | `:root` + `[data-theme="dark"]` de la demo (líneas 11–39), intacto | ✅ extraído S1 |
| `styles/demo.css` | Resto del `<style>` de la demo (líneas 40–411), intacto | ✅ extraído S1 |
| `supabase/migrations/0001_esquema_inicial.sql` | Enums + 11 tablas dominio + CRM F2 (solo estructura) + RLS + vistas `proximos_partidos` / `agenda_anual` + seed `escalas_hito` + jobs `pg_cron` comentados | ✅ **APLICADA** en Supabase (PG17) y verificada |
| `.env.local` | Secretos: URL + anon + service_role + DB password de Supabase | ✅ creado — **gitignored**, nunca se sube |
| `scripts/aplicar-migracion.mjs` | Runner de migraciones (conexión directa `pg`, lee `.env.local`) | ✅ `npm run migracion <archivo.sql>` |
| `lib/supabase/tipos-db.ts` | Tipos generados de la BD | ✅ generado S1 |
| `middleware.ts` | Refresca la sesión en cookies + redirige `/login`↔rutas privadas | ✅ creado S2 |
| `app/layout.tsx` | HTML/body, CSS, fuentes por `<link>`, `<symbol id="ff">` | ✅ |
| `app/(app)/layout.tsx` | Shell `.app on` + `BarraSuperior` + overlays (velo/panel/toast) + **guard de sesión server-side** | ✅ guard S2 |
| `app/(app)/partidos/page.tsx` | Vista `partidos` **conectada a datos reales**: hero, KPIs, filtros, lista agrupada por día | ✅ conectada S2 |
| `app/(app)/{calendario,jugadores}/page.tsx` + `jugadores/[jugadorId]` | Vistas: esqueleto con clases de la demo + `EstadoSinDatos` | ✅ esqueleto |
| `lib/repositorios/repositorio-partidos.ts` | `RepositorioPartidosSupabase`: lee `proximos_partidos`, filtra `estado != 'finalizado'`, mapea a `PartidoProximo` | ✅ creado S2 |
| `lib/partidos/utilidades.ts` | `pesoPartido`, `claseTarjeta`, `filtrarPartidos`, `agruparPorDia` (reglas puras, sin JSX) | ✅ creado S2 |
| `components/partidos/{HeroPartidoDelDia,TarjetasKpi,BarraFiltros,SeccionPartidos,ListaPartidos,TarjetaPartido}.tsx` | Vista `partidos` completa sobre datos reales | ✅ creados S2 |
| `components/comunes/{Escudo,CaraJugador}.tsx` | Escudo de club / cara de jugador, con fallback a iniciales (hash de color igual a la demo) si no hay imagen o falla | ✅ creados S2 |
| `app/(auth)/login/page.tsx` + `components/auth/FormularioLogin.tsx` | Marcado `.login` de la demo + form real (`signInWithPassword`, errores humanos, botón mostrar/ocultar contraseña) | ✅ cableado S2 |
| `styles/app.css` | CSS de componentes que la demo no tenía (hoy: botón de ojo). Mismos tokens, no toca `demo.css` | ✅ creado S2 |
| `app/page.tsx` | Redirige `/` → `/partidos` | ✅ |
| `lib/fechas/zonas.ts` | `ZONA_AGENCIA`, `aInstanteUtc`, `horaEnUruguay`, `horaEnSede`, `diaEnUruguay`, `ZONAS_CARTERA` | ✅ |
| `lib/formato/valores.ts` | `mostrar(v) => v ?? 'Sin datos'`, `SIN_DATOS`, `esVacio` | ✅ |
| `lib/supabase/{cliente-navegador,cliente-servidor}.ts` | Clientes `@supabase/ssr` (anon key) | ✅ |
| `lib/repositorios/tipos.ts` | Interfaz `RepositorioPartidos` + tipo `PartidoProximo` (1:1 con columnas de `proximos_partidos`) | ✅ actualizado S2 |
| `components/comunes/Ico.tsx` · `EstadoSinDatos.tsx` | Íconos (paths de la demo, + 4 del menú de usuario S2) · componente `.sinDato` | ✅ |
| `components/layout/BarraSuperior.tsx` · `Nav.tsx` | Barra superior + nav (marca/nav OK; **menú de usuario real + cerrar sesión OK S2**; buscador/tema stub) | ✅ |
| `supabase/functions/sync-partidos/index.ts` + `_shared/{api-football,estado-partido}.ts` | Edge Function real: trae fixtures de la cartera y hace upsert en `partidos`/`partidos_jugadores`/`clubes` | ✅ **desplegada y corriendo** S2 |
| `supabase/migrations/0002_cron_sync_partidos.sql` | `pg_cron` diario (03:00 UTC) → `pg_net` → `sync-partidos`, secreto vía Vault | ✅ aplicada y probada S2 |
| `scripts/configurar-vault-cron.mjs` | Guarda/rota `sync_functions_secret` en Supabase Vault (consulta parametrizada) | ✅ creado y corrido S2 |
| `scripts/seed-usuarios.mjs` | 4 cuentas (`service_role`), idempotente | ✅ creado y corrido S2 |
| `scripts/consultar-ligas.mjs` | Solo lectura: consulta `GET /leagues` por país + búsquedas de continentales | ✅ creado S2 |
| `scripts/seed-competencias.mjs` | Carga las 15 competencias confirmadas (upsert manual por `id_externo`, índice único parcial) | ✅ creado y corrido S2 |
| `scripts/consultar-clubes-jugadores.mjs` | Solo lectura: `GET /teams` + `GET /players/squads` para ubicar a la cartera real | ✅ creado S2 |
| `scripts/seed-clubes-jugadores.mjs` | Carga los 6 clubes + 6 jugadores reales con IDs de API-Football (upsert por `proveedor_externo`+`id_externo`) | ✅ creado y corrido S2 |
| `scripts/importar-datos-manuales.ts` | Importa el Excel (falta el archivo) | ⬜ |
| `lib/motor-hitos/`, `components/{calendario,jugadores,paneles}/*` | Lógica y componentes con datos | ⬜ |

## 4. Hecho (por fecha, más reciente primero)

### 2026-09-04/05 — Sesión 2 (cont.: sync-partidos EN VIVO — Edge Function + roster real + cron)
- **Roster real cargado** (`scripts/consultar-clubes-jugadores.mjs` + `scripts/seed-clubes-jugadores.mjs`):
  6 clubes y 6 jugadores con sus IDs reales de API-Football, ubicados por plantel actual
  (`GET /players/squads`, no por búsqueda de nombre suelto — evita homónimos). Al-Qadsiah
  apareció en la API transliterado "Al-Qadisiyah FC" (el buscador de `/teams` además rechaza
  guiones). Gerardo confirmó la tabla completa antes de cargar nada.
- **Dos límites nuevos del plan free descubiertos probando de verdad** (no estaban en la
  documentación previa, hay que sumarlos a §10):
  1. `GET /fixtures` no acepta `season` reciente (solo 2022-2024) ni `next`/`last` por equipo.
  2. `GET /fixtures?date=` sí funciona, pero solo para una ventana corta alrededor de "hoy"
     (el mensaje de error del plan la indica exacta, ej. "2026-09-04 a 2026-09-06" — unos 3 días).
  Por esto la sync itera día por día con `date=`, filtrando del lado nuestro por los clubes de
  la cartera — más consultas que lo planeado en `contexto.md`, pero es lo único que el plan
  free permite. Documentado en `supabase/functions/_shared/api-football.ts`.
- **`lib/repositorios/externos/` no se usó como en `contexto.md`**: se optó por
  `supabase/functions/_shared/` (patrón estándar de Supabase para código compartido entre
  Edge Functions) para evitar depender de que el bundler de Deno resuelva imports relativos
  que salen de `supabase/functions/` — funcionó al primer intento con este patrón.
- **`supabase/functions/sync-partidos/index.ts`** — Edge Function real: trae jugadores activos
  + su club (con `id_externo`/zona horaria), las competencias catalogadas, pide los fixtures
  del día por una ventana de `SYNC_DIAS_ADELANTE` (o `?dias=` en la URL, para pruebas) días,
  filtra a los que tocan un club de la cartera, y por cada uno hace upsert de: el club local Y
  el visitante en `clubes` (aunque sean rivales recién descubiertos — la vista `proximos_partidos`
  necesita esa fila para resolver `rival_nombre`), el `partido`, y un `partidos_jugadores` por
  cada representado involucrado (puede haber 2, ej. Toluca vs Atlante). Idempotente por
  `(proveedor_externo, id_externo)`, mismo patrón manual que los scripts de seed. Protegida por
  header `x-sync-secret` (nunca pública) — deployada con `--no-verify-jwt` porque quien la llama
  es `pg_cron`, no un usuario con sesión.
- **`zona_horaria_evento` solo se completa cuando se conoce de verdad**: si nuestro club juega
  de local, se usa la zona ya guardada; si juega de visitante y el rival es nuevo (recién
  upserteado desde el fixture), esa zona queda `NULL` — nunca se inventa. Confirmado con datos
  reales: de los 5 partidos de la primera corrida, 4 son de visitante (zona `NULL`, la tarjeta
  no muestra "hora local") y 1 de local (Bragantino, zona conocida, pero coincide con la hora de
  Uruguay porque Brasil no tiene horario de verano — tampoco se muestra la línea de "hora local",
  correctamente, por ser redundante).
- **Descubrimiento operativo**: el reloj real de la Edge Function (infraestructura de Supabase)
  no coincide con el de esta sesión/máquina — iba ~1 día adelantado. En vez de perseguir el
  desfasaje, `obtenerFixturesDeVariosDias` ahora atrapa el rechazo específico del plan
  ("Free plans do not have access to...") por día y lo salta (`diasOmitidos`) en lugar de abortar
  todo el sync — la corrida termina en `estado='ok'` aunque algún día puntual haya quedado fuera
  de rango.
- **`pg_net` tiene un timeout default de 5000&nbsp;ms** — muy corto para una función que espera
  ~6,5&nbsp;s entre cada llamada a la API (límite de 10&nbsp;req/min). Se pasa
  `timeout_milliseconds := 60000` en el `net.http_post` (migración 0002). Sin esto, `pg_cron`
  cortaba la llamada antes de que la función terminara (`timed_out: true` en `net._http_response`).
- **`supabase/migrations/0002_cron_sync_partidos.sql`**: agenda `sync-partidos-diario` a las
  03:00 UTC. El secreto del header (`x-sync-secret`) se lee de **Supabase Vault**
  (`vault.decrypted_secrets`), nunca queda en texto plano en la migración — lo carga
  `scripts/configurar-vault-cron.mjs` con una consulta parametrizada (conexión directa, mismo
  patrón que `aplicar-migracion.mjs`).
- **`tsconfig.json`**: se excluyó `supabase/functions/**` — Next.js intentaba tipar los archivos
  Deno (`npm:` specifiers, `Deno.serve`, `Deno.env`) con el `tsconfig` del proyecto y fallaba el
  build. Deno los tipa aparte, al deployar.
- **Verificado de punta a punta, con datos reales** (no de prueba): `sync-partidos` invocada
  manualmente → `estado:"ok"`, 5 partidos reales insertados (Toluca vs Puebla, Bragantino vs
  Bahia, Atlante vs Atlas, Genk vs Anderlecht, Colo-Colo vs Huachipato). Login real como `alexis`
  + captura de pantalla de `/partidos`: hero elige el partido de mayor peso, KPIs correctos,
  agrupado por día en hora de Uruguay, crests/caras con iniciales (sin fotos todavía, esperado).
  Se probó también el disparo real de `pg_cron` → `pg_net` → Edge Function (no solo un curl
  manual): `net._http_response` devolvió `status_code: 200` con el mismo resultado.

### 2026-09-04 — Sesión 2 (cont.: API-Football key + `competencias`)
- **`API_FOOTBALL_KEY`** conseguida por Gerardo (dashboard.api-football.com, plan free) y puesta
  directo en `.secretos/.env` — nunca pasó por el chat ni por ningún archivo visible. Verificada
  contra `GET /status`: plan Free, cuenta activa, 0/100 peticiones usadas — sin imprimir la key
  en ningún momento (solo longitud y datos de la cuenta).
- **`scripts/consultar-ligas.mjs`** (solo lectura, permanente): pega contra `GET /leagues` por
  país (Arabia Saudita, México, Brasil, Chile, Bélgica) y por búsqueda (Libertadores,
  Sudamericana, Europa League, AFC Champions, eliminatorias CONMEBOL), con la cobertura de la
  temporada más reciente de cada una.
- **Confirmado contra la API real** (no contra la demo): Liga de Expansión MX (id `263`)
  efectivamente NO tiene estadística por jugador — la demo ya lo adelantaba como advertencia y
  quedó verificado. La Copa de Bélgica (`Beker van België`, id `147`) tiene cobertura CERO (ni
  fixtures) — Gerardo decidió no cargarla por ahora. Copa MX / Copa por México aparecen
  discontinuadas (última temporada 2019/2022) — no hay copa doméstica activa en México hoy.
- **`scripts/seed-competencias.mjs`** — carga 15 competencias con `id_externo` real: las 6
  ligas/copas domésticas de la cartera (Pro League, Liga MX, Liga de Expansión MX, Serie A,
  Primera División, Jupiler Pro League, King's Cup, Copa do Brasil, Copa Chile — 9 en realidad,
  contando ligas y copas) + 5 continentales (Libertadores, Sudamericana, Europa League, AFC
  Champions League Elite/Two) + eliminatorias sudamericanas. `cobertura` = si la API da
  estadística por jugador para esa competencia (no si da fixtures — eso casi siempre viene).
  El índice único de `id_externo` es parcial (`where id_externo is not null`), así que el
  upsert normal de PostgREST no lo infiere — el script busca por `id_externo` y hace
  insert/update a mano (mismo criterio que `seed-usuarios.mjs`). **Corrido dos veces**: la
  primera crea las 15, la segunda las detecta y actualiza sin duplicar.
- **Dos correcciones de Gerardo tras revisar lo anterior** (ver §9 para la de Atlante):
  - La Copa de Bélgica **sí tiene cobertura en API-Football — pero en el plan Pro**, no en el
    Free que se está usando. No era "cobertura cero para siempre", era "cobertura cero en
    nuestro plan actual". Sigue sin cargarse en `competencias` (no se justifica pagar el Pro
    solo por esto todavía), pero la razón documentada estaba mal — corregida acá y en el
    comentario de `seed-competencias.mjs`.
  - **Atlante (Martín Fernández) ya no juega Liga de Expansión MX: ascendió y este torneo
    juega Liga MX**, igual que Toluca. Liga de Expansión MX queda cargada en `competencias`
    igual (no molesta y puede volver a hacer falta), pero deja de ser prioridad.

### 2026-09-04 — Sesión 2 (cont.: vista `partidos` conectada a datos reales)
- **`lib/repositorios/tipos.ts`** reescrito: `PartidoProximo` pasa a ser 1:1 con las columnas
  reales de la vista `proximos_partidos` (antes era un stub con nombres inventados).
- **`lib/repositorios/repositorio-partidos.ts`** — `RepositorioPartidosSupabase implements
  RepositorioPartidos`: `listarProximos()`/`listarPorJugador()` leen la vista, filtran
  `estado != 'finalizado'` (la vista en sí no filtra por fecha/estado — es un JOIN de todos los
  partidos de cada representado; "próximos" se aplica acá, no se tocó el esquema) y mapean
  snake_case → camelCase descartando filas sin `partido_id`/`jugador_id`/`jugador_nombre`.
- **Tipado de punta a punta**: `crearClienteServidor`/`crearClienteNavegador` pasan a
  `createServerClient<Database>`/`createBrowserClient<Database>`. El repositorio tipa su cliente
  como `ReturnType<typeof crearClienteServidor>` en vez de reconstruir `SupabaseClient<Database>`
  a mano (ver §10 — no calzaban estructuralmente con la versión instalada de supabase-js).
- **`lib/partidos/utilidades.ts`**: `pesoPartido`, `claseTarjeta`, `filtrarPartidos`,
  `agruparPorDia` — mismas reglas que la demo (`peso`, `claseP`, `filtrar`), pero sobre `diaUy`
  (ya calculado por la vista en zona de Uruguay) en vez de aritmética sobre `new Date()`.
- **`lib/fechas/zonas.ts`**: + `diasDesdeHoyUy`, `etiquetaDiaUy` (Hoy/Mañana/día de la semana/
  fecha completa) y `horaCortaEnSede` (hora en la sede sin sigla de zona — la demo usaba
  CEST/BRT/…, prohibido en producción, ver arquitectura-fase1.html §3).
- **`lib/formato/valores.ts`**: + `iniciales(nombre)` para el fallback de escudo/cara.
- **`components/comunes/Escudo.tsx` y `CaraJugador.tsx`** (nuevos): imagen si hay URL, si no
  (o si falla la carga) iniciales con el mismo hash de color que `crest()` en la demo. `.cara.ph`
  (fallback de cara) se agregó a `styles/app.css` — la demo solo estilaba esa clase en `.pm`/`.res`.
- **`components/partidos/{HeroPartidoDelDia,TarjetasKpi,BarraFiltros,SeccionPartidos,
  ListaPartidos,TarjetaPartido}.tsx`** (nuevos) — la vista completa sobre datos reales.
  Diferencias documentadas frente a la demo (todas en comentarios de cabecera de cada archivo):
  sin sigla de zona horaria (solo "hora local"), sin "· país" en la competencia (la vista no lo
  expone), sin tag de "Hito" ni KPI de "Hitos por alcanzar" (motor de hitos, sesión aparte — no
  se fabrica un 0 en su lugar), sin foto de fondo del hero (no hay foto real del partido), y las
  tarjetas/hero no son cliclinks todavía (paneles, sesión aparte) — no llevan `role="button"`.
- **`EstadoSinDatos`** acepta `style` opcional (mismo patrón que la demo, que ajusta ese
  componente con estilos puntuales según dónde aparece).
- **Verificado con datos reales, no solo con la BD vacía**: se insertó una cadena de prueba
  completa (competencia, 2 clubes, 1 jugador, 2 partidos — uno hoy, uno internacional en 2 días)
  con `service_role`, se entró como `alexis` de verdad, se comprobó con screenshot que el hero
  elige el partido de mayor peso, los KPIs cuentan bien, la lista agrupa por día en hora de
  Uruguay, y el filtro "Internacional" reduce a 1 resultado — y se borró todo al terminar
  (0 filas en `partidos`/`jugadores`/`clubes`/`competencias` al cerrar, verificado con conteo).
  0 errores de consola en ambos casos (BD vacía y con datos). Nombres de prueba largos
  (`[QA] Club de Prueba`) sí solapaban el hero con el badge superior — se repitió la prueba con
  nombres de largo realista (`Toluca QA`) y no solapa: era un artefacto del dato de prueba, no
  un bug del layout.

### 2026-09-04 — Sesión 2 (auth)
- **`scripts/seed-usuarios.mjs`** (no `.ts` — ver §10): crea las 4 cuentas fijas con
  `admin.auth.admin.createUser` (`service_role`, `email_confirm:true`) y fija `nombre_completo`/`cargo`
  en `perfiles` (el trigger `handle_new_user` ya inserta la fila con nombre; acá se completa `cargo`).
  Idempotente: si el correo ya existe, lo busca con `listUsers` y solo actualiza el perfil.
  **Corrido dos veces contra el Supabase real** del proyecto: 1ª vez crea las 4, 2ª vez detecta
  que ya existían sin duplicar ni fallar. Cuentas: `maxi`/Diseñador, `pedro`/Community Manager,
  `felipe`/Administrador, `alexis`/Prueba — las 4 con contraseña `demo1234` (decisión S1).
- **`middleware.ts`** (patrón oficial `@supabase/ssr`): refresca el JWT en cookies en cada
  request, valida con `getUser()` (no `getSession()`, que no re-verifica el token), redirige
  a `/login` si no hay sesión y a `/partidos` si hay sesión y se pide `/login`. `matcher` excluye
  estáticos.
- **Guard en `app/(app)/layout.tsx`**: además del middleware, cada Server Component bajo `(app)`
  vuelve a chequear `auth.getUser()` (defensa en profundidad, mismo criterio que RLS) y trae
  `nombre_completo`/`cargo` de `perfiles` para pasárselo a `BarraSuperior`.
- **Login real**: `app/(auth)/login/page.tsx` (Server Component, mantiene `metadata`) delega el
  formulario a `components/auth/FormularioLogin.tsx` (Client Component): arma el correo
  `usuario@footballfirst.uy`, llama `signInWithPassword`, muestra estado "Ingresando…" y errores
  en lenguaje humano (`.aviso` de la demo, sin clases nuevas) — "Usuario o contraseña incorrectos."
  en vez del mensaje crudo de Supabase.
- **`BarraSuperior.tsx`** pasa a Client Component: `.who__btn` muestra nombre/cargo reales y la
  inicial; el desplegable `.drop` abre/cierra (click afuera + Escape, iguala el comportamiento de
  la demo) y "Cerrar sesión" llama `signOut()` + redirige a `/login`. "Mi perfil"/"Cambiar
  contraseña"/"Notificaciones" quedan `disabled` (paneles, sesión aparte). 4 íconos nuevos en
  `Ico.tsx` (`persona`, `candado`, `campana`, `salir`), copiados 1:1 del dropdown de la demo.
- **Verificado end-to-end** (no solo `npm run build`): `signInWithPassword` con la clave **anon**
  (mismo camino que el navegador) para las 4 cuentas + lectura de su propia fila de `perfiles`
  bajo RLS — las 4 devuelven `nombre_completo`/`cargo` correctos. Middleware probado con `curl`:
  `/partidos` sin sesión → 307 a `/login`; `/login` → 200. Script de verificación temporal, no
  quedó en el repo.
- **Feedback de Gerardo tras probar el login** → se agregó el botón de "mostrar/ocultar
  contraseña" en `FormularioLogin.tsx` (íconos `ojo`/`ojoCerrado`, nuevos, no vienen de la demo).
  Como la demo no tenía este estado, el CSS nuevo (`.campo__envoltorio`, `.campo__ojo`) se puso en
  **`styles/app.css`** (archivo nuevo, mismos tokens) en vez de tocar `styles/demo.css` — así
  `demo.css` sigue siendo la copia bit a bit de la maqueta. Se confirmó con Gerardo que el menú de
  usuario (Mi perfil/Cambiar contraseña/Notificaciones) y el botón de tema siguen deshabilitados
  **a propósito** (sesiones aparte, ya en el pendiente §5) — no son bugs.
  Verificado con `browser-automation`: click alterna `#pass` entre `type="password"`/`"text"`, 0
  errores de consola, screenshot del formulario OK.

### 2026-09-03 — Sesión 1
- Claude leyó `planeacion/contexto.md` y creó esta bitácora.
- Gerardo colocó `planeacion/demo-fase1.html` (UTF-8 intacto). Claude la leyó completa
  (1229 líneas): 3 vistas, login full-screen, buscador ⌘K, tema claro/oscuro, panel lateral,
  toasts; tokens `:root` + `[data-theme="dark"]`; lógica mock (`LIGAS`, `JUGADORES`, `PARTIDOS`,
  `ESCALAS`).
- **`planeacion/sistema-diseno.md`** — sistema derivado 1:1 de la demo: regla de split
  tokens.css/demo.css, color (claro+oscuro), tipografía, espaciado, radios, sombras, movimiento,
  13 componentes, accesibilidad, responsive, CSS listo para pegar, checklist de fidelidad.
- **`planeacion/alcance-funcionalidades.md`** — Fase 1 = 20 funcionalidades (conectar la demo a
  Supabase real + auth + zonas + motor de hitos + 3 Edge Functions + RLS + deploy) con criterio
  de terminado por bloque; Fase 2 = CRM + imágenes + notificaciones; fuera de alcance; validación.
- **`styles/tokens.css`** y **`styles/demo.css`** extraídos byte a byte de la demo (líneas 11–39
  y 40–411) con `sed`. Solo se agregó un comentario de cabecera; cero cambios de valores/clases.
- **`supabase/migrations/0001_esquema_inicial.sql`** — escrita según `contexto.md` §5: extensiones,
  10 enums, trigger `set_updated_at`, `perfiles` + alta automática (`handle_new_user`) + helper
  `es_usuario_activo()`, 11 tablas de dominio, `escalas_hito` con seed de las 5 escalas de la demo,
  `sincronizaciones`, estructura CRM Fase 2 (solo tablas), índices + claves naturales de upsert,
  RLS (enable en todo + políticas), vistas `proximos_partidos` y `agenda_anual`, jobs `pg_cron`
  como plantillas comentadas. **NO ejecutada** (no hay proyecto Supabase ni Postgres local).
- **Andamiaje Next.js 14** en la raíz del repo: `package.json`, `tsconfig`, `next.config.mjs`,
  `.gitignore`, `.eslintrc.json`, `.env.local.example`, `README.md`. `app/` con layout raíz
  (CSS + fuentes por `<link>` + `<symbol id="ff">`), shell `(app)/layout.tsx`, vistas
  partidos/calendario/jugadores + `jugadores/[jugadorId]`, `(auth)/login`, redirect `/`→`/partidos`.
  `lib/fechas/zonas.ts`, `lib/formato/valores.ts`, clientes Supabase `@supabase/ssr`,
  `lib/repositorios/tipos.ts`. Componentes `Ico`, `EstadoSinDatos`, `BarraSuperior`, `Nav`.
- **Verificado:** `npm install` (344 paquetes) + `npm run build` OK (8 rutas). Smoke test:
  `/partidos` 200 (renderiza `.d1` + fecha en hora UY + `.sinDato`), `/` 307→`/partidos`,
  `/login` 200. Nav y marca funcionan; buscador/tema/menú/form quedan como stub deshabilitado.

### 2026-09-03 — Sesión 1 (continuación: Supabase)
- Gerardo pasó las credenciales del proyecto Supabase ya creado (`thplgzufenxrzegwfxkg`).
  Todo en **`.env.local`** (gitignored, verificado con `git check-ignore` y `git status`).
- Se agregó `pg` y `supabase` (CLI) como devDependencies, y `scripts/aplicar-migracion.mjs`
  (runner con conexión directa `db.<ref>.supabase.co:5432`, SSL, lee `.env.local`).
- **Migración `0001` aplicada** con `npm run migracion supabase/migrations/0001_esquema_inicial.sql`.
  Verificado contra la BD real:
  - 16 tablas (11 dominio + 5 CRM Fase 2), 2 vistas (`proximos_partidos`, `agenda_anual`,
    ambas consultables, 0 filas).
  - RLS activa en **todas** las tablas de `public`; 17 políticas.
  - 10 enums propios creados; `security_invoker` y `unique nulls not distinct` OK (Postgres 17.6).
  - `escalas_hito` con las 5 escalas de la demo.
- Decisión: contraseña de las 4 cuentas = **`demo1234`** (confirmada por Gerardo).
- APIs etapa 1 = planes **free**. Única key a conseguir: **API-Football free**
  (dashboard.api-football.com, 100 req/día) → `API_FOOTBALL_KEY`. ESPN, TheSportsDB y
  Wikidata no requieren key. No urge (se usa en la sync, Sesión 3).

### 2026-09-03 — Sesión 1 (continuación: secretos + tipos-db)
- **Los secretos se movieron a `.secretos/`** (carpeta dot, ignorada entera por `.gitignore`
  con `/.secretos/`). Contiene `.env` (todas las variables) y `notas.md` (recordatorios de
  rotación/vencimiento). Ya no hay `.env.local`.
- `next.config.mjs` y los scripts cargan las variables con **`process.loadEnvFile('.secretos/.env')`**
  (Node ≥ 20.12, sin dependencia). `try/catch` en el config para que Vercel (sin archivo) no falle.
- Gerardo pasó un **`SUPABASE_ACCESS_TOKEN`** (`sbp_…`, vence **2026-12-31**). Con eso:
  `scripts/generar-tipos.mjs` (`npm run tipos:db`) genera **`lib/supabase/tipos-db.ts`**
  (~39,6 KB) vía `supabase gen types --project-id … --schema public`, sin Docker.
- Verificado: `npm run build` OK con el nuevo config; `process.loadEnvFile` carga las 6+
  variables; conexión directa a la BD OK.
- `.env.local.example` y `README.md` actualizados para apuntar a `.secretos/.env`.

## 5. Pendiente / próximos pasos

- [x] ~~Ejecutar y validar la migración `0001`~~ — hecho 2026-09-03 (ver §4 continuación).
- [x] ~~`lib/supabase/tipos-db.ts`~~ — generado 2026-09-03 (`npm run tipos:db`). Regenerar tras cada migración.
- [x] ~~Sesión auth~~ — hecho 2026-09-04 (ver §4 Sesión 2): middleware, guard, login real, menú de
      usuario + cerrar sesión. Verificado de punta a punta con las 4 cuentas.
- [x] ~~`scripts/seed-usuarios.ts`~~ — hecho 2026-09-04 como `.mjs` (ver §4 Sesión 2 y §10).
- [ ] Paneles de "Mi perfil" / "Cambiar contraseña" / "Notificaciones" (hoy `disabled` en el
      menú de usuario). — media
- [x] ~~Confirmar contra `GET /leagues` los IDs de ligas/copas/continentales; cargar `competencias`
      con su `cobertura`~~ — hecho 2026-09-04 (ver §4 Sesión 2 cont.: 15 competencias cargadas).
- [x] ~~Conectar vista `partidos` a `proximos_partidos`~~ — hecho 2026-09-04 (ver §4 Sesión 2
      cont.). Sin datos reales todavía (BD vacía hasta que corra la sync o se importe el Excel).
- [ ] `lib/motor-hitos` leyendo `escalas_hito`; sección "se vienen los hitos" + badges + KPI +
      tag en la tarjeta + tie-break del hero (todo quedó deliberadamente afuera en la Sesión 2). — media
- [ ] Wirear el click de `TarjetaPartido`/`HeroPartidoDelDia` para abrir el panel de detalle
      (hoy no son clicables — paneles, junto con el resto del panel lateral). — media
- [x] ~~`supabase/functions/sync-partidos`; activar `pg_cron`~~ — hecho 2026-09-04/05 (ver §4):
      desplegada, corriendo con datos reales, cron diario probado de punta a punta.
- [ ] `sync-estadisticas` (minutos/goles/asistencias por partido) y `sync-agenda` (cumpleaños,
      fundaciones, hitos derivados) — mismo patrón que `sync-partidos`, todavía no escritas. — alta
- [ ] `estado='parcial'`/`'error'` de `sincronizaciones` no dispara ningún aviso visible todavía
      en la UI (contexto.md: badge "Datos actualizados el {fecha}. No pudimos contactar la
      fuente."). Por ahora solo queda en la bitácora de la tabla. — media
- [ ] Revisar cada tanto si el plan free amplía la ventana de fechas de `GET /fixtures?date=`
      (hoy ~3 días) — afecta cuánto por delante puede ver "próximos partidos". — baja
- [ ] Confirmar si Al-Qadsiah juega la AFC Champions League **Elite** o **Two** esta temporada
      (se cargaron las dos, ver §4 Sesión 2 cont. — la que no aplique no va a tener partidos,
      no hace falta decidir ahora, la sync lo resuelve solo). — baja
- [ ] Copa de Bélgica: no se cargó en `competencias` — tiene cobertura en API-Football, pero
      solo en el **plan Pro** (el free no la trae). Si algún día se sube de plan, cargarla con
      `npm run seed:competencias` (agregar la fila) y listo. — baja
- [ ] Liga de Expansión MX dejó de ser prioridad: Atlante (Martín Fernández) ascendió y juega
      Liga MX esta temporada — los dos clubes mexicanos de la cartera están en la misma
      competencia. Ver §9. — baja
- [ ] Toggle de tema claro/oscuro (persistir preferencia) — Gerardo probó el botón y confirmó
      que quedaba deshabilitado a propósito (Sesión 2); no es bug, es esta tarea pendiente. — media
- [ ] Cablear buscador ⌘K y paneles laterales. — media
- [ ] `scripts/importar-datos-manuales.ts` (Excel — falta el archivo en el repo). — media
- [ ] Vista `calendario` (`DensidadAnual`, `GrillaMes`) contra `agenda_anual`. — baja
- [ ] Tests de zona horaria en fines de semana de cambio de hora. — media

## 6. Bugs conocidos / cosas a vigilar

- **Migración `0001` aplicada directo con `scripts/aplicar-migracion.mjs`, NO con el Supabase CLI.**
  No quedó registrada en `supabase_migrations.schema_migrations`. Si más adelante se adopta
  `supabase db push` para migraciones nuevas, hay que hacer `supabase migration repair --status
  applied 0001` (o renombrar a timestamp) para que no intente re-aplicar 0001.
- `agenda_anual` proyecta cumpleaños/aniversarios en una ventana de años **[-1, +2]** respecto de
  hoy; si el calendario navega más lejos, ampliar el `generate_series` de la vista.
- **`proximos_partidos` no filtra por fecha ni por estado** (es un JOIN plano de `partidos`).
  El repositorio (`repositorio-partidos.ts`) filtra `estado != 'finalizado'` en la consulta —
  si se necesita el histórico completo alguna vez, es un método nuevo, no tocar `listarProximos`.
- La vista `proximos_partidos` no expone el país de la competencia (`competencias.pais`) — las
  tarjetas de partido muestran solo el nombre, sin "· país" como la demo. Si hace falta, es
  agregar la columna a la vista (migración nueva), no algo que se resuelva en el frontend.
- **`.gitignore` ignora `*.xlsx`** (el Excel de datos manuales no se versiona). Si en algún
  momento se quiere versionar un ejemplo anonimizado, ajustar la regla.
- **`.gitignore` ignora `*.xlsx`** (el Excel de datos manuales no se versiona). Si en algún
  momento se quiere versionar un ejemplo anonimizado, ajustar la regla.
- Tests de zona horaria en los fines de semana de cambio de hora (marzo/octubre Europa,
  marzo/noviembre Norteamérica) — la hora en Uruguay no debe desfasarse.
- El warning `no-page-custom-font` en `app/layout.tsx` está silenciado a propósito (fuentes por
  `<link>` para no tocar los tokens de la demo).
- **Cosmético:** el `.toast` vacío del shell asoma un pixel en el borde inferior (su
  `transform:translate(-50%,140%)` no lo tapa del todo sin contenido). Se resuelve solo al
  cablear los toasts; si molesta antes, no renderizar `#toast` hasta que tenga contenido.

## 7. Decisiones de arquitectura ya tomadas (no reabrir sin motivo)

- **Supabase** como backend único (Postgres + Auth + Storage + Edge Functions) — free tier, todo en una.
- **Patrón repositorio** entre frontend y datos. El frontend SIEMPRE lee de Postgres, nunca de una API externa.
- **Cascada de fuentes:** API-Football (primaria) → ESPN → TheSportsDB → manual → "Sin datos".
- **Modelo híbrido de origen:** cada tabla externa lleva `origen` (`api`|`manual`|`derivado`),
  `proveedor_externo`, `id_externo`, `payload_crudo jsonb`, `sincronizado_en`. Upsert idempotente por `(proveedor_externo, id_externo)`.
- **Zonas horarias:** Luxon + IANA. Guardar `inicio_utc timestamptz` + `zona_horaria_evento` (IANA de la sede).
  `ZONA_AGENCIA = 'America/Montevideo'` (sin DST). Cero offsets fijos, cero siglas de zona como dato.
- **Timestamps:** siempre `timestamptz`, nunca `timestamp`. Conexión Postgres en UTC.
- **RLS estricta** en todas las tablas de `public`. Sin política = sin acceso. `service_role` solo en
  Edge Functions y scripts de servidor, jamás en el navegador.
- **Cero invenciones:** si la fuente no da el dato → "Sin datos". Nunca `0` por defecto. Estadísticas NULL-ables.
  Helper `mostrar(v) => v ?? 'Sin datos'`. Componente único `EstadoSinDatos`.
- **Respetar la demo al 100 %:** clases CSS, estructura HTML y variables de diseño de `demo-fase1.html` no se tocan.
- **Idioma español** en identificadores, componentes y comentarios. Vistas: `partidos`, `calendario`, `jugadores`.
- **`pg_cron`** solo agenda y dispara (via `pg_net` → `http_post` a Edge Function). No hace HTTP a terceros ni parsea JSON.
- Si una sync falla del todo: escribir `sincronizaciones` con `estado='error'`, **no tocar datos existentes**, responder 200.

## 8. Credenciales / accesos (SOLO referencias, nunca valores reales)

- `gh` CLI autenticado como `GerardoMexDev` (scopes: repo, read:org, gist).
- **Proyecto Supabase `thplgzufenxrzegwfxkg`.** URL + anon key + service_role + DB password +
  access token están en **`.secretos/.env`** (carpeta gitignored entera). El mismo set va en
  variables de entorno de Vercel y de las Edge Functions cuando toque — nunca en el repo.
  - ⚠️ El service_role y el DB password se compartieron en texto plano en el chat. Con el repo
    público, conviene **rotarlos** en el dashboard antes de cargar datos reales (el anon key no
    importa: es público por diseño, lo protege la RLS). Recordatorio en `.secretos/notas.md`.
- `SUPABASE_ACCESS_TOKEN` (`sbp_…`) en `.secretos/.env`. **Vence 2026-12-31** — renovar antes.
- API key de API-Football (plan free): **conseguida, verificada y ya en uso**. En
  `.secretos/.env` (`API_FOOTBALL_KEY`) — Gerardo la puso directo en el archivo, nunca pasó por
  el chat — **y también como secret del proyecto Supabase** (`supabase secrets set`), que es
  lo que lee `sync-partidos` en producción. Nunca en el repo ni en el cliente.
- `SYNC_FUNCTIONS_SECRET`: generado en la Sesión 2, en `.secretos/.env` y como secret de
  Supabase — autentica el header `x-sync-secret` de `sync-partidos`. También vive una copia en
  **Supabase Vault** (`sync_functions_secret`, ver `scripts/configurar-vault-cron.mjs`) para que
  `pg_cron` la use sin que quede en texto plano en ninguna migración.
- Contraseña de las 4 cuentas demo: **`demo1234`** (confirmada). Compartida SOLO para demo cerrado;
  antes de uso real, credenciales individuales fuertes.

## 9. Notas de contexto de negocio

- La agencia opera **siempre en hora de Uruguay** (`America/Montevideo`, UTC−3, sin horario de verano).
  Los jugadores están en ligas que sí aplican DST (Bélgica, parte del año México) → un mismo "20:00 local"
  cae a distinta hora de Uruguay según el mes.
- Un partido puede involucrar a **más de un** representado (ej. Toluca vs Atlante) → tabla puente `partidos_jugadores`.
- Si un jugador cambia de club, **sus partidos lo siguen** (la vista `proximos_partidos` resuelve club desde el jugador).
- `partidos.tentativo = true` si `inicio_utc` está a > 90 días (el fixture se confirma por semestre).
- Cartera Fase 1 (6 jugadores / 6 clubes / 6 países): Nahitan (Al-Qadsiah, Arabia), Fede Pereira (Toluca, México),
  Nacho Sosa (Red Bull Bragantino, Brasil), Javi Mendez (Colo-Colo, Chile), Kevin Amaro (KRC Genk, Bélgica),
  Martin Fernandez (Atlante, México). Cumpleaños y fundación de club vienen del Excel (`origen='manual'`).
- **Atlante (Martín Fernández) juega Liga MX esta temporada, NO Liga de Expansión MX** — ascendió
  y su torneo actual es el de Primera División (confirmado por Gerardo 2026-09-04). Con esto, los
  dos clubes mexicanos de la cartera (Toluca y Atlante) están en la **misma** competencia (`id_externo`
  `262`, Liga MX). `contexto.md` (§ arquitectura, escrito antes de este ascenso) todavía habla de
  "6 ligas + Liga de Expansión MX" como si fueran competencias separadas de la cartera — esta nota
  la corrige; no se reescribió `contexto.md`. `competencias` ya tiene cargada Liga de Expansión MX
  (`id_externo` `263`) igual, por si el roster vuelve a tocarla — **no es prioridad** por ahora.
- Zonas IANA de la cartera: `Asia/Riyadh`, `Europe/Brussels`, `America/Mexico_City`, `America/Sao_Paulo`,
  `America/Santiago`, `America/Montevideo`.
- Registro público de Auth deshabilitado. Confirmación de email desactivada. Login acepta el nombre y la app
  le agrega el dominio `@footballfirst.uy`.
- Huecos conocidos donde se muestra "Sin datos" (nunca inventar): pre-listas de convocatoria, juveniles/reservas,
  rendimiento individual en copas poco cubiertas, lesiones con detalle.

## 10. Lecciones técnicas aprendidas (se acumulan, no se borran)

- **CSS de la demo = `<button>`, no `<a>`.** El CSS estiliza `.nav button`, así que `Nav.tsx`
  usa `<button onClick={router.push()}>`, no `<Link>`. Mismo criterio para cualquier control
  de la demo que sea `button`.
- **Fuentes por `<link>` en el `<head>` del layout raíz**, no `next/font`: `next/font` genera un
  nombre de familia con hash y habría que editar `--display`/`--ui` en `tokens.css` (prohibido).
  En App Router el `<head>` del layout raíz persiste entre vistas, así que no hay penalidad real.
- **Importar CSS desde fuera de `app/`** funciona: `import '@/styles/tokens.css'` en el layout raíz.
- **`@supabase/ssr`**: el callback `setAll` de cookies hay que tiparlo a mano
  (`{ name; value; options: CookieOptions }[]`) o `next build` falla por `implicit any`.
- **Extraer CSS con `sed -n '11,39p'` / `'40,411p'`** mantiene el archivo byte a byte; no copiar
  a mano bloques largos de la demo.
- **Conexión a Postgres de Supabase:** el pooler IPv4 (`aws-...pooler.supabase.com`) necesita
  saber la región; la conexión **directa** `db.<ref>.supabase.co:5432` con `ssl:{rejectUnauthorized:false}`
  funcionó sin más (esta máquina resuelve IPv6). Postgres **17.6** → `security_invoker` y
  `unique nulls not distinct` disponibles.
- **`supabase gen types`** en CLI 2.116: con `--db-url` exige un runtime de contenedores (Docker);
  con `--project-id` exige `SUPABASE_ACCESS_TOKEN`. Sin Docker, el camino es el access token
  (ver `scripts/generar-tipos.mjs`).
- **Secretos en `.secretos/` + `process.loadEnvFile('.secretos/.env')`** (Node ≥ 20.12) en
  `next.config.mjs` y en cada script — no hace falta `dotenv`. El config lo envuelve en
  `try/catch` para que el build de Vercel (sin el archivo) no rompa.
- **Node no ejecuta un `.cmd` sin `shell:true`** (`EINVAL`). Para llamar al CLI de Supabase en
  Windows, `spawnSync(bin, args, { shell: process.platform === 'win32' })` con args literales.
- El `<section class="vista on">` de cada page lleva `on` porque en Next cada ruta renderiza su
  propia vista (en la demo era un tab-switch con una sola `.vista.on` a la vez).
- **`seed-usuarios` quedó en `.mjs`, no `.ts`** (el plan original decía `.ts`): correrlo con
  `node` directo hubiera pedido `ts-node`/`tsx` como dependencia nueva solo para un script de un
  uso. Mismo criterio que `aplicar-migracion.mjs`/`generar-tipos.mjs` — KISS.
- **`admin.auth.admin` no tiene "buscar por correo"**: para el camino idempotente hay que
  `listUsers({ perPage })` y filtrar por `.email` en el resultado.
- **Middleware de Supabase: usar `getUser()`, no `getSession()`.** `getSession()` solo lee la
  cookie sin validarla contra el servidor de Auth; `getUser()` sí revalida el JWT — es la única
  forma correcta de proteger rutas en el middleware (lo dice la propia doc de Supabase).
- **Un script `.mjs` fuera de la carpeta del proyecto no resuelve `node_modules`** (probado con
  un script de verificación en el scratchpad de la sesión): `node` busca el árbol de módulos
  desde la ubicación del archivo hacia arriba. Cualquier script que importe dependencias del
  proyecto tiene que vivir (aunque sea temporalmente) adentro del repo.
- **Server Component que lee cookies (`auth.getUser()`) vuelve la ruta dinámica** (`ƒ` en vez de
  `○` en el build de Next) — es lo esperado: no se puede pre-renderizar algo que depende de la
  sesión de cada visitante.
- **`SupabaseClient<Database>` armado a mano no calza con el que devuelve `createServerClient`
  de `@supabase/ssr`** en esta versión instalada (supabase-js 2.115 agrega un parámetro de tipo
  extra para detectar la versión de PostgREST desde `Database.__InternalSupabase`). Un repositorio
  que recibe el cliente como `SupabaseClient<Database>` typeaba las filas como `never`. Solución:
  tipar el parámetro del repositorio como `ReturnType<typeof crearClienteServidor>` en vez de
  reconstruir el tipo del cliente.
- **`.select('col1, col2').single()` puede typear el resultado como `never`** con esta combinación
  de versiones, incluso con el cliente bien tipado. `.returns<T[]>()` **antes** de `.single()`
  (no después: `.single()` ya fija el tipo final) fuerza la forma correcta sin pelear con la
  inferencia automática de postgrest-js.
- **API-Football, plan free — límites reales, no solo el de 100 req/día**: `GET /fixtures` NO
  acepta `season` reciente (solo 2022-2024) ni `next`/`last` por equipo. `GET /fixtures?date=`
  sí anda con la temporada actual, pero solo para una ventana corta de días alrededor de "hoy"
  (~3 días — el mensaje de error trae el rango exacto). Cualquier diseño de sync sobre el plan
  free tiene que iterar por fecha, no por equipo/temporada.
- **El buscador de `GET /teams?search=` rechaza guiones y otros caracteres no alfanuméricos**
  ("Al-Qadsiah" falla; hay que probar variantes sin guion o la transliteración que use la API,
  en este caso "Qadisiyah"). `GET /players/squads?team=<id>` es más confiable que
  `GET /players?search=` para ubicar a un jugador puntual: da el plantel actual completo y se
  filtra por apellido ahí, sin choques de homónimos.
- **El reloj de una Edge Function de Supabase corre en su propia infraestructura real** y puede
  no coincidir con el de la máquina/sesión que la prueba (se vio ~1 día de diferencia). Un diseño
  que itera "hoy + N días" no puede asumir cuál es exactamente "hoy" para el proveedor externo —
  hay que seguir probando día por día y tolerar que alguno quede fuera de rango, en vez de calcular
  la ventana exacta de antemano.
- **`pg_net.http_post` tiene `timeout_milliseconds` default de 5000** — cualquier Edge Function
  que tarde más (por rate-limit de una API externa, por ejemplo) necesita pasarlo explícito o
  `pg_cron` corta la llamada a mitad de camino (`net._http_response.timed_out = true`).
- **Índices únicos parciales y Vault, mismo patrón que ya se vio con `seed-competencias.mjs`**:
  ni el `upsert` de PostgREST ni un `ON CONFLICT` simple sirven contra un índice `where ... is not
  null` — hay que buscar y decidir insert/update a mano. Y un secreto que tiene que usarlo SQL
  (acá, un job de `pg_cron`) no puede vivir en un archivo de migración versionado: va a
  **Supabase Vault** por una conexión aparte con consulta parametrizada.
- **Deno (Edge Functions) no comparte tipos con el `tsconfig` de Next.js**: hay que excluir
  `supabase/functions/**` del `tsconfig.json` raíz o `next build` falla intentando tipar
  `npm:` specifiers y globals de Deno (`Deno.serve`, `Deno.env`) que no existen en ese contexto.
- **Compartir código entre Edge Functions**: mejor `supabase/functions/_shared/` (import relativo
  simple, dentro del árbol que el CLI ya sabe empaquetar) que reusar `lib/` de la raíz del
  proyecto — evita cualquier duda sobre si el bundler de Deno va a resolver una ruta que sale de
  `supabase/functions/`. Funcionó al primer intento con `_shared/`.

## 11. Dudas abiertas (de `contexto.md` §12)

- ~~Contraseña de las 4 cuentas~~ → resuelto: `demo1234`.
- ~~Plan API-Football~~ → etapa 1 usa **planes free** (API-Football free + ESPN + TheSportsDB).
- Divisiones/copas exactas a seguir por país además de la liga principal.
- Fuente y frecuencia real de las correcciones manuales del Excel.
- Falta el Excel `Datos de jugadores y clubes.xlsx` (referenciado en contexto.md §9); `.gitignore`
  lo excluye a propósito.
- ~~Con el plan free de API-Football hay que ver si alcanza~~ → resuelto (parcialmente) 2026-09-05:
  el límite real no es el de 100 req/día sino que `GET /fixtures?date=` solo deja ver ~3 días
  alrededor de "hoy" (ver §4 y §10). `sync-partidos` ya lo tolera (salta el día que rechacen), pero
  esto significa que "próximos partidos" en Fase 1, con este plan, en la práctica no va a poder
  mostrar mucho más allá de esa ventana corta — para un horizonte de semanas hay que subir de plan
  o apoyarse en ESPN como respaldo (todavía sin escribir).
- ¿La preferencia de tema se persiste por usuario (`perfiles`) o solo en `localStorage` del dispositivo?
- Versión de Next: se usó **14.2.x** (contexto.md pide "14+"). Migrar a 15 es opción, no urgencia.
