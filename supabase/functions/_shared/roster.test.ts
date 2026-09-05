/**
 * Tests de la lógica pura de cambio de club. Runner nativo de Node (sin Deno, sin deps):
 *   node --test supabase/functions/_shared/roster.test.ts   (incluido en: npm test)
 *
 * Football First (Fase 1). Creado 2026-09-05.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { detectarCambioDeClub, tituloTraspaso, type Traspaso } from './roster.ts';

const HOY = '2026-09-05';
const GENK = { idExterno: '742', nombre: 'Genk' };
const CAGLIARI = { idExterno: '490', nombre: 'Cagliari' };

function traspaso(hasta: { idExterno: string; nombre: string } | null, fecha: string, tipo = 'Transfer'): Traspaso {
  return { fecha, tipo, desde: CAGLIARI, hasta };
}

test('sin traspaso -> {} (nada para decidir)', () => {
  assert.deepEqual(detectarCambioDeClub('742', null, HOY), {});
});

test('el destino del último traspaso coincide con lo guardado -> {} (al día)', () => {
  assert.deepEqual(detectarCambioDeClub('742', traspaso(GENK, '2026-08-17'), HOY), {});
});

test('traspaso reciente a un club nuevo -> aplicar', () => {
  const r = detectarCambioDeClub('490', traspaso(GENK, '2026-08-17'), HOY);
  assert.equal(r.aplicar?.nuevoClub.idExterno, '742');
  assert.equal(r.aplicar?.traspaso.fecha, '2026-08-17');
  assert.equal(r.revisar, undefined);
});

test('club guardado en null (jugador nuevo) + traspaso reciente -> aplicar', () => {
  assert.equal(detectarCambioDeClub(null, traspaso(GENK, '2026-07-01'), HOY).aplicar?.nuevoClub.idExterno, '742');
});

test('destino representativo (All-Stars) -> revisar, NO aplicar', () => {
  const r = detectarCambioDeClub('742', traspaso({ idExterno: '17664', nombre: 'Liga MX All-Stars' }, '2026-09-01'), HOY);
  assert.equal(r.aplicar, undefined);
  assert.match(r.revisar?.motivo ?? '', /representativo/);
});

test('traspaso viejo (fuera de la ventana de reciencia) -> revisar, NO aplicar', () => {
  const r = detectarCambioDeClub('490', traspaso(GENK, '2024-07-01'), HOY);
  assert.equal(r.aplicar, undefined);
  assert.match(r.revisar?.motivo ?? '', /fuera de la ventana/);
});

test('traspaso sin fecha -> revisar, NO aplicar', () => {
  const r = detectarCambioDeClub('490', traspaso(GENK, ''), HOY);
  assert.equal(r.aplicar, undefined);
  assert.match(r.revisar?.motivo ?? '', /sin fecha/);
});

test('la ventana de reciencia es configurable', () => {
  assert.equal(detectarCambioDeClub('490', traspaso(GENK, '2024-07-01'), HOY, { recienciaDias: 2000 }).aplicar?.nuevoClub.idExterno, '742');
});

test('tituloTraspaso: fichaje vs cesión, con y sin club de origen', () => {
  assert.equal(tituloTraspaso(GENK, traspaso(GENK, '2026-08-17')), 'Fichaje a Genk (desde Cagliari)');
  assert.equal(tituloTraspaso(GENK, { ...traspaso(GENK, '2026-08-17'), tipo: 'Loan' }), 'Cesión a Genk (desde Cagliari)');
  assert.equal(tituloTraspaso(GENK, { ...traspaso(GENK, '2026-08-17'), desde: null }), 'Fichaje a Genk');
});
