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

**Última actualización:** 2026-09-03 (Sesión 1)
**Estado general:** andamiaje listo — Next.js compila y corre, migración `0001` escrita
(sin ejecutar aún: falta el proyecto Supabase). Sin lógica de datos todavía.

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
| `supabase/migrations/0001_esquema_inicial.sql` | Enums + 11 tablas dominio + CRM F2 (solo estructura) + RLS + vistas `proximos_partidos` / `agenda_anual` + seed `escalas_hito` + jobs `pg_cron` comentados | ✅ escrito S1 — ⚠️ sin ejecutar |
| `app/layout.tsx` | HTML/body, CSS, fuentes por `<link>`, `<symbol id="ff">` | ✅ |
| `app/(app)/layout.tsx` | Shell `.app on` + `BarraSuperior` + overlays (velo/panel/toast) | ✅ |
| `app/(app)/{partidos,calendario,jugadores}/page.tsx` + `jugadores/[jugadorId]` | Vistas: esqueleto con clases de la demo + `EstadoSinDatos` | ✅ |
| `app/(auth)/login/page.tsx` | Marcado `.login` de la demo, form deshabilitado | ✅ |
| `app/page.tsx` | Redirige `/` → `/partidos` | ✅ |
| `lib/fechas/zonas.ts` | `ZONA_AGENCIA`, `aInstanteUtc`, `horaEnUruguay`, `horaEnSede`, `diaEnUruguay`, `ZONAS_CARTERA` | ✅ |
| `lib/formato/valores.ts` | `mostrar(v) => v ?? 'Sin datos'`, `SIN_DATOS`, `esVacio` | ✅ |
| `lib/supabase/{cliente-navegador,cliente-servidor}.ts` | Clientes `@supabase/ssr` (anon key) | ✅ |
| `lib/repositorios/tipos.ts` | Interfaz `RepositorioPartidos` + tipo `PartidoProximo` (patrón repositorio) | ✅ stub |
| `components/comunes/Ico.tsx` · `EstadoSinDatos.tsx` | Íconos (paths de la demo) · componente `.sinDato` | ✅ |
| `components/layout/BarraSuperior.tsx` · `Nav.tsx` | Barra superior + nav (marca y nav funcionan; buscador/tema/menú stub) | ✅ |
| `lib/supabase/tipos-db.ts` | Tipos generados de la BD | ⬜ tras crear Supabase + `npm run tipos:db` |
| `supabase/functions/sync-*` | Edge Functions de sincronización | ⬜ |
| `scripts/` | `seed-usuarios.ts`, `importar-datos-manuales.ts` | ⬜ |
| `lib/motor-hitos/`, `components/{partidos,calendario,jugadores,paneles}/*` | Lógica y componentes con datos | ⬜ |

## 4. Hecho (por fecha, más reciente primero)

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

## 5. Pendiente / próximos pasos

- [ ] **Ejecutar y validar la migración `0001`** al crear el proyecto Supabase (dry-run: revisar
      `security_invoker`, `unique nulls not distinct` (PG15+), y las 2 vistas). — prioridad: alta
- [ ] Crear proyecto Supabase, completar `.env.local`, `npm run tipos:db` → `lib/supabase/tipos-db.ts`. — alta
- [ ] Sesión **auth**: middleware de sesión, `signInWithPassword`, guard en `(app)/layout.tsx`,
      cablear form de login (nombre + `@footballfirst.uy`), menú de usuario y "cerrar sesión". — alta
- [ ] `scripts/seed-usuarios.ts` (4 cuentas, `service_role`) — necesita la contraseña confirmada. — alta
- [ ] Confirmar contra `GET /leagues` los IDs de ligas/copas/continentales; cargar `competencias`
      con su `cobertura`. — media
- [ ] Conectar vista `partidos` a `proximos_partidos` (repositorio + componentes reales:
      `HeroPartidoDelDia`, `TarjetasKpi`, `ListaPartidos`, `TarjetaPartido`). — media
- [ ] `lib/motor-hitos` leyendo `escalas_hito`; sección "se vienen los hitos" + badges. — media
- [ ] `supabase/functions/sync-partidos` (+ `sync-estadisticas`, `sync-agenda`); activar `pg_cron`. — media
- [ ] Cablear buscador ⌘K, toggle de tema (persistir), paneles laterales. — media
- [ ] `scripts/importar-datos-manuales.ts` (Excel — falta el archivo en el repo). — media
- [ ] Vista `calendario` (`DensidadAnual`, `GrillaMes`) contra `agenda_anual`. — baja
- [ ] Tests de zona horaria en fines de semana de cambio de hora. — media

## 6. Bugs conocidos / cosas a vigilar

- **Migración `0001` sin ejecutar.** Verificar al aplicarla contra Postgres real:
  `create view ... with (security_invoker = true)` y `unique nulls not distinct` requieren
  **PG15+** (Supabase nuevo = PG15/17, OK). La proyección de cumpleaños/aniversarios en
  `agenda_anual` usa una ventana de años [-1, +2]; si el calendario navega más lejos, ampliar.
- **`.gitignore` ignora `*.xlsx`** (el Excel de datos manuales no se versiona). Si en algún
  momento se quiere versionar un ejemplo anonimizado, ajustar la regla.
- Tests de zona horaria en los fines de semana de cambio de hora (marzo/octubre Europa,
  marzo/noviembre Norteamérica) — la hora en Uruguay no debe desfasarse.
- El warning `no-page-custom-font` en `app/layout.tsx` está silenciado a propósito (fuentes por
  `<link>` para no tocar los tokens de la demo).

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
- Proyecto Supabase: **sin crear todavía**. URL + anon key + service_role irán en `.env` local y en
  variables de entorno de Vercel / Edge Functions — nunca en el repo.
- API key de API-Football: irá en variable de entorno de la Edge Function. Nunca en el repo ni en el cliente.
- Contraseña de las 4 cuentas demo: propuesta `demo1234` (Supabase Auth exige mínimo 6; `demo` no cumple).
  Pendiente de confirmar con Gerardo. Compartida SOLO para demo cerrado.

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
- Zonas IANA de la cartera: `Asia/Riyadh`, `Europe/Brussels`, `America/Mexico_City`, `America/Sao_Paulo`,
  `America/Santiago`, `America/Montevideo`.
- Registro público de Auth deshabilitado. Confirmación de email desactivada. Login acepta el nombre y la app
  le agrega el dominio `@footballfirst.uy`.
- Huecos conocidos donde se muestra "Sin datos" (nunca inventar): pre-listas de convocatoria, juveniles/reservas,
  rendimiento individual en copas poco cubiertas y Liga de Expansión MX, lesiones con detalle.

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
- El `<section class="vista on">` de cada page lleva `on` porque en Next cada ruta renderiza su
  propia vista (en la demo era un tab-switch con una sola `.vista.on` a la vez).

## 11. Dudas abiertas (de `contexto.md` §12)

- Contraseña definitiva de las 4 cuentas demo (`demo1234` propuesto).
- Divisiones/copas exactas a seguir por país además de la liga principal.
- Fuente y frecuencia real de las correcciones manuales del Excel.
- Plan final de API-Football (Pro ~USD 19 vs. Ultra ~USD 29).
- Falta el Excel `Datos de jugadores y clubes.xlsx` (referenciado en contexto.md §9); `.gitignore`
  lo excluye a propósito.
- ¿La preferencia de tema se persiste por usuario (`perfiles`) o solo en `localStorage` del dispositivo?
- Versión de Next: se usó **14.2.x** (contexto.md pide "14+"). Migrar a 15 es opción, no urgencia.
