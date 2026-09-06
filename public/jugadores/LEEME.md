# Fotos de los jugadores

**Estado: 6 fotos procesadas y cableadas** (Sesión 4). La grilla de la vista
`jugadores` las usa como fondo de cada tarjeta (`.jug__foto`). Sin foto para un
jugador → queda el fondo `.jug__fb` (el fallback ya está en el componente).

## Archivos versionados

| Archivo | Jugador | Club |
|---|---|---|
| `nandez.webp`    | Nahitan Nández   | Al-Qadisiyah |
| `pereira.webp`   | Federico Pereira | Toluca |
| `sosa.webp`      | Ignacio Sosa     | RB Bragantino |
| `mendez.webp`    | Javier Méndez    | Colo-Colo |
| `amaro.webp`     | Kevin Amaro      | Genk |
| `fernandez.webp` | Martín Fernández | Atlante |

Todas 600×800 WebP (3:4, calidad 80, ~15–40 KB), recorte "cover" centrado
anclado arriba para dejar aire sobre la cabeza. La ruta se guarda en
`jugadores.foto_url` (`/jugadores/<slug>.webp`) con `scripts/seed-fotos-jugadores.mjs`.

## Recambiar una foto

Los originales NO se versionan (`.gitignore` deja pasar solo los 6 `.webp` de
arriba, igual criterio que `public/heroes/`). Para cambiar una:

1. Poné el nuevo original en esta carpeta (cualquier nombre/formato).
2. Reprocesá a `<slug>.webp` 600×800:
   ```
   ffmpeg -y -i "<original>" -vf "scale=600:800:force_original_aspect_ratio=increase,crop=600:800:(iw-ow)/2:(ih-oh)*0.18" -c:v libwebp -quality 80 "<slug>.webp"
   ```
   (si es un plano entero, ajustá el `crop` para acercar cabeza + torso, como se
   hizo con `fernandez.webp`).
3. `foto_url` ya apunta ahí — no hace falta re-seed salvo que cambie el slug.

## Qué conviene en el original

- Retrato vertical, cara + torso, sujeto centrado y con aire alrededor.
- Lado corto ≥ 800 px (ideal 1000–1400).
- Fondo liso/neutro; camiseta del club actual o de la selección.
