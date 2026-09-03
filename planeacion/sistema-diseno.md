# Sistema de Diseño — Football First (Fase 1)

> Derivado **1:1 de `planeacion/demo-fase1.html`**. La demo es la fuente de verdad cerrada.
> Este documento la explica y la deja lista para pegar en código; **no introduce valores nuevos**.
> Última edición: 2026-09-03.

---

## 0. Regla de uso (no negociable)

1. **El CSS de la demo no se modifica ni se renombra.** Ninguna clase (`.match`, `.hero`, `.kpi`,
   `.hito`, `.jug`, `.panel`, `.chip`, `.d1`…) cambia de nombre. Cada componente React emite
   **exactamente** ese marcado y esas clases.
2. El CSS se parte en dos archivos, sin tocar contenido:
   - **`styles/tokens.css`** → el bloque `:root { … }` + `[data-theme="dark"] { … }` de la demo.
   - **`styles/demo.css`** → todo el resto del `<style>` de la demo (reset, tipografía utilitaria,
     componentes, media queries), en el mismo orden.
   Ambos se importan en `app/layout.tsx`, primero `tokens.css`, después `demo.css`.
3. El tema se controla con `data-theme="light" | "dark"` en `<html>` (igual que la demo).
   El default de la demo es `light`.
4. Fuentes: se cargan `Anton` y `Archivo` (pesos 400/500/600/700) por `<link>` a Google Fonts
   o con `next/font/google`. Mismos nombres de familia que la demo.
5. Todo tamaño, color, radio, sombra y duración sale de un token. Si algo no está en la demo,
   se consulta antes de inventarlo.

---

## 1. Color

Sistema **semántico por rol**, no una escala numérica 50–900. La demo define cada color por su
uso (`--bg`, `--surface`, `--text-2`, `--accent`…). Hay dos paletas completas: clara y oscura.

### 1.1 Paleta clara (`:root`)

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#FFFFFF` | Fondo de página, fondo de `.match:hover`, fondo de `.ev`, popovers |
| `--surface` | `#FAF9F8` | Superficie de tarjetas (`.kpi`, `.match`, `.hito`, `.jug`, `.dato`, `.pm`) |
| `--surface-2` | `#F3F1EF` | Inputs, chips, hover de nav, hover de tarjeta |
| `--surface-3` | `#EAE7E4` | Chips activos de fondo suave, barras de progreso, `.compe__c` |
| `--line` | `#EDEBE8` | Divisores 1px (borde inferior de `.top`, `.panel__top`) |
| `--line-2` | `#DCD8D4` | Divisores de mayor contraste (poco usado en Fase 1) |
| `--text` | `#141110` | Texto principal, fondo de `.btn` y `.chip.on` |
| `--text-2` | `#6E6862` | Texto secundario, labels |
| `--text-3` | `#A29B95` | Texto terciario / muted, metadatos, placeholders |
| `--accent` | `#E64227` | Color de marca. CTA, estado "hoy", hitos, foco |
| `--accent-soft` | `#FDF0ED` | Fondo de alertas (`.aviso`), tarjetas de hito "ya", `--ring` |
| `--accent-hover` | `#C8371E` | Hover de `.btn--a` |
| `--on-accent` | `#FFFFFF` | Texto/íconos sobre `--accent` |

### 1.2 Paleta oscura (`[data-theme="dark"]`)

| Token | Valor |
|---|---|
| `--bg` | `#0E0C0B` |
| `--surface` | `#161312` |
| `--surface-2` | `#1F1B19` |
| `--surface-3` | `#2A2422` |
| `--line` | `#241F1D` |
| `--line-2` | `#38312D` |
| `--text` | `#F7F4F2` |
| `--text-2` | `#A79F99` |
| `--text-3` | `#6F6862` |
| `--accent` | `#F55437` |
| `--accent-soft` | `#2A1411` |
| `--accent-hover` | `#FF6E52` |
| `--on-accent` | `#140A07` |

### 1.3 Colores auxiliares

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--velo` | `rgba(20,17,16,.34)` | `rgba(0,0,0,.62)` | Fondo del overlay del panel y del buscador |
| `--foto-fb` | `linear-gradient(165deg,#EAE7E3,#D3CECA)` | `linear-gradient(165deg,#2C2523,#161312)` | Fallback cuando no hay foto de jugador |
| `--ring` | `0 0 0 3px var(--accent-soft)` | `0 0 0 3px rgba(245,84,55,.18)` | Anillo de foco en inputs |

Constantes de marca escritas a mano en la demo (fondos oscuros de `.login` y `.hero`):
`#0E0C0B`, `#2C2523`, `#E64227`, gradientes `linear-gradient(150deg,#2C2523,#0E0C0B)`.
No son tokens; son parte del marcado fijo de esos dos componentes.

### 1.4 Contraste (WCAG 2.2 AA — doc 16)

- `--text` sobre `--bg`: ~19:1 (claro) / ~17:1 (oscuro). ✅ AAA.
- `--text-2` sobre `--bg`: ~5.4:1 claro. ✅ AA texto normal.
- `--text-3` sobre `--bg`: ~2.6:1 claro → **solo decorativo / metadatos no esenciales**, nunca
  para información crítica. Vigilar en QA.
- `--accent` sobre `--bg`: ~4.6:1 claro. ✅ AA para texto ≥ un tamaño grande y para UI/gráficos.
  Para texto chico sobre blanco, preferir `--text` y reservar `--accent` a énfasis y elementos ≥ 18px.
- `--on-accent` sobre `--accent`: ✅ AA en ambos temas.

> Acción QA: revisar con contraste real todos los usos de `--text-3` como texto informativo y
> los textos sobre imágenes en `.hero` / `.jug` (llevan gradiente de oscurecimiento, verificar).

---

## 2. Tipografía

Dos familias, sin más:

| Rol | Familia | Fallback | Pesos |
|---|---|---|---|
| Display / títulos | `Anton` | `Impact, sans-serif` | 400 (única de Anton) |
| UI / cuerpo | `Archivo` | `-apple-system, BlinkMacSystemFont, sans-serif` | 400, 500, 600, 700 |

Tokens: `--display:'Anton',Impact,sans-serif` · `--ui:'Archivo',-apple-system,BlinkMacSystemFont,sans-serif`.

### 2.1 Escala de cuerpo/UI (px, fijos)

| Token | Valor | Uso |
|---|---|---|
| `--t-xs` | `11.5px` | Tags, `.meta`, stats de tarjeta de jugador, kbd |
| `--t-sm` | `12.5px` | Labels, texto secundario, `.linea`, `.sub` de secciones |
| `--t-md` | `13.5px` | Texto de UI por defecto (nav, chips, botones, filas) |
| `--t-base` | `15px` | Cuerpo (`body`), inputs, `.head .sub` |
| `--t-lg` | `17px` | Input del buscador |

`body`: `font-size:var(--t-base)`, `line-height:1.55`, `-webkit-font-smoothing:antialiased`.

### 2.2 Escala display (clases utilitarias, no tokens)

| Clase | `font-size` | `line-height` | `letter-spacing` | Uso |
|---|---|---|---|---|
| `.d1` | `clamp(40px, 5.6vw, 72px)` | `.84` | `-.012em` | Título de vista (`Próximos partidos`) |
| `.d2` | `clamp(25px, 3vw, 33px)` | `.94` | `-.008em` | Título de panel, mes del calendario |
| `.d3` | `19px` | `1.04` | — | Título de sección (`Se vienen los hitos`) |

Todas: `font-family:var(--display)`, `text-transform:uppercase`.

Tamaños display incrustados en componentes (no reutilizar fuera de su clase):
`.kpi b` 42px · `.hito__n` 38px · `.hero__t` `clamp(32px,4.8vw,60px)` · `.hero__cd b` 32px ·
`.dato b` 27px · `.filaht__n` 27px · `.hora b` 26px · `.duelo` 22px (26px en `.match--md`) ·
`.jug__txt>b` 21px · `.anio__m b` 20px · `.jug__stats b` 19px.

### 2.3 Números

Clase `.num` (y `b` dentro de `.dato/.kpi/.hora/.jug__stats/.filaht__n/.anio__m/.celda__n/.ev/.hero__cd`):
`font-variant-numeric:tabular-nums; letter-spacing:-.012em`. Todo dato numérico alineado en columna.

### 2.4 Pesos semánticos

400 cuerpo · 500 UI media (nav inactivo, chips, `.jug__club`) · 600 énfasis (labels, `.btn`,
`.compe__n`, `b` en `.meta/.linea`) · 700 datos fuertes (`.ev b`, `.compe__c`, `.crest`).

---

## 3. Espaciado y medidas

La demo **no usa una grilla de 8px estricta**; usa valores afinados a mano por componente
(9/10/11/13/14/16/18/20/22/24/26/28/30/34/44/52/56 px). Se respetan tal cual — no "redondear a 8".

Lo que sí es token:

| Token | Valor | Uso |
|---|---|---|
| `--maxw` | `1400px` | Ancho máximo de `.top__in` y `.wrap` |
| `--pad` | `clamp(22px, 4.5vw, 60px)` | Padding lateral de página |

Ritmo vertical de referencia (de la demo): `.wrap` padding top `clamp(36px,5vw,64px)`, bottom `130px`.
`.head` margin-bottom `44px`. `.sec` margin-bottom `56px`. `.grupo` margin-bottom `44px`.
`.kpis` margin-bottom `52px`. Gaps de grilla: `6px` (calendario, año), `8px`–`12px` (tarjetas).

### 3.1 Grillas de componente

| Componente | `grid-template-columns` | Gap |
|---|---|---|
| `.kpis` | `repeat(auto-fit, minmax(158px, 1fr))` | `10px` |
| `.hitos__l` | `repeat(auto-fill, minmax(262px, 1fr))` | `10px` |
| `.plantel` | `repeat(auto-fill, minmax(238px, 1fr))` | `12px` |
| `.match` | `126px 1fr auto` (→ `110px 1fr` < 900px) | `30px` |
| `.anio` | `repeat(12, 1fr)` (→ 6 < 1080px, → 4 < 620px) | `6px` |
| `.cal__grid` / `.cal__dias` | `repeat(7, 1fr)` | `6px` |
| `.datos` | `repeat(auto-fit, minmax(104px, 1fr))` | `8px` |
| `.jug__stats` | `repeat(3, 1fr)` | — |

---

## 4. Formas (radios)

| Token | Valor | Uso |
|---|---|---|
| `--r-lg` | `14px` | `.hero`, `.busca__c` |
| `--r` | `11px` | Tarjetas (`.kpi`, `.match`, `.hito`, `.jug`, `.drop`) |
| `--r-sm` | `8px` | Botones, inputs, chips internos, `.dato`, `.pm`, `.celda`, `.anio__m` |
| `--r-xs` | `6px` | `.compe__c`, `.hero__c i`, ítems de `.drop`, `.ev` |
| `999px` | pill | `.tag`, `.chip`, `.hero__flag`, `.jug__hito`, `.drop__rol`, `.switch`, `.toast`, `.who__btn` |

`.crest` (escudo genérico): `clip-path:polygon(0 0,100% 0,100% 64%,50% 100%,0 64%)` — forma de escudo,
color derivado del nombre con `hsl(var(--h) …)` donde `--h` = suma de charCodes % 360.

---

## 5. Elevación (sombras)

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--sh-1` | `0 1px 2px rgba(20,17,16,.04), 0 1px 3px rgba(20,17,16,.03)` | `inset 0 0 0 1px rgba(255,255,255,.032)` | Reposo de tarjetas |
| `--sh-2` | `0 2px 6px -1px rgba(20,17,16,.06), 0 8px 24px -6px rgba(20,17,16,.08)` | `inset … .055 + 0 8px 28px -8px rgba(0,0,0,.65)` | Hover de tarjetas, chip activo |
| `--sh-3` | `0 4px 12px -2px rgba(20,17,16,.07), 0 24px 64px -12px rgba(20,17,16,.16)` | `inset … .07 + 0 30px 70px -14px rgba(0,0,0,.8)` | `.hero:hover`, `.panel`, `.drop`, `.toast`, `.busca__c` |

En oscuro la elevación se hace con borde interior (`inset`) + sombra difusa, no solo sombra.

---

## 6. Movimiento

| Token | Curva | Uso |
|---|---|---|
| `--ease` | `cubic-bezier(.16, 1, .3, 1)` | Entradas y desplazamientos (paneles, hover lift, drop) |
| `--ease-2` | `cubic-bezier(.4, 0, .2, 1)` | Cambios de color/fondo, opacidad |

Duraciones observadas: `.2s`–`.3s` micro (color, background), `.35s`–`.5s` transform/box-shadow
de tarjetas, `.5s` panel lateral, `.6s` hero, `.9s`–`1.1s` filtros de imagen en hover.

**`@media (prefers-reduced-motion: reduce)`** ya en la demo: fuerza `transition-duration:.01ms` y
`animation-duration:.01ms` en todo. Se mantiene. (Cumple doc 06 / doc 16.)

Patrón de animación con propósito (doc 06): las tarjetas suben `translateY(-2/-3/-4px)` + suben de
sombra en hover; las imágenes pasan de `grayscale(1)` a color; el panel entra desde la derecha;
la `×` de cerrar rota 90°. Nada decorativo porque sí.

---

## 7. Componentes base

Todos ya definidos en `demo.css`. Referencia rápida de qué emite cada uno:

### 7.1 Botón — `.btn`
- Base: fondo `--text`, texto `--bg`, `--r-sm`, padding `11px 19px`, peso 600, `--t-md`.
- `.btn--a`: fondo `--accent` / texto `--on-accent`; hover `--accent-hover`.
- `.btn--g`: fondo `--surface-2`, texto `--text-2`, `--sh-1`; hover `--surface-3`.
- `.btn--sm`: padding `8px 14px`, `--t-sm`. · `.btn--ico`: `36px` cuadrado, padding `9px`.
- Hover base: fondo `--accent`, `translateY(-1px)`, `--sh-2`.
- Foco: `:focus-visible` global → `outline:2px solid var(--accent); outline-offset:3px`.

### 7.2 Chip / filtro — `.chip`
Pill, `--surface-2`, `--t-md`, peso 500, `--text-2`. Hover: `--surface-3` + `translateY(-1px)`.
`.chip.on`: fondo `--text`, texto `--bg`, peso 600, `--sh-2`. Se usa en `#filtros` y en las
pestañas del panel de perfil.

### 7.3 Input — `.campo input`
`--surface-2`, `--r-sm`, padding `13px 15px`, `--t-base`, `--sh-1`. Placeholder `--text-3`.
Foco: fondo `--bg` + `box-shadow: var(--ring), 0 0 0 1px var(--accent)`.
`:disabled`: `opacity:.5; cursor:not-allowed` (correo y rol en perfil van deshabilitados).

### 7.4 Tarjeta genérica
Patrón repetido (`.kpi`, `.hito`, `.dato`, `.pm`, `.filaht`, `.anio__m`, `.celda--con`):
fondo `--surface`, `--sh-1`, radio según nivel, hover `translateY(-2/-3px)` + `--sh-2`
(o `translateX` en filas). `.hito--ya` / `.filaht--ya`: fondo `--accent-soft`.

### 7.5 Tarjeta de partido — `.match`
Grilla `126px 1fr auto`. Sub-bloques: `.hora` (display 26px + `.uy` + `.loc` opcional),
`.mid` (`.compe` → `.duelo` → `.linea` → `.caras`), `.der` (chevron).
Modificadores: `--hoy` (barra `--accent` a la izquierda con `::before`), `--tent`
(`opacity:.62`), `--int` (fondo degradado `--accent-soft`→`--surface`), `--md` (más padding,
`.duelo` 26px). `tabindex="0"` + `role="button"` + Enter/Espacio abren el panel.

### 7.6 Hero — `.hero`
Bloque oscuro `#0E0C0B`, `min-height:352px` (290 < 900px), `--r-lg`. Capas: `.hero__fb`
(fallback gradiente) → `.hero__bg` (img, `grayscale` que se aclara en hover) → `.hero__grad`
(oscurecido inferior) → `.hero__top` (flag + cuenta regresiva) → `.hero__b` (liga, duelo,
sede/hora, jugador). Es un `<button>`.

### 7.7 Tarjeta de jugador — `.jug`
`aspect-ratio:3/4`. Capas foto + gradiente. `.jug__n` (dorsal), `.jug__hito` (pill acento) o
`.jug__pais` (pill glass) arriba. `.jug__stats` (3 columnas) sube desde abajo en `:hover` y en
`:focus-visible`. Es un `<button>`.

### 7.8 Panel lateral — `.panel` + `.velo`
`position:fixed`, derecha, `width:min(580px,100vw)`, entra con `translateX(100%)→0` en `.5s`.
`.panel__top` sticky con título (`#panel-t`) y `.panel__x`. `.panel__b` = contenido.
`.velo`: overlay `--velo` + `blur(4px)`, `opacity` 0→1. Cierran: `×`, click en velo, `Esc`.
Foco: al abrir se guarda `document.activeElement` y va a `.panel__x`; al cerrar vuelve.
Contenido tipado: detalle de partido / ficha de jugador / "Mi cuenta" (3 pestañas).
Sub-bloques reutilizables dentro: `.bloque`, `.datos`/`.dato`, `.filas`/`.filaht`, `.lst`/`.pm`,
`.aviso`, `.sinDato`, `.redes`/`.red`.

### 7.9 Buscador — `.busca`
Overlay centrado arriba (`padding-top:11vh`), `.busca__c` `max-width:600px`, `--r-lg`, `--sh-3`.
`.busca__i` (ícono + input `--t-lg` + kbd ESC) sobre `.busca__r` (resultados scrollables).
Grupos `.busca__g`, filas `.res` con `<em>` de acento para el término marcado. Abre con
`⌘K` / `Ctrl+K` y con el botón `.buscabtn`; cierra con `Esc` o click fuera.

### 7.10 Barra superior — `.top`
Sticky, fondo `color-mix(in srgb, var(--bg) 88%, transparent)` + `backdrop-filter:blur(20px)`.
`.brand` (logo + nombre + pill "Fase 1") · `.nav` (3 botones, activo con subrayado `--accent`
vía `::after`) · `.top__acc` (`.buscabtn`, `.icobtn` de tema, `.who` menú usuario).

### 7.11 Menú de usuario — `.who` / `.drop`
`.who__btn` (nombre + rol + avatar). `.drop` popover `274px`, `--sh-3`, aparece con
`opacity` + `scale(.97)→1` desde `top right`. Ítems: Mi perfil, Cambiar contraseña,
Notificaciones, separador, Cerrar sesión (`.sal`, color `--accent`).

### 7.12 Feedback
- `.toast`: pill fijo abajo-centro, fondo `--text`, entra desde abajo `translate(-50%,140%)→0`,
  se oculta solo a los `2800ms`. `role="status"` `aria-live="polite"`.
- `.aviso`: caja `--accent-soft`, ícono acento — para advertencias contextuales (diferencia
  horaria, "el rol lo cambia un admin", etc.).
- `.sinDato`: caja `--surface`, texto `--text-3` — **el estado "la fuente no trae el dato"**.
  Es el componente `EstadoSinDatos`. Nunca se reemplaza por `0`.
- `.tag--sin`: etiqueta chica gris para el mismo caso dentro de listas densas.

### 7.13 Switch — `.switch button`
Toggle `44×24`, `--surface-3` → `--accent` en `.on`, perilla `18px` que corre `translateX(20px)`.
`aria-pressed` refleja el estado (notificaciones del perfil).

---

## 8. Estados interactivos y accesibilidad (doc 16)

- **Foco visible global:** `:focus-visible { outline:2px solid var(--accent); outline-offset:3px }`.
  Nunca se quita sin reemplazo. Inputs además usan `--ring`.
- **Skip link:** `.saltar` (`href="#v-partidos"`) visible al tabular. Se mantiene.
- **Roles/ARIA ya presentes:** `nav[aria-label]`, `dialog[aria-modal]` en panel y buscador,
  `role="status"` en toast, `aria-haspopup`/`aria-expanded` en el menú de usuario,
  `aria-pressed` en switches, `aria-label` en botones-ícono, `.ico` con `aria-hidden`.
- **Teclado:** `⌘/Ctrl+K` abre búsqueda; `Esc` cierra buscador → si no, panel; `.match` es
  operable con Enter/Espacio. Al andamiar en React hay que preservar este manejo (hook global).
- **Targets táctiles:** botones-ícono `36–37px`. En móvil revisar que chips y `.ev` lleguen a
  `≥44px` de alto efectivo (doc 07/16) — anotarlo en QA, sin tocar el CSS de la demo salvo
  acuerdo.
- **Movimiento:** respetado vía `prefers-reduced-motion` (sección 6).
- **`lang="es"`** en `<html>`. Todo el texto visible en español (doc 19).

---

## 9. Iconografía y marca

- **Íconos:** SVG inline, `viewBox="0 0 24 24"`, `fill:none; stroke:currentColor;
  stroke-width:1.75` (`.ico`) o `2` (`.ico--sm`, 13px), `stroke-linecap/linejoin:round`.
  Estilo lineal tipo Feather. En la demo viven en el objeto `P` (paths) + helper `ico(nombre)`.
  Set usado: `flecha, atras, chevron, reloj, pin, trofeo, medalla, alerta, check, calendario,
  cerrar, fuego, torta, ig, globo, base`. En React → componente `<Ico nombre="pin" />` que
  emite el mismo `<svg>`; los paths se copian tal cual desde la demo.
- **Logo:** `<symbol id="ff" viewBox="0 0 188 192">` (monограma FF, un solo `path`).
  Se usa vía `<svg class="logo"><use href="#ff"/></svg>`, hereda `currentColor`. El `<symbol>`
  se monta una vez en `app/layout.tsx`. Color de marca en el header: `--accent`; en el login: `#E64227`.
- **Escudos de club/rival:** no hay assets en Fase 1 → `.crest` genérico (iniciales + tono HSL
  derivado del nombre). Cuando lleguen escudos reales (Storage) se sustituye por `<img>` dentro
  del mismo hueco, sin cambiar la clase.
- **Fotos:** jugador `.jug__foto` y hero `.hero__bg` van en `grayscale(1)` y pasan a color en
  hover. Fallback: `.jug__fb` / `.hero__fb` (gradiente) + `onerror` que quita la `<img>`.
  En producción: `next/image`, tamaños del doc 8 de `contexto.md` (ficha 800px, escudo 256px).

---

## 10. Responsive (doc 07)

Breakpoints de la demo (mobile-first por defecto, overrides hacia abajo):

| Ancho | Cambios |
|---|---|
| `≤ 1080px` | `.anio` pasa a 6 columnas |
| `≤ 900px` | login a 1 columna (oculta `.login__art`); `.nav` scroll horizontal sin barra; se ocultan `.who__t`, texto y kbd de `.buscabtn` (queda ícono 37px), pill "Fase 1"; `.match` a `110px 1fr` con `.der` en fila completa; `.hero` `min-height:290px`; `.celda` más chica |
| `≤ 620px` | `.top__in` `64px` de alto; `.duelo` 19px; `.anio` a 4 columnas; `.cal__nav .d2` 21px; se oculta la hora (`.ev b`) dentro de las celdas del calendario |

Container: `--maxw:1400px`, padding lateral `--pad` (22→60px fluido). Imágenes `max-width:100%`,
`display:block` (reset de la demo). Sin scroll horizontal (`body{overflow-x:hidden}`).

Metas Core Web Vitals (doc 06): LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1. El LCP probable es el
`.d1` de cada vista o el `.hero`; precargar fuentes (`next/font`) y reservar altura del hero
para no romper CLS.

---

## 11. Salida en código

### 11.1 `styles/tokens.css` (pegar tal cual de la demo)

```css
:root{
  --bg:#FFFFFF;--surface:#FAF9F8;--surface-2:#F3F1EF;--surface-3:#EAE7E4;
  --line:#EDEBE8;--line-2:#DCD8D4;
  --text:#141110;--text-2:#6E6862;--text-3:#A29B95;
  --accent:#E64227;--accent-soft:#FDF0ED;--accent-hover:#C8371E;--on-accent:#FFFFFF;
  --sh-1:0 1px 2px rgba(20,17,16,.04),0 1px 3px rgba(20,17,16,.03);
  --sh-2:0 2px 6px -1px rgba(20,17,16,.06),0 8px 24px -6px rgba(20,17,16,.08);
  --sh-3:0 4px 12px -2px rgba(20,17,16,.07),0 24px 64px -12px rgba(20,17,16,.16);
  --ring:0 0 0 3px var(--accent-soft);
  --velo:rgba(20,17,16,.34);
  --foto-fb:linear-gradient(165deg,#EAE7E3,#D3CECA);
  --t-xs:11.5px;--t-sm:12.5px;--t-md:13.5px;--t-base:15px;--t-lg:17px;
  --display:'Anton',Impact,sans-serif;
  --ui:'Archivo',-apple-system,BlinkMacSystemFont,sans-serif;
  --r-lg:14px;--r:11px;--r-sm:8px;--r-xs:6px;
  --ease:cubic-bezier(.16,1,.3,1);--ease-2:cubic-bezier(.4,0,.2,1);
  --maxw:1400px;--pad:clamp(22px,4.5vw,60px);
}
[data-theme="dark"]{
  --bg:#0E0C0B;--surface:#161312;--surface-2:#1F1B19;--surface-3:#2A2422;
  --line:#241F1D;--line-2:#38312D;
  --text:#F7F4F2;--text-2:#A79F99;--text-3:#6F6862;
  --accent:#F55437;--accent-soft:#2A1411;--accent-hover:#FF6E52;--on-accent:#140A07;
  --sh-1:inset 0 0 0 1px rgba(255,255,255,.032);
  --sh-2:inset 0 0 0 1px rgba(255,255,255,.055),0 8px 28px -8px rgba(0,0,0,.65);
  --sh-3:inset 0 0 0 1px rgba(255,255,255,.07),0 30px 70px -14px rgba(0,0,0,.8);
  --ring:0 0 0 3px rgba(245,84,55,.18);--velo:rgba(0,0,0,.62);
  --foto-fb:linear-gradient(165deg,#2C2523,#161312);
}
```

### 11.2 `styles/demo.css`

Desde `*{margin:0;padding:0;box-sizing:border-box}` (línea siguiente al cierre de
`[data-theme="dark"]`) hasta el final del `<style>` de la demo, **sin cambios**. Incluye:
reset, `.ico`, `.d1/.d2/.d3/.label/.meta/.tag`, `.btn*`, `.login*`, `.top/.nav/.who/.drop`,
`.wrap/.head/.vista/.sec`, `.hero*`, `.kpis/.kpi`, `.barra/.chip`, `.hitos__l/.hito`,
`.grupo/.match/.hora/.compe/.duelo/.linea/.caras/.crest`, `.anio*/.cal*/.celda/.ev/.leyenda`,
`.plantel/.jug*`, `.velo/.panel*/.bloque/.datos/.dato/.filas/.filaht/.lst/.pm/.aviso/.sinDato/.redes/.red`,
`.busca*`, `.fotoedit/.switches/.switch`, `.toast`, y las 4 media queries (`1080`, `900`, `620`,
`prefers-reduced-motion`).

### 11.3 Fuentes

```ts
// app/layout.tsx  (opción next/font)
import { Anton, Archivo } from 'next/font/google';
export const anton = Anton({ weight: '400', subsets: ['latin'], variable: '--f-anton', display: 'swap' });
export const archivo = Archivo({ weight: ['400','500','600','700'], subsets: ['latin'], variable: '--f-archivo', display: 'swap' });
```

Si se usa `next/font`, ajustar en `tokens.css` `--display` y `--ui` para tomar
`var(--f-anton)` / `var(--f-archivo)` como primera opción, manteniendo los fallbacks. Si se
prefiere el `<link>` a Google Fonts idéntico a la demo, `tokens.css` queda sin tocar.

### 11.4 Sin Tailwind

`contexto.md` §3 lo prohíbe explícitamente. No hay `tailwind.config`. Nada de CSS-in-JS.
Los componentes usan `className` con las clases de la demo y, cuando la demo lo hace, `style`
inline puntual (ej. `style="margin-bottom:14px"` dentro de paneles) — se copia igual.

---

## 12. Checklist de fidelidad (antes de dar por bueno cualquier componente)

- [ ] Emite exactamente las clases de la demo, sin renombrar ni agregar.
- [ ] No introduce colores/tamaños/radios/sombras fuera de los tokens de la sección 11.
- [ ] Estados hover/focus/active iguales a la demo (no se pierden al pasar a React).
- [ ] `EstadoSinDatos` (`.sinDato` / `.tag--sin`) donde la fuente puede no traer el dato; nunca `0`.
- [ ] Íconos = mismos paths del objeto `P` de la demo.
- [ ] Funciona en `data-theme="light"` y `="dark"`.
- [ ] Teclado y ARIA preservados (sección 8).
- [ ] Responsive verificado en ~360 / ~768 / ~1440 (doc 07).
