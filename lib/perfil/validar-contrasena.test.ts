import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarContrasena, MINIMO_CARACTERES } from './validar-contrasena.ts';

test('válida cuando tiene 8+ y coinciden', () => {
  assert.deepEqual(validarContrasena('unaclave8', 'unaclave8'), { ok: true });
});

test('rechaza si es corta, aunque coincidan', () => {
  const r = validarContrasena('corta1', 'corta1');
  assert.equal(r.ok, false);
  assert.match(r.mensaje ?? '', /8 caracteres/);
});

test('exactamente el mínimo pasa', () => {
  assert.equal(validarContrasena('a'.repeat(MINIMO_CARACTERES), 'a'.repeat(MINIMO_CARACTERES)).ok, true);
});

test('rechaza si no coinciden', () => {
  const r = validarContrasena('unaclave8', 'unaclave9');
  assert.equal(r.ok, false);
  assert.match(r.mensaje ?? '', /no coinciden/);
});

test('el chequeo de largo va primero (corta y distinta → mensaje de largo)', () => {
  assert.match(validarContrasena('abc', 'xyz').mensaje ?? '', /8 caracteres/);
});
