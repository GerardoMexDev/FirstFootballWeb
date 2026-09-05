# Fotos de los jugadores

Acá van las 6 fotos de los representados. Todavía no están conectadas —
se cablean en la sesión de la vista `jugadores` + ficha.

## Qué se necesita

- **1 por jugador** (los 6).
- **Retrato vertical**, cara + torso, **centrada y con aire** alrededor
  (la app recorta a cuadrado para el círculo y a card para la grilla).
- **Lado corto ≥ 800 px** (ideal 1000–1400). Más grande no molesta.
- JPG o PNG (se convierten a WebP).
- Fondo cualquiera; mejor si es liso/neutro (foto de plantel o de prensa).
- Idealmente con la camiseta del club actual o de la selección.

## Nombres

Por apellido, en minúscula, sin tildes:

```
nandez.jpg     -> Nahitan Nández  (Al-Qadisiyah)
pereira.jpg    -> Federico Pereira (Toluca)
sosa.jpg       -> Ignacio Sosa    (RB Bragantino)
mendez.jpg     -> Javier Méndez   (Colo-Colo)
amaro.jpg      -> Kevin Amaro     (Genk)
fernandez.jpg  -> Martín Fernández (Atlante)
```

Si es más fácil, mandalas con cualquier nombre y se renombran acá.

## Cómo se van a usar

Se procesan a WebP (una versión ~1200px para la ficha, un cuadrado ~400px
para las caras) y se guarda la ruta en `jugadores.foto_url`. Sin foto para
un jugador → iniciales con color derivado del nombre (ya está ese fallback).
Los `.jpg` originales no se versionan.
