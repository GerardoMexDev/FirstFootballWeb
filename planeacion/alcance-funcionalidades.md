# Alcance y Funcionalidades — Football First

> Derivado de `planeacion/contexto.md` y `planeacion/demo-fase1.html`. Define qué se construye
> en Fase 1, qué queda para Fase 2 y qué está explícitamente afuera.
> Última edición: 2026-09-03.

---

## 1. Contexto del negocio

- **Cliente:** agencia de representación de futbolistas (Uruguay). Equipo de ~4 personas
  (Diseñador, Community Manager, Administrador, cuenta de Prueba).
- **Problema que resuelve:** hoy la información de los jugadores representados (cuándo juegan,
  a qué hora *de Uruguay*, cómo vienen, qué hito están por alcanzar) está dispersa entre webs
  de ligas, apps y planillas. El equipo produce contenido y necesita **anticipar**, no enterarse
  después. Con 6 jugadores en 6 ligas y hasta 4 husos horarios, calcular "¿a qué hora es acá?"
  a mano es lento y propenso a error.
- **Quién lo usa:** solo el equipo interno de la agencia. No es un producto público, no hay
  clientes finales, no hay registro abierto.

## 2. Objetivo del proyecto

Una sola pantalla de trabajo que responda, sin fricción y en hora de Uruguay:

1. ¿Qué partidos de nuestros jugadores se vienen (hoy / semana / mes / año)?
2. ¿Qué jugador está por llegar a un hito (partido 50, gol 25, cumpleaños, aniversario de club)?
3. ¿Cómo viene cada jugador (trayectoria y estadística de temporada)?

**Éxito Fase 1:** cualquiera del equipo entra, y en < 30 segundos sabe los partidos del día con
su hora de Uruguay y los hitos próximos, **sin preguntarle a nadie y sin abrir otra web**. Los
datos se actualizan solos 1×/día y el sistema avisa cuando una fuente falló en vez de mostrar
información vieja como si fuera fresca.

---

## 3. Funcionalidades — Fase 1 (MVP)

> La UI/UX ya está cerrada en `demo-fase1.html`. El MVP es **conectar esa UI a datos reales de
> Supabase** + auth + sincronización + motor de hitos. No se rediseña nada.

| # | Funcionalidad | Descripción | Prioridad |
|---|---|---|---|
| 1 | **Login interno** | Supabase Auth, registro público deshabilitado, sin confirmación de email. El usuario escribe su nombre (`maxi`, `pedro`, `felipe`, `alexis`) y la app le agrega `@footballfirst.uy`. 4 cuentas creadas por `scripts/seed-usuarios.ts`. Contraseña `demo1234` (a confirmar). Sesión SSR con cookies. | Alta |
| 2 | **Vista `partidos`** | Hero del "partido del día" (0–3 días, prioriza el que tiene hito y las competiciones internacionales), KPIs (partidos hoy / esta semana / hitos por alcanzar / internacionales 30 días / jugadores·ligas), sección "se vienen los hitos" (hasta 8), barra de filtros (Todos / Hoy / Esta semana / Internacional / Con hito) y lista de partidos agrupada por día. Datos desde la vista `proximos_partidos`. | Alta |
| 3 | **Cálculo de hora en Uruguay** | Cada partido muestra su hora en `America/Montevideo` (sin DST) y, si difiere, la hora local de la sede con su zona IANA. Conversión con Luxon a partir de `inicio_utc` + `zona_horaria_evento`. Agrupación por día en zona de Uruguay. Aviso de "fecha tentativa" si `inicio_utc` está a > 90 días. | Alta |
| 4 | **Vista `calendario`** | Densidad anual (12 meses, barra de intensidad por `count(*)` de eventos), navegación de mes, grilla mensual (lunes–domingo) con eventos por celda, leyenda (confirmado / tentativo / internacional). Datos desde `agenda_anual`. Clic en evento → panel de detalle del partido. | Alta |
| 5 | **Vista `jugadores`** | Grilla del plantel (6 jugadores). Cada tarjeta: foto (Storage, con fallback), dorsal, club + escudo genérico, posición + liga, stats de carrera al hacer hover, y pill de hito próximo o país. Clic → ficha completa en panel. | Alta |
| 6 | **Ficha de jugador (panel)** | Hitos por alcanzar, temporada actual (o `EstadoSinDatos` si la liga no tiene cobertura confirmada), carrera, selección (si corresponde), datos para contenido (edad, años en el club, años de carrera, cumpleaños, nacionalidad, Instagram) y próximos 5 partidos. | Alta |
| 7 | **Detalle de partido (panel)** | Competición, duelo con escudos, ronda, local/visitante, horario (UY + local + aviso de diferencia horaria), sede, hitos que caerían en ese partido, y acceso a la ficha del jugador a cubrir. | Alta |
| 8 | **Motor de hitos** | `lib/motor-hitos` lee la tabla `escalas_hito` (métricas `pj`/`g`/`a`, base `carrera`/`seleccion`, `paso`, `aviso`, plantilla de frase) y calcula qué jugador está dentro del rango de aviso de su próximo múltiplo. Hitos de fecha (cumpleaños, aniversario de debut, años en el club) derivados de `jugadores.fecha_nacimiento` / `debut` / `fichaje`. Los hitos de "partido N" se ubican en una fecha concreta cruzando con los próximos partidos del jugador. | Alta |
| 9 | **Sincronización de fixture** | `pg_cron` (03:00 UTC, 1×/día) dispara vía `pg_net` la Edge Function `sync-partidos`, que llama a API-Football por el patrón repositorio (timeout + 3 reintentos con backoff), normaliza al modelo canónico, hace `upsert` idempotente por `(proveedor_externo, id_externo)`, guarda `payload_crudo`, deriva hitos y cierra `sincronizaciones`. Si todo falla: registra `estado='error'`, **no toca los datos existentes**, responde 200. | Alta |
| 10 | **Sincronización de estadísticas** | Edge Function `sync-estadisticas`: 2 h después del final de cada partido + reintento a las 12 h. Todo NULL-able; si la liga no cubre estadística de jugador, no se inventa. | Media |
| 11 | **Sincronización de agenda** | Edge Function `sync-agenda` (1×/día): convocatorias, cumpleaños, fundaciones de club y hitos derivados que alimentan `agenda_anual`. | Media |
| 12 | **Badge "datos actualizados"** | Si `sincronizado_en` está viejo o la última corrida de `sincronizaciones` fue `error`, mostrar "Datos actualizados el {fecha}. No pudimos contactar la fuente." No bloquea la UI. | Media |
| 13 | **Buscador global (⌘K)** | Modal con `⌘/Ctrl+K`. Busca jugador, club, rival, liga, país, estadio, ciudad (normalizando acentos). Resultados agrupados; Enter/clic abre el panel correspondiente. | Media |
| 14 | **Tema claro / oscuro** | Toggle en la barra superior, `data-theme` en `<html>`. Persistir la preferencia del usuario (localStorage; opcional en `perfiles` a futuro). | Media |
| 15 | **Mi cuenta (panel de perfil)** | 3 pestañas: Datos (editar nombre y foto; correo y rol de solo lectura — los cambia un admin), Contraseña (cambio con Supabase Auth, mínimo 8), Notificaciones (3 switches: cerca de un hito / 24 h antes de un partido / resumen semanal — se **guardan**, el envío real de avisos es Fase 2). | Media |
| 16 | **Importación de datos manuales** | `scripts/importar-datos-manuales.ts` lee `Datos de jugadores y clubes.xlsx` (cumpleaños y fundación de club), normaliza nombres contra `competencias` / `GET /leagues`, hace `upsert` idempotente con `origen='manual'` y **muestra el diff antes de escribir**. | Media |
| 17 | **RLS en todas las tablas** | `enable row level security` en todo `public`. Lectura de datos deportivos: cualquier usuario autenticado. Escritura de datos manuales: cualquier usuario autenticado (Fase 1). Datos de Edge Functions: solo `service_role`. `perfiles`: cada quien edita su fila; rol/correo solo admin. | Alta |
| 18 | **Cascada de fuentes** | Repositorio pide a API-Football; si no hay dato, ESPN (no oficial); luego TheSportsDB/Wikidata (enriquecimiento); luego dato manual; si nadie → `EstadoSinDatos`. Interfaz `ProveedorDeportivo` para poder cambiar de proveedor sin tocar esquema ni frontend. | Media |
| 19 | **Configuración de competencias** | Cargar en `competencias` los IDs reales de API-Football (`GET /leagues`) para las 6 ligas + Liga de Expansión MX + copas domésticas + continentales + selección, con su flag `cobertura` (`null` = sin verificar → mostrar "Sin datos"). | Alta |
| 20 | **Deploy** | Frontend en Vercel (capa gratuita), Supabase (capa gratuita), Edge Functions y `pg_cron` configurados. Variables de entorno (Supabase keys, API-Football key) fuera del repo. | Alta |

### Criterio de "terminado" por bloque (cruza con doc 09)

- **Auth:** las 4 cuentas entran, la sesión persiste en recarga, cerrar sesión funciona, no hay
  ninguna ruta accesible sin login.
- **Vistas:** las 3 renderizan con datos reales de Supabase, no con los mocks de la demo. El
  marcado y las clases son idénticos a la demo. Funcionan en claro y oscuro y en ~360/~768/~1440.
- **Zonas horarias:** test verde en los fines de semana de cambio de hora (marzo/octubre Europa,
  marzo/noviembre Norteamérica); un "20:00 local de Bélgica" se muestra bien en Uruguay en enero
  y en julio.
- **Sync:** una corrida real puebla `partidos`; una corrida con la fuente caída deja los datos
  intactos y enciende el badge.
- **Hitos:** con los datos reales, "se vienen los hitos" y los badges de las tarjetas coinciden
  con lo que dictan las `escalas_hito`.
- **Sin datos:** ninguna pantalla muestra `0` donde la fuente no trajo el dato; muestra `EstadoSinDatos`.

---

## 4. Funcionalidades para después — Fase 2 (fuera del MVP, no se olvidan)

- **CRM de artes.** Tablas ya previstas en el esquema (solo estructura en Fase 1): `campanas`,
  `piezas` (estados `borrador → en_revision → cambios_pedidos → aprobada → publicada → archivada`),
  `piezas_versiones` (solo metadatos de imagen, nunca binarios), `piezas_comentarios`,
  `piezas_aprobaciones`. Flujo: **sube el Diseñador → revisa y aprueba el Community Manager →
  las rondas que hagan falta.**
- **Pipeline de imágenes.** Compresión en el navegador antes de subir (rechazar > 8 MB,
  redimensionar, WebP ~0.82), Edge Function `procesar-imagen` disparada por trigger de Storage
  (recodifica, genera 2–3 tamaños, borra el original), entrega vía `next/image`, bucket `artes`
  privado con URLs firmadas cortas. Higiene: retención de N versiones, alerta al 70 % de 1 GB.
- **Envío real de notificaciones** (los switches del perfil ya se guardan en Fase 1): email o
  push cuando falta 24 h para un partido, cuando un jugador entra en rango de hito, y resumen
  semanal de los lunes.
- **Roles con permiso real vía RLS** (`cm` / `admin`): pasar `piezas.estado` a `aprobada`
  restringido por RLS + trigger que compara estado anterior vs. nuevo.
- **Credenciales individuales fuertes** en lugar de la contraseña compartida de demo.
- **Sub-competencias y juveniles** según lo que la agencia confirme seguir por país.
- **Panel de consumo de Storage** (tablero de `peso_bytes` + `hash` por versión).

---

## 5. Explícitamente fuera de alcance

- **No** es un producto público ni multi-agencia. Un solo tenant, un solo equipo.
- **No** hay registro/onboarding de usuarios: las cuentas las crea un script / un admin.
- **No** se hacen llamadas a APIs deportivas desde el navegador: el frontend **siempre** lee de
  Postgres. Sin excepción.
- **No** se guardan offsets horarios fijos (`+3`, `-4`, `CEST`, `BRT`…). Solo instante UTC +
  zona IANA. Las siglas de zona de la demo son de maqueta y se reemplazan.
- **No** se inventan datos: ausencia de dato = "Sin datos", nunca `0` ni un valor asumido.
- **No** se modifica el CSS, el marcado ni los tokens de `demo-fase1.html`.
- **No** entra el CRM, el pipeline de imágenes ni el envío de notificaciones en Fase 1 (solo su
  estructura de datos y el guardado de preferencias).
- **No** hay app móvil nativa: web responsive.
- **No** se cubren, y se muestran como "Sin datos": pre-listas de convocatoria a selección,
  divisiones juveniles/filiales/reservas, rendimiento individual detallado en copas poco
  cubiertas y en Liga de Expansión MX, lesiones con detalle.

---

## 6. Reglas de negocio a confirmar

- Contraseña definitiva de las 4 cuentas (`demo1234` propuesto; `demo` no cumple el mínimo de
  Supabase Auth). Y si se baja el mínimo de longitud.
- Divisiones y copas exactas a seguir por país, además de la liga principal de cada jugador.
- Fuente y frecuencia real de las correcciones al Excel de datos manuales.
- Plan final de API-Football: Pro (~USD 19) vs. Ultra (~USD 29). Tope acordado 20–30 USD/mes.
- Qué se considera "hito interno" (la agencia puede cargar hitos propios a mano) y quién los
  marca como `verificado`.
- Si la preferencia de tema debe ser por usuario (persistida en `perfiles`) o solo por dispositivo.

## 7. Datos / decisión técnica

- **¿El equipo edita contenido?** Sí, datos puntuales: hitos manuales, `fecha_nacimiento`,
  `fecha_fundacion`, y su propio perfil. No hay un CMS general.
- **¿Cálculos o datos sensibles?** Sí: conversión de zonas horarias (crítico, con DST) y el
  motor de hitos. Ambos con lógica propia y tests obligatorios.
- **Integraciones externas:** API-Football (pago, primaria), ESPN y TheSportsDB (gratis,
  respaldo), Supabase (Auth/DB/Storage/Edge Functions), Vercel (hosting). Sin pasarela de pago.
- **Stack decidido** (`contexto.md` §3): Next.js 14 App Router + TypeScript + React en Vercel ·
  Supabase (Postgres + Auth + Storage + Edge Functions + `pg_cron` + `pg_net`) · Luxon ·
  CSS de la demo sin Tailwind · tipos generados con `supabase gen types typescript`.

## 8. Plazos y expectativas

- Sin fecha límite dura declarada. Se avanza por sesiones, con `planeacion/avances.md` como
  bitácora entre sesiones.
- Primera entrega funcional objetivo: las 3 vistas conectadas a Supabase con auth y la sync de
  fixture andando (funcionalidades 1–9, 17, 19, 20).

## 9. Cómo se valida el éxito

1. Un integrante del equipo entra con su cuenta y, sin ayuda, dice los partidos de hoy con su
   hora de Uruguay en menos de 30 segundos.
2. La sección "se vienen los hitos" coincide, revisada a mano, con lo que dictan las
   `escalas_hito` para los 6 jugadores.
3. Se simula la caída de API-Football: los datos previos siguen visibles y aparece el badge de
   "no pudimos contactar la fuente", sin errores en pantalla.
4. Un partido de Bélgica a las 20:00 locales se muestra correctamente en hora de Uruguay tanto
   en enero (invierno europeo) como en julio (verano europeo).
5. Ninguna pantalla muestra `0` en lugar de "Sin datos".
6. Lighthouse: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 en las 3 vistas (doc 06).
7. Validación con 3–5 personas del equipo haciendo tareas sin pistas (doc 20).
