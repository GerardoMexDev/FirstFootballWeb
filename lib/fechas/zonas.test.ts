/**
 * Tests de `marcadorCambioDeDia` — la marca "+1"/"-1" estilo vuelos para partidos que en
 * Uruguay caen en otro día que en su sede. Runner nativo de Node (`npm test`).
 * Football First (Fase 1). Creado 2026-09-08 (Sesión 6, punto I).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { marcadorCambioDeDia } from './zonas.ts';

test('mismo día → sin marca', () => {
  assert.equal(marcadorCambioDeDia('2026-09-12', '2026-09-12'), '');
});

test('partido de la noche en México: en Uruguay ya es el día siguiente → "+1"', () => {
  // vie 11 en la sede, sáb 12 en Uruguay
  assert.equal(marcadorCambioDeDia('2026-09-11', '2026-09-12'), '+1');
});

test('partido de madrugada en Arabia: en Uruguay todavía es el día anterior → "-1"', () => {
  // sáb 12 en la sede, vie 11 en Uruguay
  assert.equal(marcadorCambioDeDia('2026-09-12', '2026-09-11'), '-1');
});

test('salto de dos días (borde de fin de mes / casos raros) → "+2"', () => {
  assert.equal(marcadorCambioDeDia('2026-08-31', '2026-09-02'), '+2');
});

test('nulos o fechas inválidas → sin marca (nunca rompe)', () => {
  assert.equal(marcadorCambioDeDia(null, '2026-09-12'), '');
  assert.equal(marcadorCambioDeDia('2026-09-12', null), '');
  assert.equal(marcadorCambioDeDia('no-es-fecha', '2026-09-12'), '');
});
