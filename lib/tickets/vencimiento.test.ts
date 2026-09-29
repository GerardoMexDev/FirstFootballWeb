import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fechaCortaUy, fechaHoraCortaUy, textoEvento, textoVencimiento } from './vencimiento.ts';

const HOY = '2026-09-28'; // lunes

test('textoVencimiento: futuro, mañana, hoy, vencido', () => {
  assert.deepEqual(textoVencimiento('2026-10-02', 'pendiente', HOY), { texto: 'Vence en 4 días · vie 2/10', vencido: false });
  assert.deepEqual(textoVencimiento('2026-09-29', 'en_revision', HOY), { texto: 'Vence mañana · mar 29/9', vencido: false });
  assert.deepEqual(textoVencimiento('2026-09-28', 'pendiente', HOY), { texto: 'Vence hoy', vencido: false });
  assert.deepEqual(textoVencimiento('2026-09-27', 'pendiente', HOY), { texto: 'Vencido hace 1 día · dom 27/9', vencido: true });
  assert.deepEqual(textoVencimiento('2026-09-25', 'pendiente', HOY), { texto: 'Vencido hace 3 días · vie 25/9', vencido: true });
});

test('textoVencimiento: sin fecha → "Sin fecha límite"; aprobado/publicado/cancelado → null', () => {
  assert.deepEqual(textoVencimiento(null, 'pendiente', HOY), { texto: 'Sin fecha límite', vencido: false });
  assert.equal(textoVencimiento('2026-09-20', 'aprobado', HOY), null);
  assert.equal(textoVencimiento('2026-09-20', 'publicado', HOY), null);
  assert.equal(textoVencimiento('2026-09-20', 'cancelado', HOY), null);
});

test('fechas cortas en hora de Uruguay', () => {
  assert.equal(fechaCortaUy('2026-10-02'), 'vie 2/10');
  // 2026-10-03 23:15 UTC = sáb 3/10 20:15 en Montevideo
  assert.equal(fechaHoraCortaUy('2026-10-03T23:15:00Z'), 'sáb 3/10 20:15');
});

test('textoEvento: motivo · fecha corta', () => {
  assert.equal(textoEvento('Cumpleaños', '2026-10-01'), 'Cumpleaños · jue 1/10');
});
