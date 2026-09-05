# Fotos de fondo del hero (vista partidos)

Acá van las imágenes de fondo del bloque grande de "Próximos partidos".
Todavía no están conectadas al código — se cablean cuando lleguen las fotos.

## Qué se necesita

- **8 imágenes** (con 4 se puede arrancar: una por tipo de competencia).
- **Horizontales, mínimo 1600×900 px.**
- JPG o PNG (se optimizan a WebP al conectarlas).
- **Sin estadio, escudo, sponsor ni jugador reconocible** (si no, queda raro:
  un Camp Nou de fondo en un partido de Liga MX).
- Un poco oscuras / con poco contraste en la mitad superior, para que el
  texto blanco encima se lea.

## Nombres (si se puede)

Dos por tipo de competencia:

```
liga-1.jpg          liga-2.jpg
copa-1.jpg          copa-2.jpg
continental-1.jpg   continental-2.jpg
seleccion-1.jpg     seleccion-2.jpg
```

Si es más fácil, mandalas con cualquier nombre y se renombran acá.

## Cómo se van a usar

El hero elige una imagen según el tipo de competencia del partido
(`competencias.tipo`: liga / copa / continental / seleccion), de forma
estable por partido. Si no hay foto para un tipo, cae a un degradado.
