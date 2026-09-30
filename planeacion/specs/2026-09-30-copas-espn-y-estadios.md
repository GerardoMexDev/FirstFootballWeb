# Spec — Copas de Match Day desde ESPN + nombres de estadios de la agencia

**Fecha:** 2026-09-30 · **Pedido:** punto 10 de la agencia (listas de torneos y estadios de
Gerardo) · **Aprobado en conversación por Gerardo:** diseño en dos partes; la parte 1 va primero
(partido de Javi del 6/10).

## Parte 1 — Copas de los clubes de Match Day desde ESPN

### 1.1 Qué se quiere

Hoy las copas de los 6 clubes de Match Day vienen de API-Football gratis, que solo ve ~3 días
adelante: aparecen 1–2 días antes y el ticket automático (vence 2 días antes, spec
2026-09-30-match-day-automatico) nace **vencido**. Spike ESPN (2026-09-30, avances §5 punto 10):
faltan HOY Colo-Colo–Puerto Montt (Copa Chile, 6/10) y Al-Qadisiyah en AFC Champions League Elite
(7 partidos desde el 12/10) + Copa del Rey saudí (1/12).

Se traen de ESPN, con meses de anticipación, las copas de la lista de Gerardo
(`WebFirst/Torneos ligas.xlsx`) que ESPN tiene. Cada partido se vincula a los jugadores de
**Match Day** de ese club → tarjeta con cara + ticket automático, como cualquier partido de Match Day.

**Fuera de alcance:** ligas domésticas (siguen con SportMonks); lo que ESPN no tiene (Copa y
Supercopa de Bélgica, Supercopa saudí, Liga de Campeones del Golfo, Campeonato Árabe) sigue con
API-Football y su ventana corta; estadísticas (siguen con API-Football).

### 1.2 Torneos por club (slugs de ESPN verificados en `/leagues/dropdown`)

| Club (ESPN id) | Slugs |
|---|---|
| Toluca (223), Atlante (226) | `mex.campeon`, `concacaf.champions`, `concacaf.leagues.cup`, `campeones.cup`, `fifa.cwc`, `fifa.intercontinental_cup` |
| RB Bragantino (6079) | `bra.copa_do_brazil`, `bra.supercopa_do_brazil`, `bra.camp.paulista`, `conmebol.libertadores`, `conmebol.sudamericana`, `conmebol.recopa`, `fifa.cwc`, `fifa.intercontinental_cup` |
| Colo-Colo (2688) | `chi.copa_chi`, `chi.super_cup`, `conmebol.libertadores`, `conmebol.sudamericana`, `conmebol.recopa`, `fifa.cwc`, `fifa.intercontinental_cup` |
| Genk (938) | `uefa.champions`, `uefa.champions_qual`, `uefa.europa`, `uefa.europa_qual`, `uefa.europa.conf`, `uefa.europa.conf_qual`, `fifa.cwc`, `fifa.intercontinental_cup` |
| Al-Qadisiyah (22022) | `ksa.kings.cup`, `afc.champions`, `afc.cup`, `fifa.cwc`, `fifa.intercontinental_cup` |

Competencias: las que ya existen se referencian por su id de API-Football (Copa Chile 267, Copa do
Brasil 73, Libertadores 13, Sudamericana 11, Leagues Cup 772, CONCACAF Champions 16, Europa League
3, AFC Champions League Elite 17, AFC Champions League Two 18, King's Cup 504). Las nuevas se
siembran con `proveedor_externo='espn'`, `id_externo=<slug>` (las `_qual` usan la competencia
principal).

### 1.3 Diseño

- Se **extiende `sync-espn-uruguay`** (una sola sync de ESPN; el nombre queda por el deploy y el
  cron ya hechos — la cabecera lo aclara). La config de equipos suma los 6 clubes con
  `servicio: 'matchday'`; Peñarol/Nacional quedan `servicio: 'contenido'`.
- Vínculo: para `matchday`, jugadores **activos con `servicio_match_day`** y `club_actual_id` = el
  club; para `contenido`, como hoy. Se recalcula en cada corrida y se desvinculan los sobrantes
  (traspasos), también para Match Day.
- Clásicos de copa (Toluca vs Atlante en Leagues Cup): el rival se resuelve a nuestro club (no se
  crea un duplicado), como Peñarol–Nacional.
- **Repetidos ESPN ↔ API-Football:** API-Football sigue trayendo esas copas unos días antes (de ahí
  salen las estadísticas → hitos). `proximos_partidos` deduplica por (jugador, día UY, selección) y
  hoy prefiere la fila de API-Football → el `partido_id` del ticket cambiaría 2 días antes y se
  perdería el Completado del Diseñador (`disenos_partido` es por partido). Nueva prioridad de la
  vista: **SportMonks → ESPN → API-Football → otras**. Ligas: SportMonks (sin cambio real). Copas:
  ESPN (llega meses antes) → el ticket queda fijo. Verificado: hoy no hay partidos ESPN viejos de
  ligas vinculados a Match Day (0 filas), así que la prioridad no revive nada.
- **Tiempo de la corrida:** ~40 listados más (uno por club × torneo, con la espera entre llamadas
  de ESPN). La corrida de hoy tarda 18 s; se espera < 150 s. Si se acerca al límite de las Edge
  Functions, se parte en dos.
- Aviso: misma fuente `espn/partidos` del cartel (0031).

### 1.4 Pruebas

- Unit: config (tareas por club, competencias, servicio), vínculo Match Day vs Contenido,
  sobrantes en un clásico de copa.
- DB (ROLLBACK): con un partido ESPN y uno API-Football del mismo día para el mismo jugador,
  `proximos_partidos` muestra el de ESPN; con uno SportMonks y uno ESPN, el de SportMonks.
  `tickets_match_day` genera el ticket del partido de copa ESPN.
- Corrida local contra ESPN real: aparece Colo-Colo–Puerto Montt (6/10) para Javi y los de
  Al-Qadisiyah para Nahitan, con ticket pendiente; segunda corrida sin filas nuevas.

## Parte 2 — Nombres de estadios de la agencia (opción a)

### 2.1 Qué se quiere

Mostrar el nombre de estadio y la ciudad **como los usa la agencia** (Excel de Gerardo:
`WebFirst/Estadios.xlsx` — 5 ligas — y `WebFirst/Estadios uruguay.xlsx`) cuando el partido se juega
en la cancha **habitual** del local. Si la fuente trae otra (neutral, mudanza, el Centenario cuando
un chico recibe a Peñarol — nota de Gerardo: se avisa con tiempo y no siempre), se respeta la
fuente. Si la fuente no trae estadio, se usa el del Excel como respaldo. Hoy los 86 próximos de
Match Day tienen estadio pero en inglés/otro nombre ("Mexico City Stadium", "Guadalajara Stadium",
ciudades en inglés).

### 2.2 Diseño

- Tabla `estadios_equipo`: equipo, alias de nombre (los de las fuentes: "CA Peñarol", "RB
  Bragantino", "Colo-Colo"…), estadio y ciudad de la agencia, y `nombres_fuente` (cómo llaman las
  fuentes a ese estadio). Se siembra desde los Excel + un análisis de los partidos cargados (el
  estadio más frecuente del local = su cancha habitual).
- Trigger `before insert or update` en `partidos`: si el local tiene fila en la tabla y la fuente
  trae un nombre de `nombres_fuente` (o nada) → estadio y ciudad de la agencia; si no, lo de la
  fuente. Sirve para todas las syncs y se ve en tarjeta, panel, Copiar y calendario sin tocarlos.
- Una corrección única de los partidos ya cargados.

### 2.3 Pruebas

- DB (ROLLBACK): partido en la cancha habitual → nombre de la agencia; en el Centenario → queda el
  de la fuente; sin estadio → el de la agencia; club sin fila → sin cambio.
- Verificación: los 86 próximos, antes/después, sin estadios "perdidos".

## Deploy (lo corre Gerardo)

Parte 1: migración `0033` + `npm run deploy:funcion -- sync-espn-uruguay` + push.
Parte 2: migración `0034` + push.
