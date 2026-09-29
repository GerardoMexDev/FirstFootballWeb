import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mensajeError } from './errores.ts';

test('mensajes de la base (español, con mayúscula) se muestran tal cual', () => {
  assert.equal(
    mensajeError({ message: 'Solo el Diseñador puede hacer esto.', code: '42501' }),
    'Solo el Diseñador puede hacer esto.',
  );
  assert.equal(
    mensajeError({ message: 'El ticket cambió de estado (ahora está "aprobado"). Recargá para ver lo último.', code: 'P0001' }),
    'El ticket cambió de estado (ahora está "aprobado"). Recargá para ver lo último.',
  );
});

test('errores técnicos en inglés → mensaje genérico en español', () => {
  assert.equal(mensajeError({ message: 'permission denied for function ticket_crear', code: '42501' }), 'No tenés permiso para hacer esto.');
  assert.equal(mensajeError({ message: 'Failed to fetch' }), 'No se pudo completar. Revisá la conexión y probá de nuevo.');
  assert.equal(mensajeError({ message: 'Could not find the function', code: 'PGRST202' }), 'Esta función todavía no está disponible. Avisale a Gerardo.');
  assert.equal(mensajeError(null), 'No se pudo completar. Probá de nuevo.');
});
