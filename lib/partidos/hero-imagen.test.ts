/**
 * Tests de `imagenHero`. Runner nativo de Node (incluido en `npm test`):
 *   node --test lib/partidos/hero-imagen.test.ts
 *
 * Football First (Fase 1). Creado 2026-09-05.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { imagenHero } from './hero-imagen.ts';

test('sin tipo conocido -> null (queda el degradé del hero)', () => {
  assert.equal(imagenHero(null, 'p1'), null);
  assert.equal(imagenHero(undefined, 'p1'), null);
  // @ts-expect-error prueba defensiva con un valor fuera del enum
  assert.equal(imagenHero('amistoso', 'p1'), null);
});

test('cada tipo devuelve una de sus 2 fotos', () => {
  for (const tipo of ['liga', 'copa', 'continental', 'seleccion'] as const) {
    const ruta = imagenHero(tipo, 'cualquier-id');
    assert.match(ruta ?? '', new RegExp(`^/heroes/${tipo}-[12]\\.webp$`));
  }
});

test('es estable: el mismo partido siempre da la misma foto', () => {
  const a = imagenHero('liga', 'partido-abc-123');
  const b = imagenHero('liga', 'partido-abc-123');
  assert.equal(a, b);
});

test('reparte entre las 2 variantes según el id', () => {
  const vistos = new Set<string>();
  for (let i = 0; i < 50; i++) vistos.add(imagenHero('copa', `id-${i}`)!);
  assert.equal(vistos.size, 2, 'deberían aparecer copa-1 y copa-2');
});
