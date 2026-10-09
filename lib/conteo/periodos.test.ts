import { test } from 'node:test';
import assert from 'node:assert/strict';
import { periodoDeClave, periodoDeDia, periodosHasta } from './periodos.ts';

test('periodoDeDia: del 6 al 5 del mes siguiente (ejemplo de la agencia: 6 oct – 5 nov)', () => {
  assert.deepEqual(periodoDeDia('2026-10-08'), { clave: '2026-10', desde: '2026-10-06', hasta: '2026-11-05', etiqueta: '6 oct – 5 nov 2026' });
  assert.equal(periodoDeDia('2026-10-06').clave, '2026-10');
  assert.equal(periodoDeDia('2026-11-05').clave, '2026-10');
  assert.equal(periodoDeDia('2026-10-05').clave, '2026-09');
  assert.equal(periodoDeDia('2026-11-06').clave, '2026-11');
});

test('periodoDeDia: cruce de año (5 de enero → período de diciembre)', () => {
  const p = periodoDeDia('2027-01-05');
  assert.equal(p.clave, '2026-12');
  assert.equal(p.desde, '2026-12-06');
  assert.equal(p.hasta, '2027-01-05');
  assert.equal(p.etiqueta, '6 dic 2026 – 5 ene 2027');
});

test('periodoDeClave: claves inválidas → null', () => {
  assert.equal(periodoDeClave('2026-13'), null);
  assert.equal(periodoDeClave('2026-1'), null);
  assert.equal(periodoDeClave('hola'), null);
  assert.equal(periodoDeClave('2027-02')?.hasta, '2027-03-05');
});

test('periodosHasta: desde el actual hasta 6 sep – 5 oct, del más nuevo al más viejo', () => {
  assert.deepEqual(periodosHasta('2026-10-08').map((p) => p.clave), ['2026-10', '2026-09']);
  assert.deepEqual(periodosHasta('2026-10-03').map((p) => p.clave), ['2026-09']);
  assert.deepEqual(periodosHasta('2027-01-10').map((p) => p.clave), ['2027-01', '2026-12', '2026-11', '2026-10', '2026-09']);
});
