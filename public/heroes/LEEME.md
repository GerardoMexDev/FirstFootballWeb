# Fotos de fondo del hero (vista partidos)

**Estado: 8 fotos cargadas** (Sesión 3). Falta cablearlas al componente del hero
(elegir foto por `competencias.tipo`) — eso se hace en una sesión siguiente.

## Archivos

| Archivo | Tipo de competencia | Foto (Unsplash) |
|---|---|---|
| `liga-1.webp` | liga | Fiorentina, saque de arco, de día |
| `liga-2.webp` | liga | Buriram, cielo dramático al atardecer |
| `copa-1.webp` | copa | Emirates, techo contra cielo gris |
| `copa-2.webp` | copa | Bernabéu de noche, DTs en la línea |
| `continental-1.webp` | continental | Camp Nou de noche, vista amplia |
| `continental-2.webp` | continental | Bernabéu de noche, muro de hinchada |
| `seleccion-1.webp` | seleccion | Atardecer rosado, luces de celular |
| `seleccion-2.webp` | seleccion | Bernabéu vacío, de día (previa) |

Todas 1920×1080 WebP (~110–530 KB), recorte anclado arriba (saca cabezas de
primer plano), leve bajada de exposición para que el texto blanco se lea.

## Reprocesar una foto

Los originales `.jpg` no se guardan en el repo. Para recambiar una:
poné el nuevo original acá y avisá con qué recorte/tipo, se reprocesa y se
borra el original.

## Cómo se van a usar

El hero elige una imagen según `competencias.tipo` (liga / copa / continental /
seleccion), estable por partido. Sin foto para un tipo → degradado.
