import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HORAS_INACTIVIDAD, sesionVencidaPorInactividad } from './inactividad.ts';

const AHORA = Date.UTC(2026, 9, 5, 12, 0, 0);
const H = 3_600_000;

test('sesionVencidaPorInactividad: sin cookie o valor inválido → no cierra', () => {
  assert.equal(sesionVencidaPorInactividad(undefined, AHORA), false);
  assert.equal(sesionVencidaPorInactividad('', AHORA), false);
  assert.equal(sesionVencidaPorInactividad('abc', AHORA), false);
  assert.equal(sesionVencidaPorInactividad('0', AHORA), false);
});

test(`sesionVencidaPorInactividad: hasta ${HORAS_INACTIVIDAD} h sigue; más de ${HORAS_INACTIVIDAD} h cierra`, () => {
  assert.equal(sesionVencidaPorInactividad(String(AHORA - 1 * H), AHORA), false);
  assert.equal(sesionVencidaPorInactividad(String(AHORA - 12 * H), AHORA), false);
  assert.equal(sesionVencidaPorInactividad(String(AHORA - 12 * H - 1000), AHORA), true);
  assert.equal(sesionVencidaPorInactividad(String(AHORA - 72 * H), AHORA), true);
});
