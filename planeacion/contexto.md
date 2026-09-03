# Contexto del Proyecto — Football First (Fase 1)

> Documento para alimentar al asistente de IA en VS Code. Resume arquitectura, stack,
> reglas de zonas horarias y pasos a seguir. Última edición: 2026-09-03.
> Fuente de diseño: `demo-fase1.html` (UI/UX cerrada). Metodología: Mazdesign.uy.

---

## 1. Qué es

Plataforma web interna de una **agencia de representación de futbolistas**. Sirve para:

- Seguir **partidos** (fixture, resultados, horarios) de los jugadores representados.
- Ver **trayectorias y estadísticas** por jugador.
- Anticipar **hitos** (partido 50, gol 25, cumpleaños, aniversarios de club/contrato, etc.).
- **Fase 2 (no ahora):** CRM para que un diseñador suba artes y un Community Manager los apruebe.

Equipo usuario: ~4 personas en Fase 1. Opera en **hora de Uruguay**.

---

## 2. Regla 0 — no codear sin contexto

- Antes de tocar código, leer este archivo y `planeacion/avances.md` (cuando exista).
- Acordar enfoque con Gerardo antes de implementar.
- Si falta un dato de negocio, **preguntar**, no asumir.
- Aplican todas las reglas de la metodología Mazdesign: simplicidad (KISS), refactor antes de
  sumar, un archivo = una responsabilidad, documentación obligatoria (cabecera + JSDoc +
  comentarios inline en lógica no obvia), nunca borrar/sobrescribir datos sin confirmación,
  código verificado antes de entregar (probar internamente, nunca en producción).
- **Todo el código, componentes y comentarios en español.**

---

## 3. Stack

| Capa | Elección | Notas |
|---|---|---|
| Frontend | **Next.js 14+ (App Router) + TypeScript + React** | Desplegado en **Vercel** (capa gratuita). |
| Estilos | CSS de `demo-fase1.html` **sin modificar** | `styles/tokens.css` (el `:root` de la demo) + `styles/demo.css` (el resto). Sin Tailwind, sin CSS-in-JS. |
| Backend / BD / Auth / Storage | **Supabase** (capa gratuita) | Postgres + Auth + Storage + Edge Functions (Deno/TS) + `pg_cron` + `pg_net`. |
| Datos deportivos | **API-Football (api-sports.io)**, plan Pro | Fuente primaria. Cascada de respaldo gratuita: ESPN (no oficial) y TheSportsDB/Wikidata. |
| Datos manuales | Planilla Excel → script de importación idempotente | `origen = 'manual'` en la BD. |
| Fechas/horas | **Luxon** con zonas IANA | Ver sección 6. Prohibido `date-fns` con offsets fijos. |
| Tipos | `supabase gen types typescript` → `lib/supabase/tipos-db.ts` | Regenerar tras cada migración. |

**Presupuesto mensual:** Supabase 0 + Vercel 0 + API-Football Pro ≈ USD 19 (confirmar precio
vigente al contratar). Tope acordado: 20–30 USD.

### Convenciones

- Idioma: **español** en identificadores, componentes y comentarios.
- Nombres de vista siguen a la demo: **`partidos`**, **`calendario`**, **`jugadores`**
  (no "dashboard", no "plantel").
- Rutas: `/partidos`, `/calendario`, `/jugadores`, `/jugadores/[jugadorId]`, `/login`.
- Componentes en `PascalCase` español (`TarjetaPartido`, `HeroPartidoDelDia`).
- Helpers/archivos en `kebab-case` español (`hora-en-uruguay.ts`, `motor-hitos.ts`).
- **Nunca** renombrar una clase CSS de la demo. El componente emite exactamente ese marcado.
- Componente único `EstadoSinDatos` para el caso "la fuente no trae el dato".
- Helper `mostrar(v)` → `v ?? 'Sin datos'`. **Nunca** convertir ausencia en `0`.

---

## 4. Estructura de carpetas

```
football-first/
├─ app/
│  ├─ layout.tsx                     # raíz: <html>/<body>, CSS global, provider de sesión
│  ├─ (auth)/login/page.tsx          # login con Supabase Auth
│  └─ (app)/
│     ├─ layout.tsx                  # barra superior + nav + buscador ⌘K + menú usuario
│     ├─ partidos/page.tsx           # hero, KPIs, "se vienen los hitos", filtros, lista
│     ├─ calendario/page.tsx         # densidad anual (12 meses) + grilla del mes
│     └─ jugadores/
│        ├─ page.tsx                 # grilla del plantel
│        └─ [jugadorId]/page.tsx     # ficha + estadísticas
├─ components/
│  ├─ layout/     BarraSuperior · Nav · BuscadorGlobal · MenuUsuario · CambioTema
│  ├─ partidos/   HeroPartidoDelDia · TarjetasKpi · SeccionHitos · BarraFiltros
│  │              ListaPartidos · GrupoDia · TarjetaPartido
│  ├─ calendario/ DensidadAnual · NavegadorMes · GrillaMes · CeldaDia · EventoCelda · Leyenda
│  ├─ jugadores/  GrillaPlantel · TarjetaJugador
│  ├─ paneles/    PanelLateral · PanelPartido · PanelJugador · PanelPerfil
│  └─ comunes/    EstadoSinDatos · IndicadorTentativa · Escudo · Avatar · Toast · Etiqueta
├─ lib/
│  ├─ supabase/
│  │  ├─ cliente-navegador.ts        # createBrowserClient (anon key)
│  │  ├─ cliente-servidor.ts         # createServerClient (SSR + cookies)
│  │  └─ tipos-db.ts                 # generado
│  ├─ repositorios/                  # PATRÓN REPOSITORIO
│  │  ├─ tipos.ts                    # interfaces (RepositorioPartidos, RepositorioHitos, ...)
│  │  ├─ repositorio-partidos.ts     # lee de Postgres — lo que usa el frontend
│  │  ├─ repositorio-hitos.ts
│  │  ├─ repositorio-jugadores.ts
│  │  └─ externos/                   # implementaciones de proveedores (las usan las Edge Functions)
│  │     ├─ proveedor-tipos.ts       # interfaz ProveedorDeportivo (para migrar sin dolor)
│  │     ├─ proveedor-api-football.ts   # primaria
│  │     ├─ proveedor-espn.ts           # respaldo gratis, NO oficial
│  │     └─ proveedor-thesportsdb.ts    # enriquecimiento (escudos, fundación)
│  ├─ fechas/
│  │  ├─ zonas.ts                    # ZONA_AGENCIA, horaEnUruguay, horaEnSede, aInstanteUtc
│  │  └─ agenda.ts                   # agrupar por día en zona de Uruguay
│  ├─ motor-hitos/
│  │  └─ index.ts                    # cálculo de hitos a partir de la tabla escalas_hito
│  ├─ mapeadores/
│  │  ├─ mapear-partido.ts           # crudo del proveedor -> modelo canónico
│  │  └─ mapear-estadistica.ts
│  └─ formato/
│     └─ valores.ts                  # mostrar(v) => v ?? 'Sin datos'
├─ supabase/
│  ├─ migrations/                    # SQL versionado: tablas, RLS, vistas, funciones, pg_cron
│  │  └─ 0001_esquema_inicial.sql
│  └─ functions/
│     ├─ sync-partidos/index.ts
│     ├─ sync-estadisticas/index.ts
│     ├─ sync-agenda/index.ts        # cumpleaños, fundaciones, hitos derivados
│     └─ procesar-imagen/index.ts    # Fase 2
├─ scripts/
│  ├─ seed-usuarios.ts               # crea las 4 cuentas (usa service_role)
│  └─ importar-datos-manuales.ts     # lee el Excel, upsert idempotente, muestra diff
├─ styles/
│  ├─ tokens.css                     # :root { --bg, --accent, --display, ... } de la demo, INTACTO
│  └─ demo.css                       # todo el CSS de la demo, sin renombrar clases
└─ planeacion/
   ├─ contexto.md                    # este archivo
   ├─ avances.md                     # bitácora entre sesiones (crear al cerrar la 1ª sesión)
   ├─ sistema-diseno.md              # generar a partir de la demo
   ├─ alcance-funcionalidades.md     # generar
   └─ arquitectura-fase1.html        # documento para la agencia (artifact)
```

---

## 5. Base de datos (esquema resumido)

Regla híbrida: cada tabla de datos externos lleva `origen` (`api` | `manual` | `derivado`),
`proveedor_externo`, `id_externo` (clave natural para upsert idempotente),
`payload_crudo jsonb` y `sincronizado_en`. Datos manuales = misma tabla, `origen = 'manual'`.
Timestamps con **`timestamptz`** (nunca `timestamp`). Auditoría: `creado_por`, `creado_en`,
`actualizado_en` + trigger `set_updated_at`.

### Tablas

- **`perfiles`** — 1:1 con `auth.users`. `id`, `nombre_completo`, `rol` (enum, un solo valor
  `usuario` en Fase 1), `cargo text` (Diseñador / Community Manager / Administrador / Prueba),
  `activo bool`. El `rol` y el correo los cambia un admin.
- **`clubes`** — `nombre`, `pais`, `zona_horaria text` (IANA), `fecha_fundacion date` `[manual]`,
  `escudo_url text` (Storage), `origen`, `proveedor_externo`, `id_externo`.
- **`jugadores`** — `nombre`, `apellido`, `apodo`, `posicion`, `dorsal`, `nacionalidad`,
  `seleccion text|null`, `club_actual_id → clubes`, `fecha_nacimiento date` `[manual]`,
  `debut date`, `fichaje date`, `instagram text`, `foto_url text` (Storage),
  `representante_id → perfiles` (informativo, NO controla acceso en Fase 1), `activo bool`.
- **`competencias`** — `nombre`, `pais`, `tipo` (`liga` | `copa` | `continental` | `seleccion`),
  `codigo text` (sigla corta para la UI, p.ej. `SPL`, `MX`, `LIB`), `id_externo`,
  `cobertura bool|null` (`null` = sin verificar → mostrar "Sin datos", no ceros).
- **`partidos`** — `competencia_id → competencias`, `club_local_id`, `club_visitante_id`,
  `inicio_utc timestamptz`, `zona_horaria_evento text` (IANA de la sede),
  `estado text` (`programado` | `en_juego` | `finalizado` | `suspendido` | `sin_datos`),
  `ronda text`, `estadio text`, `ciudad text`, `es_local bool|null`,
  `marcador_local int|null`, `marcador_visitante int|null` (**NULL = sin datos, jamás 0**),
  `tentativo bool` (true si `inicio_utc` está a > 90 días: el fixture se confirma por semestre),
  `origen`, `proveedor_externo`, `id_externo`, `payload_crudo jsonb`, `sincronizado_en`.
- **`partidos_jugadores`** — puente N:N. Un partido puede involucrar a **más de un**
  representado (ej.: Toluca vs Atlante). `partido_id`, `jugador_id`, `convocado bool|null`,
  `con_seleccion bool`.
- **`estadisticas_partido`** — `partido_id`, `jugador_id`, `minutos int|null`, `goles int|null`,
  `asistencias int|null`, `amarillas int|null`, `rojas int|null`, `titular bool|null`,
  `valoracion numeric|null`. **Todo NULL-able.** `origen`, `proveedor_externo`, `payload_crudo`.
- **`convocatorias`** — `jugador_id`, `tipo` (`club` | `seleccion`), `descripcion`, `fecha date`,
  `partido_id|null`, `origen`, `proveedor_externo`, `id_externo`.
- **`hitos`** — API + manual + derivado en una sola tabla. `jugador_id|null`, `club_id|null`,
  `tipo` (enum: `debut`, `gol_numero`, `partido_numero`, `titulo`, `traspaso`, `cumpleanos`,
  `aniversario_club`, `renovacion`, `lesion`, `hito_interno`, `otro`), `titulo`, `descripcion`,
  `fecha date`, `fecha_utc timestamptz|null`, `origen`, `verificado bool` (los manuales
  empiezan en false), `destacado bool` (para el hero), `creado_por → perfiles`, `metadatos jsonb`.
  Unique `(jugador_id, tipo, proveedor_externo, id_externo)` para idempotencia.
- **`escalas_hito`** — config del motor de hitos (ya en la demo como `ESCALAS`).
  `metrica text` (`pj` | `g` | `a`), `base text` (`carrera` | `seleccion`), `paso int`
  (cada cuántas unidades hay hito), `aviso int` (cuántas unidades antes se empieza a mostrar),
  `plantilla_frase text`.
- **`sincronizaciones`** — bitácora. `proveedor`, `recurso` (`partidos` | `estadisticas` |
  `agenda`), `iniciado_en`, `finalizado_en`, `estado` (`ok` | `error` | `parcial`),
  `registros_afectados int`, `error_detalle text`, `parametros jsonb`.
  Sirve para el badge "Datos actualizados el {fecha}".

### Vistas

- **`proximos_partidos`** — la que consume el frontend (ya nombrada en la demo). Resuelve club
  a partir del jugador (si el jugador cambia de club, sus partidos lo siguen), junta liga,
  jugador y flag `tentativo`, y expone la hora lista para mostrar.
- **`agenda_anual`** — `UNION ALL` de partidos + convocatorias + hitos con fecha + cumpleaños
  (de `jugadores.fecha_nacimiento`) + aniversarios de club (de `clubes.fecha_fundacion`).
  La densidad del calendario = `count(*)` agrupado por
  `date_trunc('day', cuando_utc at time zone 'America/Montevideo')`.

### CRM — solo estructura, se implementa en Fase 2

`campanas`, `piezas` (estado: `borrador` → `en_revision` → `cambios_pedidos` → `aprobada` →
`publicada` → `archivada`), `piezas_versiones` (**solo** `imagen_url` + `ancho`, `alto`,
`peso_bytes`, `formato`, `hash`; nunca binarios en Postgres), `piezas_comentarios`,
`piezas_aprobaciones`. Flujo: **sube el diseñador → revisa y aprueba el Community Manager →
las rondas que hagan falta.**

### RLS

- `enable row level security` en **todas** las tablas de `public`. Sin política = sin acceso.
  Nada anónimo.
- `service_role` (salta RLS) **solo** en Edge Functions y scripts del servidor. Jamás en el
  navegador. El cliente usa la `anon` key + JWT del usuario.
- **Lectura** de datos deportivos: cualquier usuario autenticado y activo
  (`using (auth.uid() is not null)`).
- **Escritura de datos manuales** (hitos `origen='manual'`, `fecha_nacimiento`,
  `fecha_fundacion`): cualquier usuario autenticado en Fase 1.
- **Datos que llenan las Edge Functions** (`partidos`, `estadisticas_partido`, `convocatorias`,
  hitos `origen in ('api','derivado')`): sin política de INSERT/UPDATE/DELETE para usuarios →
  solo `service_role`. Usuarios solo SELECT.
- `perfiles`: cada quien UPDATE su propia fila; cambiar `rol`/correo solo admin.
- Fase 2: pasar `piezas.estado` a `aprobada` → restringido a rol `cm`/`admin` vía RLS + trigger
  que compara estado anterior vs. nuevo.
- Storage: bucket `artes` privado (URLs firmadas de corta duración); `jugadores` y `escudos`
  públicos de lectura con `Cache-Control` largo; escritura solo usuarios autenticados.

### Usuarios semilla (Fase 1)

Registro público **deshabilitado** en Supabase Auth. Confirmación de email desactivada.
Cuentas creadas con `scripts/seed-usuarios.ts`. Supabase Auth pide email → el login acepta el
nombre y la app le agrega el dominio.

| Nombre | Login | Email interno | Contraseña | `cargo` |
|---|---|---|---|---|
| Maxi Rosales | `maxi` | `maxi@footballfirst.uy` | ver nota | Diseñador |
| Pedro Vidal | `pedro` | `pedro@footballfirst.uy` | ver nota | Community Manager |
| Felipe Merola | `felipe` | `felipe@footballfirst.uy` | ver nota | Administrador |
| Alexis Agustín | `alexis` | `alexis@footballfirst.uy` | ver nota | Prueba |

> **Nota contraseña:** se pidió `demo`, pero Supabase Auth exige mínimo 6 caracteres y la
> propia demo usa `demo1234`. Usar **`demo1234`** salvo que Gerardo confirme bajar el mínimo.
> Contraseña compartida SOLO para demo cerrado: antes de cualquier uso real, credenciales
> individuales fuertes.

---

## 6. Zonas horarias — REGLA CRÍTICA (DST)

**La agencia opera en hora de Uruguay: `America/Montevideo`, UTC−3, SIN horario de verano.**
Los jugadores están en ligas que **sí** aplican DST (Bélgica, y parte del año México). Un
partido "20:00 hora local de Bélgica" cae a distinta hora de Uruguay según el mes.

### Prohibido

- Offsets numéricos fijos (`+3`, `-4`, `+6`).
- Siglas de zona como dato de cálculo (`CEST`, `BRT`, `CST`...). En la demo aparecen y el
  comentario "Arabia +6, Bélgica +5" — **eso es solo para la maqueta**, se reemplaza.
- `new Date()` + aritmética de horas.
- `at time zone '-03'` en SQL.

### Obligatorio

- Librería IANA: **Luxon** (`luxon` en frontend, import desde `npm:luxon` en Edge Functions).
- Guardar SIEMPRE: `inicio_utc timestamptz` (instante absoluto) **+** `zona_horaria_evento text`
  con el nombre IANA de la sede.
- Zonas IANA por país de la cartera:
  `Asia/Riyadh` (Arabia), `Europe/Brussels` (Bélgica), `America/Mexico_City` (México),
  `America/Sao_Paulo` (Brasil), `America/Santiago` (Chile), `America/Montevideo` (agencia y
  selección uruguaya).
- Constante única: `export const ZONA_AGENCIA = 'America/Montevideo'` en `lib/fechas/zonas.ts`.
- Agrupar el calendario por día con `inicio_utc at time zone 'America/Montevideo'` (nombre IANA).
- Conexión de Postgres en `UTC`; toda conversión en la app o con `at time zone '<IANA>'` explícito.
- Tests obligatorios en los fines de semana de cambio de hora: marzo y octubre (Europa),
  marzo y noviembre (Norteamérica). Verificar que la hora en Uruguay se corre bien.

### Código de referencia (`lib/fechas/zonas.ts`)

```ts
/**
 * Utilidades de zona horaria para Football First.
 * La agencia opera en hora de Uruguay (America/Montevideo, sin DST).
 * Los partidos se guardan como instante UTC + zona IANA de la sede.
 */
import { DateTime } from 'luxon';

export const ZONA_AGENCIA = 'America/Montevideo';

/**
 * Convierte una hora de pared de la sede a instante UTC absoluto.
 * Resuelve el offset correcto para esa fecha (con o sin horario de verano).
 * @param fechaHoraLocal p.ej. '2026-03-28T20:00:00' (sin offset)
 * @param zonaSede IANA, p.ej. 'Europe/Brussels'
 * @returns Date en UTC, listo para columna timestamptz
 */
export function aInstanteUtc(fechaHoraLocal: string, zonaSede: string): Date {
  const dt = DateTime.fromISO(fechaHoraLocal, { zone: zonaSede });
  if (!dt.isValid) {
    throw new Error(`Fecha/zona inválida: ${dt.invalidReason} (${zonaSede})`);
  }
  return dt.toUTC().toJSDate();
}

/** Hora del partido en horario de operación de la agencia (Uruguay). */
export function horaEnUruguay(inicioUtc: string): string {
  return DateTime.fromISO(inicioUtc, { zone: 'utc' })
    .setZone(ZONA_AGENCIA)
    .toFormat("cccc d 'de' LLLL HH:mm 'h'", { locale: 'es' });
}

/** Hora local en la sede del partido (para la ficha del partido). */
export function horaEnSede(inicioUtc: string, zonaSede: string): string {
  return DateTime.fromISO(inicioUtc, { zone: 'utc' })
    .setZone(zonaSede)
    .toFormat("HH:mm 'h'");
}
```

---

## 7. APIs y sincronización

### Cascada de fuentes (patrón repositorio)

El repositorio pide a la fuente 1; si no hay dato, cae a la 2; luego 3; luego el dato manual.
Si nadie lo trae → **"Sin datos"** (nunca inventar).

1. **API-Football (api-sports.io) — de pago, primaria.** Cubre las 6 ligas + Liga de Expansión
   MX + copas domésticas (Copa do Brasil, Copa Chile, Beker van België, King's Cup) +
   continentales (Libertadores, Sudamericana, AFC) + fixtures de selección + estadísticas por
   jugador. Endpoint clave para configurar competencias: `GET /leagues`. API key en variable de
   entorno de la Edge Function, **nunca** en el repo ni en el cliente.
2. **ESPN — endpoints NO oficiales, gratis, respaldo.** Fixture y resultados:
   `https://site.api.espn.com/apis/site/v2/sports/soccer/<liga>/scoreboard?dates=YYYYMMDD`.
   Slugs aproximados: `ksa.1`, `mex.1`, `mex.2`, `chi.1`, `bra.1`, `bel.1`,
   `conmebol.libertadores`, `conmebol.sudamericana`. Sin documentación, sin SLA, puede cambiar
   o cortarse sin aviso. Usar con `timeout` corto, reintento y caché en Postgres. Nunca como
   fuente única. Estadística por jugador: despareja, tratar como "puede no venir".
3. **TheSportsDB / Wikidata — gratis, enriquecimiento.** Escudos, fotos, año de fundación.
   (La fundación de club de los 6 clubes ya viene del Excel; esto es respaldo.)
4. **Planilla Excel — fuente propia.** Cumpleaños, fundación de clubes, observaciones, hitos
   internos.

### Flujo

- **`pg_cron`** solo agenda y dispara: con `pg_net` hace `http_post` a la Edge Function.
  No hace HTTP a terceros ni parsea JSON.
- **Edge Function** (`supabase/functions/sync-*`): lee la última corrida OK de
  `sincronizaciones` → llama al proveedor vía repositorio con `timeout` + 3 reintentos con
  backoff → si TODOS fallan: escribe `sincronizaciones` con `estado='error'`, **no toca los
  datos existentes**, responde 200 → si responde: normaliza al modelo canónico, `upsert` por
  `(proveedor_externo, id_externo)`, guarda `payload_crudo` y `sincronizado_en=now()` → deriva
  hitos (múltiplos de `escalas_hito.paso`) con `upsert` idempotente → cierra `sincronizaciones`
  con `estado='ok'`.
- **El frontend SIEMPRE lee de Postgres.** Nunca llama a una API externa directamente.
  Si `sincronizado_en` está viejo o la última corrida fue `error`, mostrar badge:
  "Datos actualizados el {fecha}. No pudimos contactar la fuente."

### Frecuencias

| Recurso | Cuándo |
|---|---|
| Fixture + convocatorias | 1×/día, 03:00 UTC |
| Días con partido de un representado | cada 10–15 min en ventana ±3 h |
| Estadísticas por jugador | 2 h después del final + reintento a las 12 h |
| Agenda (cumpleaños, fundaciones, hitos derivados) | 1×/día |

Volumen ≈ 30 partidos/mes. Cualquier plan de API-Football lo cubre de sobra.

### Migrar a otro proveedor a futuro

Cambiar una implementación en `lib/repositorios/externos/` (p.ej. crear
`proveedor-sportmonks.ts` que implemente `ProveedorDeportivo`). Las Edge Functions de
orquestación, el esquema y el frontend no se tocan: la diferencia la absorbe el mapeador.

### Huecos conocidos (mostrar "Sin datos", nunca inventar)

- Pre-listas de convocatoria a selección con anticipación.
- Divisiones juveniles, filiales, reservas.
- Rendimiento individual detallado en copas poco cubiertas y en Liga de Expansión MX
  (verificar `cobertura` contra `GET /leagues` antes de prometer el dato).
- Lesiones con detalle.

---

## 8. Imágenes (Fase 2) — límites 1 GB Storage / 5 GB egress/mes

1. La imagen **nunca** va a Postgres. En la tabla solo la URL/`path` de Storage.
2. **En el navegador, antes de subir:** rechazar > 8 MB; redimensionar lado mayor
   (arte 1600 px, foto de ficha 800 px, escudo 256 px) y convertir a WebP calidad ~0.82
   (`canvas.toBlob` o `browser-image-compression`). ~4 MB → ~150–300 KB.
3. **En el servidor:** Edge Function `procesar-imagen` disparada por trigger de Storage;
   recodifica a WebP lo que no venga optimizado, genera 2–3 tamaños, borra el original pesado.
4. **Entrega:** `artes` en bucket privado con URLs firmadas cortas; escudos/fotos públicos con
   `Cache-Control` largo; servir vía `next/image` (la CDN de Vercel resuelve las relecturas y no
   cuentan egress de Supabase). Usar el transformador de imágenes de Supabase para pedir el
   tamaño exacto de cada uso.
5. **Higiene:** retención de últimas N versiones; `pg_cron` mensual marca borradores huérfanos
   (borrado suave, con confirmación); `peso_bytes` + `hash` por versión para tablero de consumo
   y alerta al 70 % de 1 GB.

Presupuesto: 1 GB ÷ 250 KB ≈ 4.000 artes WebP; con 3 versiones/pieza ≈ 1.300 piezas.

---

## 9. Datos manuales recibidos — `Datos de jugadores y clubes.xlsx`

Hoja única, rango B4:G10. Alimenta `jugadores.fecha_nacimiento` y `clubes.fecha_fundacion`
con `origen = 'manual'`. `scripts/importar-datos-manuales.ts` debe ser idempotente y mostrar
el diff antes de escribir. Puede haber correcciones de último momento (poco frecuentes).

| Futbolista | Equipo | País | Cumpleaños | Fundación club | Observación |
|---|---|---|---|---|---|
| Nahitan | Al-Qadsiah (Alqadiash en la planilla) | Arabia | 1995-12-28 | 1967-12-01 | — |
| Fede Pereira | Toluca | México | 2000-02-24 | 1917-02-12 | — |
| Nacho Sosa | Red Bull (Bragantino) | Brasil | 2003-08-31 | 2020-01-01 | Cambio de nombre |
| Javi Mendez | Colo-Colo | Chile | 1994-12-05 | 1925-04-19 | — |
| Kevin Amaro | KRC Genk | Bélgica | 2004-03-03 | 1988-07-01 | Fusión de KFC Winterslag y Waterschei SV Thor |
| Martin Fernandez | Atlante | México | 2001-05-08 | 1916-04-18 | — |

> Los nombres de club de la planilla están abreviados/con typos; normalizar contra
> `competencias` y `GET /leagues` al importar. La planilla es la fuente de verdad para
> **cumpleaños y fundación**; las estadísticas de la demo son de muestra, no usarlas.

---

## 10. Reglas críticas (repetir siempre)

1. **Zonas horarias:** Luxon + IANA. Instante UTC + zona IANA de la sede. `America/Montevideo`
   para la agencia. Cero offsets fijos. (Sección 6.)
2. **Cero invenciones:** si la fuente no da el dato → "Sin datos". Nunca 0 por defecto, nunca
   valor asumido. Estadísticas NULL-ables.
3. **Seguridad:** Supabase Auth, RLS estricta en todas las tablas, `service_role` solo en el
   servidor. XSS: nada de `dangerouslySetInnerHTML` con datos de API/usuarios; texto libre
   plano. SQL siempre parametrizado. Secrets en variables de entorno, nunca en el repo.
4. **Respetar la demo al 100 %:** clases CSS, estructura HTML y variables de diseño de
   `demo-fase1.html` no se modifican.
5. **Verificado antes de entregar:** probar internamente (sandbox / copia local / ruta de
   prueba), nunca en producción. Si no se pudo probar, decirlo.

---

## 11. Pasos a seguir

1. Validar esta arquitectura con Gerardo / la agencia.
2. Generar `planeacion/sistema-diseno.md` a partir de la demo (escalas de color, tipografía
   modular, espaciado, tokens semánticos y CSS listo para pegar).
3. Generar `planeacion/alcance-funcionalidades.md` (Fase 1 y Fase 2).
4. Crear proyecto Supabase + migración `0001_esquema_inicial.sql` (tablas + RLS + vistas
   `proximos_partidos` y `agenda_anual` + jobs `pg_cron`).
5. Confirmar contra `GET /leagues` de API-Football los IDs de las 6 ligas + Liga de Expansión
   MX + copas + continentales; cargarlos en `competencias` con su `cobertura`.
6. `scripts/seed-usuarios.ts` (4 cuentas) y `scripts/importar-datos-manuales.ts` (Excel).
7. Andamiar Next.js con `styles/tokens.css` + `styles/demo.css` intactos y los componentes
   vacíos emitiendo el marcado de la demo.
8. Escribir `supabase/functions/sync-partidos` y conectar `proximos_partidos` a la pantalla
   `partidos`. Luego `sync-estadisticas`, `sync-agenda`.
9. Motor de hitos (`lib/motor-hitos`) leyendo `escalas_hito`; conectar "se vienen los hitos"
   y los badges de hito en tarjetas de partido y fichas.
10. Al cerrar cada sesión: actualizar `planeacion/avances.md` (hecho / pendiente / decisiones).

---

## 12. Dudas abiertas

- Contraseña definitiva de las 4 cuentas demo (`demo1234` propuesto; `demo` no cumple el
  mínimo de Supabase Auth).
- Divisiones/copas exactas a seguir por país además de la liga principal.
- Fuente y frecuencia real de las correcciones manuales del Excel.
- Presupuesto/plan final de API-Football (Pro ~USD 19 vs. Ultra ~USD 29).
