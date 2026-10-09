import { test } from 'node:test';
import assert from 'node:assert/strict';
import { puedeVerConteo, totalizar, type DisenoContado } from './conteo-disenos.ts';

const d = (tipo: DisenoContado['tipo'], jugadorId: string, jugadorNombre: string): DisenoContado => ({
  tipo, completadoDia: '2026-10-10', jugadorId, jugadorNombre, titulo: 'T', completadoPorNombre: 'Maxi',
});

test('totalizar: Match Day + pedidos, y por jugador de más a menos', () => {
  const t = totalizar([d('matchday', 'a', 'Fede'), d('matchday', 'b', 'Nacho'), d('pedido', 'a', 'Fede'), d('matchday', 'a', 'Fede')]);
  assert.equal(t.matchday, 3);
  assert.equal(t.pedidos, 1);
  assert.equal(t.total, 4);
  assert.deepEqual(t.porJugador, [
    { jugadorNombre: 'Fede', matchday: 2, pedidos: 1, total: 3 },
    { jugadorNombre: 'Nacho', matchday: 1, pedidos: 0, total: 1 },
  ]);
  assert.deepEqual(totalizar([]), { matchday: 0, pedidos: 0, total: 0, porJugador: [] });
});

test('puedeVerConteo: solo Administrador y Diseñador', () => {
  assert.equal(puedeVerConteo('Administrador'), true);
  assert.equal(puedeVerConteo('Diseñador'), true);
  assert.equal(puedeVerConteo('Community Manager'), false);
  assert.equal(puedeVerConteo('Prueba'), false);
  assert.equal(puedeVerConteo(null), false);
});
