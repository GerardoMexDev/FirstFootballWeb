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

**Última actualización:** 2026-09-05 (Sesión 3: base de hitos + "Fechas señaladas" + cambio de club automático + `sync-estadisticas`)
**Estado general:** vista `partidos` con partidos reales (`sync-partidos` + `pg_cron`) +
**motor de hitos con la base real cargada** (números de carrera/selección de los 6, corte
2026-08-29 — de Transfermarkt vía Excel). Hoy da 0 hitos porque nadie está en ventana de
aviso (el más cerca: Nahitan a 4 del partido 75 con la selección, aviso 3). **Nuevo:**
"Fechas señaladas" (notas que avisan 7-10 días antes de cumpleaños / aniversarios de club /
aniversario de debut en selección) en calendario y partidos; y **`sync-roster`** (Edge
Function + cron semanal) que detecta cambios de club por `/transfers` y mueve al jugador +
crea el hito de traspaso. Pendiente de Gerardo: las 8 fotos del hero (2 por tipo de
competencia) y la lista de APIs alternativas.

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
| `lib/partidos/utilidades.ts` | `pesoPartido`, `claseTarjeta`, `filtrarPartidos`, `agruparPorDia`, `agruparPorJugador` (reglas puras, sin JSX) | ✅ creado S2 |
| `supabase/migrations/0003_motor_hitos.sql` | Columnas `jugadores.*_base` (manual) + vista `totales_jugador` (base + lo que sume la sync) | ✅ aplicada S2 |
| `supabase/migrations/0004_debut_seleccion_agenda.sql` | `jugadores.debut_seleccion` + `agenda_anual` con bloque `aniversario_seleccion` | ✅ aplicada S3 |
| `supabase/migrations/0005_cron_sync_roster.sql` | `recurso_sync` += `roster` + `pg_cron` semanal para `sync-roster` | ✅ aplicada S3 |
| `supabase/migrations/0006_cron_sync_estadisticas.sql` | `pg_cron` diario 05:00 UTC para `sync-estadisticas` | ✅ aplicada S3 |
| `supabase/functions/_shared/estadisticas.ts` (+ `.test.ts`) | Extracción pura de la línea de un jugador de `/fixtures/players` (7 tests) | ✅ creado S3 |
| `supabase/functions/sync-estadisticas/index.ts` | Edge Function: stats por partido → `estadisticas_partido` + `convocado`. **Desplegada + cron** | ✅ S3 |
| `scripts/seed-base-hitos.mjs` | Carga `jugadores.*_base` + `debut_seleccion` del Excel (corte 2026-08-29). `npm run seed:base-hitos` | ✅ creado y corrido S3 |
| `scripts/seed-datos-manuales.mjs` | Carga 6 cumpleaños + 6 fundaciones del Excel (interino del importador del .xlsx). `npm run seed:datos-manuales` | ✅ creado y corrido S3 |
| `scripts/consultar-traspasos.mjs` | Spike de solo lectura: `/transfers` + `/players/squads` + `/players/profiles` en el plan free | ✅ creado S3 |
| `scripts/desplegar-funcion.mjs` | Wrapper del CLI de Supabase para deployar una Edge Function sin Docker. `npm run deploy:funcion -- <n>` | ✅ creado S3 |
| `lib/agenda/notas-proximas.ts` (+ `.test.ts`) | "Fechas señaladas" — puro, ventana 10/7 días, 8 tests `node --test` | ✅ creado S3 |
| `lib/repositorios/repositorio-agenda.ts` | Lee `agenda_anual` filtrado a las 3 fuentes de fecha fija + ventana | ✅ creado S3 |
| `components/agenda/NotasAgenda.tsx` | Sección "Fechas señaladas" (clases `.sec`/`.hito` de la demo). En calendario y partidos | ✅ creado S3 |
| `supabase/functions/_shared/roster.ts` (+ `.test.ts`) | Detección pura de cambio de club (solo `/transfers` + guardas), 9 tests | ✅ creado S3 |
| `supabase/functions/sync-roster/index.ts` | Edge Function: cambio de club → mueve jugador + hito `traspaso`. **Desplegada + cron semanal** | ✅ S3 |
| `lib/motor-hitos/{tipos,index}.ts` | Cálculo puro de hitos (`calcularHitos`, `ordenarHitos`, `partidosConHito`) — mismo criterio que `ESCALAS`/`hitosDe()` de la demo | ✅ creado y probado S2 |
| `lib/repositorios/repositorio-hitos.ts` | `RepositorioHitosSupabase`: trae `escalas_hito` + `totales_jugador` + jugadores activos | ✅ creado S2 |
| `components/partidos/SeccionHitos.tsx` | "Se vienen los hitos" — no se renderiza si no hay ninguno (igual que la demo) | ✅ creado S2 |
| `components/partidos/{HeroPartidoDelDia,TarjetasKpi,BarraFiltros,SeccionPartidos,ListaPartidos,TarjetaPartido}.tsx` | Vista `partidos` completa sobre datos reales, con el motor de hitos ya conectado (tag "Hito", desempate del hero, filtro "Con hito" habilitado) | ✅ creados/actualizados S2 |
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
| `scripts/importar-datos-manuales.ts` | Importador del .xlsx con diff. El archivo ya llegó (S3); por ahora se usa `seed-datos-manuales.mjs` (valores fijos) | ⬜ (interino cubierto) |
| `components/{calendario,jugadores,paneles}/*` | Grilla mensual del calendario, fichas de jugador, paneles laterales — con datos | ⬜ |

## 4. Hecho (por fecha, más reciente primero)

### 2026-09-05 — Sesión 3 (cont.: fotos del hero cableadas)

- Gerardo pasó 8 fotos (Unsplash). Procesadas con ffmpeg a WebP 1920×1080 (recorte 16:9
  anclado arriba, leve bajada de exposición), 2 por tipo de competencia, en `public/heroes/`
  (`{liga|copa|continental|seleccion}-{1,2}.webp`). Ver `public/heroes/LEEME.md`.
- **`lib/partidos/hero-imagen.ts`** (puro, 4 tests): `imagenHero(competenciaTipo, partidoId)`
  → `/heroes/{tipo}-{1|2}.webp`, variante estable por hash del id; `null` si el tipo es
  desconocido.
- **`HeroPartidoDelDia.tsx`**: renderiza `<img className="hero__bg">` — **clase que la demo
  YA estilizaba** (`grayscale(1) brightness(.46)` + `.hero__grad`), cero CSS nuevo. Al ir en
  grises y oscurecida, cualquier estadio identificable queda genérico y el texto blanco se
  lee. Sin tipo → queda el degradé `.hero__fb` (como antes).
- Verificado con browser-automation: el hero de "RB Bragantino vs Bahia" (Serie A → `liga`)
  carga `/heroes/liga-2.webp` (1920×1080), filtro de la demo aplicado, texto legible, 0
  errores de consola.

### 2026-09-05 — Sesión 3 (cont.: `sync-estadisticas` — stats por partido automáticas)

- **Spike**: `GET /fixtures/players?fixture=` y `GET /fixtures?id=` **funcionan en el plan
  free** (verificado con un fixture finalizado real). Con eso las stats semana a semana se
  automatizan **sin pagar** — el Excel semanal deja de hacer falta (solo un refresco raro de
  la base histórica).
- **`_shared/estadisticas.ts`** — `extraerLineaJugador(respuesta, idExterno)` puro, **7 tests**.
  Convención de NULL de API-Football en ese endpoint: si el jugador **tiene línea**, `null` en
  goles/asistencias/tarjetas = **0** (jugó y no sumó); `minutos`/`valoracion` en `null` sí son
  "sin dato". Suplente no usado (minutos 0/null) → se marca `convocado` pero **no** se crea
  fila de estadística (si no, contaría un partido no jugado en `totales_jugador`).
- **`sync-estadisticas/index.ts`** (Edge Function + cron diario 05:00 UTC, migración `0006`):
  candidatos = `partidos_jugadores.convocado IS NULL` con el partido ya empezado y dentro de
  15 días; hasta 8 por corrida. Por candidato: `/fixtures?id=` (corrige `partidos.estado` +
  marcador si `sync-partidos` ya no lo veía) y, si terminó, `/fixtures/players` → upsert en
  `estadisticas_partido` + `partidos_jugadores.convocado` (true si figuró, false si no).
  Alimenta `totales_jugador` → **el motor de hitos se actualiza solo**.
- **Alcance Fase 1**: solo suma a **carrera** (fixtures de club, `con_seleccion=false`). Las
  stats de selección siguen de la base hasta que haya un sync de partidos de selección.
- **`sync-partidos` ajustado**: el upsert de `partidos_jugadores` pasa a `ignoreDuplicates`
  para no pisar `convocado` en cada corrida diaria (lo escribe `sync-estadisticas`).
- **Verificado end-to-end** (deploy real + curl): con un fixture finalizado real (1519477) y
  Nacho Sosa prestando su `id_externo` a un jugador que jugó ahí → `estadisticas_partido`
  cargada (34', 1 gol, rating 8.2), `partido.estado` `programado`→`finalizado` con marcador
  1:1, `convocado`→true, y **`totales_jugador` de Nacho pj 152→153 / g 4→5** (base + lo
  sincronizado). 2ª corrida no duplica. Todo restaurado (id_externo, partido test borrado).

### 2026-09-05 — Sesión 3 (base de hitos + "Fechas señaladas" + cambio de club automático)

- **Excel actualizado por Gerardo** (`FirstUY/Datos de jugadores y clubes.xlsx`, fuera del
  repo por `.gitignore`): hoja "Hitos" con estadísticas de carrera / selección / temporada
  actual de los 6 (fuente **Transfermarkt**, corte **2026-08-29**, próxima 2026-09-05); hoja
  "Hoja2" con 7 APIs candidatas (Transfermarkt, footballdata.io, TheSportsDB, FBref,
  thestatsapi, ESPN unofficial, Yahoo unofficial). Evaluación en §11.
- **`scripts/seed-base-hitos.mjs`** (`npm run seed:base-hitos`): carga `jugadores.*_base`
  (carrera pj/g/a + selección pj/g) y `debut_seleccion` desde esos números. Corte en
  `base_actualizada_en = 2026-08-29`: `sync-estadisticas` (cuando exista) solo debe sumar
  partidos posteriores para no doble-contar. Verificado: `totales_jugador` propaga bien, y
  el motor da **0 hitos hoy** (confirmado replicando la fórmula de `lib/motor-hitos`).
- **`scripts/seed-datos-manuales.mjs`** (`npm run seed:datos-manuales`): carga los 6
  cumpleaños (`jugadores.fecha_nacimiento`) y las 6 fundaciones de club
  (`clubes.fecha_fundacion`) de la hoja 1 del Excel (valores fijos, ya confirmados en
  contexto.md §9). Interino hasta que exista el importador del .xlsx.
- **Migración `0004`**: `jugadores.debut_seleccion date` (distinta de `debut`, que queda
  para el debut profesional) + `agenda_anual` gana el bloque **`aniversario_seleccion`**
  (proyección anual, mismo patrón que cumpleaños/aniversario_club). `create or replace view`
  (no cambia columnas). Cargados: Nahitan 2015-09-18, Kevin Amaro 2025-09-09.
- **"Fechas señaladas"** — avisa con **10 días** de anticipación y marca `urgente` a **≤7**
  ("entre 10 y 7", pedido de Gerardo). Va en **calendario y partidos** (para que los
  diseñadores preparen el arte).
  - `lib/agenda/notas-proximas.ts` — puro y determinista (recibe eventos + hoy en UY), con
    test `node --test` (`npm test`, 8 casos). `DIAS_AVISO_AGENDA=10`, `DIAS_AVISO_URGENTE=7`.
  - `lib/repositorios/repositorio-agenda.ts` — lee `agenda_anual` filtrando a las 3 fuentes
    de fecha fija y a la ventana.
  - `components/agenda/NotasAgenda.tsx` — reusa `.sec`/`.hito`/`.hito--ya` de la demo (mismo
    look que "Se vienen los hitos"). No se renderiza si no hay ninguna.
  - Verificado con `browser-automation` (login real como `alexis`): la sección aparece en
    ambas vistas con la tarjeta de Kevin Amaro (debut selección, "Faltan 4 días", urgente),
    0 errores de consola.
- **Cambio de club automático — `sync-roster`** (Edge Function nueva + cron semanal):
  - **Spike previo** (`scripts/consultar-traspasos.mjs`): `GET /transfers?player=` y
    `GET /players/squads?player=` **funcionan en el plan free**; `GET /players/profiles` no
    trae el club en free. → API-Football alcanza, no hace falta Transfermarkt para esto.
  - **Solo `/transfers`** (no `/players/squads`): en ventana de partidos de estrellas,
    `/players/squads` devolvió "Liga MX All-Stars" como club de Fede Pereira — falso
    positivo real, detectado al probar. Un all-star no genera un "transfer".
  - `_shared/roster.ts` (puro, 9 tests): auto-aplica solo si el traspaso más reciente es
    **reciente** (≤200 días) y el destino **no parece representativo** (`/all-stars?|selecci|
    xi/i`). Lo demás → `revisar` (se registra en `sincronizaciones.parametros.sospechas`,
    **no toca el dato**). Nunca deja `club_actual_id` en NULL.
  - `sync-roster/index.ts`: por cada jugador activo, `/transfers` → si aplica: upsert del
    club nuevo + `update jugadores.club_actual_id` + upsert `hito` tipo `traspaso`
    (`origen='derivado'`, idempotente por la clave natural). `proximos_partidos` resuelve el
    club desde el jugador, así que los fixtures lo siguen solos.
  - Migración `0005`: `recurso_sync` += `'roster'` (para la bitácora) + `cron.schedule`
    `sync-roster-semanal` lunes 04:00 UTC (después del sync diario), `timeout 120000`.
  - `scripts/desplegar-funcion.mjs` (`npm run deploy:funcion -- <nombre>`) — wrapper del CLI
    de Supabase para deployar con `--no-verify-jwt` sin Docker.
  - **Verificado de punta a punta** (deploy real + curl con `x-sync-secret`): baseline = 0
    cambios / 0 falsos positivos; desviar a Kevin Amaro a Toluca → corrige a Genk + crea
    "Fichaje a Genk (desde Liverpool Montevideo)" fechado 2026-08-17; 2ª corrida no duplica
    el hito. Datos restaurados (los 6 en su club, 0 hitos).
  - **Sospechas conocidas** (no es bug, ver §6): API-Football no tiene el traspaso reciente
    de Nacho / Javi / Martín a Bragantino/Colo-Colo/Atlante — su último `/transfers` apunta
    a un club uruguayo viejo. `sync-roster` los flaggea `revisar` cada semana sin tocar nada.

### 2026-09-05 — Sesión 2 (cont.: motor de hitos — esqueleto completo, esperando números base)
- Gerardo decidió: **espera su lista de ~20 APIs candidatas** (algunas no cubren las ligas de
  la cartera, pero puede haber alguna útil, ESPN como candidato natural) antes de considerar
  subir de plan en API-Football por la ventana corta de fechas (ver entrada anterior). No se
  toca nada de la sync hasta entonces.
- **Migración `0003_motor_hitos.sql`**: 5 columnas nuevas en `jugadores`
  (`carrera_partidos_base`, `carrera_goles_base`, `carrera_asistencias_base`,
  `seleccion_partidos_base`, `seleccion_goles_base`, todas NULL-ables + `check >= 0`) y la
  vista `totales_jugador` (base + lo que sume `estadisticas_partido`, agrupado por
  `partidos_jugadores.con_seleccion` para separar carrera de selección). Con NULL en la base,
  la suma da NULL sola — no hace falta lógica aparte para "sin datos".
- **`lib/motor-hitos/{tipos,index}.ts`**: `calcularHitos()` reproduce `hitosDe()`/`ESCALAS` de
  la demo — para cada jugador y cada escala activa, si hay base cargada calcula el próximo
  número redondo (`Math.ceil((v+1)/paso)*paso`) y si falta poco (`<= aviso`) genera el hito;
  para `pj`+`carrera` además intenta ubicarlo en un partido futuro concreto (el que está en la
  posición `falta-1` de los próximos partidos de ese jugador, asumiendo que juega todos).
  `ordenarHitos()` prioriza los que tienen partido conocido; `partidosConHito()` da el
  `Set<partidoId>` que usan la tarjeta y el hero.
- **`lib/repositorios/repositorio-hitos.ts`**: mismo fix de tipado que ya se vio con
  `perfiles` (`.returns<T[]>()` — esta combinación de versiones infiere `never` si no).
- **UI conectada**: `SeccionHitos` (nueva, no se renderiza si no hay hitos — igual que la
  demo), KPI "Hitos por alcanzar" de vuelta (con el conteo real, no un relleno), tag "Hito"
  en `TarjetaPartido`, el hero ahora desempata primero por hito y después por peso (como la
  demo), y el chip "Con hito" de `BarraFiltros` ya filtra de verdad (antes estaba
  deshabilitado).
- **Sin `dangerouslySetInnerHTML`**: la demo arma el contexto del hito con HTML crudo
  interpolando nombres de club — como esos nombres vienen de la API (dato externo), se
  reescribió con JSX normal (checklist de seguridad: nada de HTML crudo con datos que no son
  nuestros).
- **Verificado con un valor de prueba** (no quedó cargado): `carrera_partidos_base = 247`
  para Nahitan → la vista dio `carrera_partidos: 247` correcto → la UI mostró el hito
  ("Partido 250", faltan 3, resaltado en acento porque es inminente), el KPI pasó a 1, y se
  restauró a `NULL` al terminar. `npm run build` OK antes y después.

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
- [x] ~~`lib/motor-hitos` + sección "se vienen los hitos" + KPI + tag + tie-break del hero~~ —
      hecho 2026-09-05 (Sesión 2). **Base real cargada 2026-09-05 (Sesión 3)** con
      `seed-base-hitos.mjs` (corte 2026-08-29). Da 0 hitos hoy (nadie en ventana). Se
      refresca con el Excel del 5-sep (volver a correr el script con los números nuevos y
      subir `base_actualizada_en`) y, hacia adelante, con `sync-estadisticas`.
- [ ] **Refrescar la base con el Excel** — ahora **baja prioridad**: con `sync-estadisticas`
      corriendo, los partidos de club se suman solos. La base solo se re-carga de vez en
      cuando para reconciliar (editar `scripts/seed-base-hitos.mjs`, subir `CORTE`, correr).
- [ ] Wirear el click de `TarjetaPartido`/`HeroPartidoDelDia` para abrir el panel de detalle
      (hoy no son clicables — paneles, junto con el resto del panel lateral). — media
- [x] ~~`supabase/functions/sync-partidos`; activar `pg_cron`~~ — hecho 2026-09-04/05 (ver §4):
      desplegada, corriendo con datos reales, cron diario probado de punta a punta.
- [x] ~~`sync-estadisticas`~~ — hecho 2026-09-05 (ver §4). Cron diario, plan free, verificado
      end-to-end. Ojo con el doble-conteo: hoy suma **todo partido en la ventana de 15 días**,
      no filtra por `base_actualizada_en`. Como la base es del 2026-08-29 y los partidos que
      procesa son de esta semana, no hay solape real — pero si alguna vez se re-carga la base
      con un corte más nuevo, hay que limpiar `estadisticas_partido` anteriores a ese corte o
      agregar el filtro. — vigilar
- [ ] `sync-agenda` — ya NO hace falta para cumpleaños/fundaciones/aniversario-selección
      (esos son manuales, cargados, y `agenda_anual` los proyecta). Quedaría solo para hitos
      derivados que no cubra ni el motor de hitos ni `sync-roster`. — baja
- [ ] **Reconciliación Transfermarkt** (opción D de la charla de Sesión 3): script/servicio
      periódico contra `felipeall/transfermarkt-api` (self-host o instancia pública) para
      refrescar totales de carrera/selección y tapar lo que API-Football no cubre. Su
      `/players/{id}/transfers` además tiene el historial completo que a API-Football le
      falta para Nacho/Javi/Martín (ver §6). — media
- [ ] `estado='parcial'`/`'error'` de `sincronizaciones` no dispara ningún aviso visible todavía
      en la UI (contexto.md: badge "Datos actualizados el {fecha}. No pudimos contactar la
      fuente."). Por ahora solo queda en la bitácora de la tabla. — media
- [ ] Revisar cada tanto si el plan free amplía la ventana de fechas de `GET /fixtures?date=`
      (hoy ~3 días) — afecta cuánto por delante puede ver "próximos partidos". — baja
- [x] ~~lista de APIs alternativas~~ — Gerardo pasó 7 (hoja 2 del Excel), evaluadas en
      Sesión 3 (ver §11). Conclusión: nada reemplaza a API-Football como primaria; lo que
      suma es **Transfermarkt** (totales de carrera en todas las ligas, Arabia incluida) y
      confirmar **ESPN + TheSportsDB** como cascada de respaldo (ya en el plan).
- [x] ~~Fotos del hero de partidos~~ — hecho 2026-09-05 (Sesión 3): 8 WebP en
      `public/heroes/`, `lib/partidos/hero-imagen.ts` las elige por `competenciaTipo`,
      `HeroPartidoDelDia` las muestra en `.hero__bg` (estilo de la demo, cero CSS nuevo).
      Los `.jpg` originales no se versionan; recambiar una = poner el original y avisar.
      Opción C (escudo difuminado) sigue pendiente para cuando haya escudos de TheSportsDB.
- [ ] **Estadio sin nombre** (caso Brasil): agregar `clubes.estadio` + `clubes.ciudad`,
      enriquecer una vez desde `GET /teams` (`venue.name`), usar como fallback cuando
      `partidos.estadio` es NULL y nuestro club juega de local. Visitante → "Sin datos". — media
- [x] ~~(a) cargar los torneos que faltan~~ — hecho 2026-09-05 (Sesión 3): `competencias`
      pasa a 19. Nuevas: Leagues Cup (772), CONCACAF Champions League (16), Saudi Super Cup
      (826), Beker van België (147). Lista por país confirmada con Gerardo (ver cabecera de
      `seed-competencias.mjs`). ⚠️ **Beker van België: API-Football no da ni fixture en el
      plan free** → los partidos de copa de Genk no llegan solos (ESPN o manual).
- [ ] **Torneos adicionales — lo que queda**: (b) `sync-partidos` que loguee "competencia
      desconocida X" cuando el `league.id` no matchea ninguna de `competencias` (hoy queda
      `competencia_id` NULL en silencio). (c) calendario/partidos agrupan/colorean por
      `competencia.tipo`. — media
- [ ] **Partido aplazado/cancelado sin fecha**: separar `aplazado`/`cancelado` en el enum
      `estado_partido` (hoy `PST`→`suspendido`, `CANC`→`sin_datos`), mapear bien en
      `_shared/estado-partido.ts`, y mostrarlo explícito en la UI ("Aplazado — sin nueva
      fecha") en vez de que el partido desaparezca. Caso real: Toluca vs Puebla se canceló
      (Toluca juega la final de Leagues Cup). La ventana de re-chequeo se deja como la
      permita el plan (~3 días) hasta que entre el pago. — media
- [ ] **Convocado sí/no al partido** (charla Sesión 3, opciones A+C): A = `GET /fixtures/lineups`
      post-hoc (XI+banco, ~40 min antes; estructurado, gratis). C = noticias (Google News
      RSS) parseadas por LLM como señal suave "según prensa", etiquetada aparte. Necesita
      esquema: `partidos_jugadores.convocatoria_origen` + nota + fuente, o tabla
      `senales_convocatoria`. — media
- [ ] Confirmar si Al-Qadsiah juega la AFC Champions League **Elite** o **Two** esta temporada
      (se cargaron las dos — la que no aplique no va a tener partidos, la sync lo resuelve
      solo). Gerardo confirmó que los clubes saudíes juegan la AFC, no la UEFA. — baja
- [x] ~~Copa de Bélgica~~ — cargada 2026-09-05 (`Beker van België`, id 147, `cobertura=false`).
      ⚠️ API-Football **no da ni el fixture** en el plan free: los partidos de copa de Genk no
      llegan solos, harían falta ESPN o carga manual.
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

- **`sync-roster` flaggea `revisar` a Nacho / Javi / Martín cada semana** (no toca datos):
  API-Football no tiene su traspaso reciente a Bragantino / Colo-Colo / Atlante — su último
  `/transfers` apunta a Peñarol / Boston River (viejo). La guarda de reciencia (200 días)
  hace bien en no auto-aplicarlo, pero lo reporta en `sincronizaciones.parametros.sospechas`.
  Se resuelve solo cuando API-Football sume esos traspasos, o con la reconciliación
  Transfermarkt (§5), o suprimiéndolos a mano si molesta. Revisar la primera bitácora y
  decidir.
- **Migraciones `0004`/`0005` aplicadas directo con `scripts/aplicar-migracion.mjs`** (como
  `0001`-`0003`), no con el CLI de Supabase — mismo apunte de abajo si algún día se adopta
  `supabase db push`.
- **`partidos_jugadores` no tiene columna `id`** — la PK es compuesta `(partido_id, jugador_id)`.
  Cualquier `.update()` sobre esa tabla se filtra por las dos columnas, no por un `id`.
- **`estadisticas_partido` hoy no filtra por `base_actualizada_en`**: procesa todo partido en
  la ventana de 15 días. No hay solape hoy (la base es del 28-ago y los partidos son de esta
  semana), pero si se re-carga la base con un corte más nuevo, `seed-base-hitos.mjs` tendría
  que borrar las filas de `estadisticas_partido` anteriores al nuevo corte.
- **`sync-roster` NO reasigna `partidos_jugadores` viejos** cuando un jugador cambia de club:
  los partidos que ya estaban puenteados quedan como estaban (correcto — jugó ese partido
  con el club anterior). Solo los fixtures futuros salen con el club nuevo (vía la vista).
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
- **NULL se propaga solo en una vista agregada de Postgres**: `totales_jugador` suma la base
  manual (que puede ser NULL) con lo que ya sincronizó — `null + count(...)` da `null`, sin
  escribir un `case when` para cada columna. Mismo principio de "cero invenciones" que ya
  aplicaba `mostrar()` en el frontend, pero resuelto en la base: si no se cargó el dato, ni
  siquiera hay que acordarse de chequearlo del lado de la app.
- **`dangerouslySetInnerHTML` con datos que vienen de una API es justo lo que el checklist de
  seguridad prohíbe** (contexto.md/arquitectura-fase1.html: nada de HTML crudo con datos que no
  son nuestros) — la demo arma el contexto de un hito interpolando nombre de club dentro de un
  template string con `<b>`/`<br>`; al pasar a React eso se resuelve con JSX normal (un
  componente que devuelve fragmentos), no copiando el patrón de la demo literal.
- **`GET /transfers` y `GET /players/squads` SÍ funcionan en el plan free de API-Football**
  (spike Sesión 3, `scripts/consultar-traspasos.mjs`). `GET /players/profiles` responde pero
  **sin el club actual** en free (solo nombre + nacimiento).
- **`GET /players/squads?player=` mete equipos representativos como si fueran el club**: en la
  ventana de partidos de estrellas devolvió "Liga MX All-Stars" para Fede Pereira. Falso
  positivo real, detectado al probar `sync-roster`. Por eso la detección de cambio de club usa
  **solo `/transfers`** (un all-star no genera un "transfer") + guarda por patrón de nombre
  (`/all-stars?|selecci|xi/i`) + guarda de reciencia del traspaso.
- **API-Football tiene el historial de `/transfers` incompleto para varios de la cartera**:
  no registra el paso de Nacho/Javi/Martín a su club actual (su último traspaso listado es a
  un club uruguayo, años atrás). Cualquier lógica sobre `/transfers` tiene que tolerar que el
  "último" movimiento sea viejo y no signifique nada — nunca reescribir el club por un
  traspaso fuera de ventana.
- **`node --test` corre archivos `.ts` directo** (Node 22.6+, type-stripping) — no hace falta
  vitest/jest. `npm test` = `node --test "lib/**/*.test.ts" "supabase/functions/**/*.test.ts"`.
  Warning `MODULE_TYPELESS_PACKAGE_JSON` es ruido (no se agregó `"type":"module"` para no
  tocar el resto). Para que sea testeable así, el módulo puro no importa con alias `@/` ni
  nada Deno-only — solo `luxon` o cero deps.
- **`create or replace view` sirve si NO cambian las columnas** (solo agregás filas por
  `UNION`) — conserva permisos/RLS de la vista, no hace falta `drop`. Migración `0004` recreó
  `agenda_anual` así.
- **`ALTER TYPE ... ADD VALUE` va suelto, fuera del `begin/commit`** del resto de la
  migración (PG lo permite en transacción en PG12+ pero es más limpio así). `add value if not
  exists` para que sea idempotente. Migración `0005` agregó `'roster'` a `recurso_sync`.
- **Los "0" de selección de Fede/Nacho/Javi/Martín se cargan como 0, no NULL**: son un dato
  real de Transfermarkt (0 partidos con la mayor), no un relleno por defecto. La regla "cero
  invenciones" es para cuando la fuente calla, no para cuando dice 0.
- **Diferencia de días entre dos fechas civiles (YYYY-MM-DD) NO es la "aritmética sobre
  `new Date()`" prohibida** (esa regla es para convertir instantes entre zonas). Anclás las
  dos a medianoche UTC y restás — exacto, sin DST en juego. `lib/agenda/notas-proximas.ts` y
  `_shared/roster.ts` lo hacen con un comentario que lo aclara.
- **`/fixtures/players?fixture=` y `/fixtures?id=` funcionan en el plan free** — por eso
  `sync-estadisticas` puede correr sin pagar. `/fixtures?id=` además sirve para re-chequear
  el estado de un fixture que ya se salió de la ventana corta de `/fixtures?date=`.
- **API-Football, en `/fixtures/players`, codifica "0" como `null`** en goles/asistencias/
  tarjetas: si el jugador tiene línea de stats, ese `null` es un 0 real (no "sin dato"). Pero
  `minutes`/`rating` en `null` sí son ausencia. `_shared/estadisticas.ts` distingue los dos.
- **Un error de PostgREST no es `instanceof Error`** — es un objeto plano `{message, code, …}`.
  En un `catch`, `String(e)` da `"[object Object]"`; hay que `JSON.stringify(e)` (y
  `console.error(e)` para que quede en los logs de la función).

## 11. Dudas abiertas (de `contexto.md` §12)

- ~~Contraseña de las 4 cuentas~~ → resuelto: `demo1234`.
- ~~Plan API-Football~~ → etapa 1 usa **planes free** (API-Football free + ESPN + TheSportsDB).
- ~~Divisiones/copas exactas a seguir por país~~ → resuelto 2026-09-05 (Gerardo): México =
  Liga MX + Leagues Cup + Concachampions; Chile = liga + Copa Chile + Libertadores +
  Sudamericana; Bélgica = liga + copa belga; Arabia = Roshn Saudi League + King's Cup +
  Supercopa + AFC (no UEFA); Brasil = Serie A + Copa do Brasil + Libertadores + Sudamericana.
  Las 19 cargadas en `competencias`.
- ~~Fuente y frecuencia real de las correcciones manuales del Excel~~ → Transfermarkt,
  **semanal** (Gerardo actualiza el .xlsx; corte movible en `base_actualizada_en`).
- ~~Falta el Excel~~ → lo pasó Gerardo 2026-09-05 (`FirstUY/Datos de jugadores y clubes.xlsx`,
  fuera del repo por `.gitignore`). Hoja 1 = cumpleaños/fundaciones; hoja "Hitos" =
  estadísticas; hoja 2 = APIs candidatas.
- **Evaluación de las 7 APIs de la hoja 2** (Sesión 3): API-Football sigue siendo la
  primaria. Transfermarkt (vía `felipeall/transfermarkt-api`, self-host) es el mejor
  complemento — totales de carrera en todas las ligas (Arabia incluida) e historial de
  traspasos completo. TheSportsDB = enriquecimiento (escudos/fotos). ESPN unofficial =
  respaldo de fixtures. footballdata.io / thestatsapi / Yahoo = descartables para nuestro
  caso (poca stat por jugador en nuestras ligas). FBref = lo mejor gratis por-stat pero
  frágil (scraping, sin API) y flojo en Arabia — "para más adelante".
- ~~Con el plan free de API-Football hay que ver si alcanza~~ → resuelto (parcialmente) 2026-09-05:
  el límite real no es el de 100 req/día sino que `GET /fixtures?date=` solo deja ver ~3 días
  alrededor de "hoy" (ver §4 y §10). `sync-partidos` ya lo tolera (salta el día que rechacen), pero
  esto significa que "próximos partidos" en Fase 1, con este plan, en la práctica no va a poder
  mostrar mucho más allá de esa ventana corta — para un horizonte de semanas hay que subir de plan
  o apoyarse en ESPN como respaldo (todavía sin escribir).
- ¿La preferencia de tema se persiste por usuario (`perfiles`) o solo en `localStorage` del dispositivo?
- Versión de Next: se usó **14.2.x** (contexto.md pide "14+"). Migrar a 15 es opción, no urgencia.
