import test from 'node:test';
import assert from 'node:assert/strict';
import { clubActualSportmonks, detectarCambioSportmonks, type EquipoDeJugadorSM } from './roster-sportmonks.ts';

const HOY = '2026-09-30';
const eq = (id: number, nombre: string, tipo: string, start: string | null, end: string | null): EquipoDeJugadorSM => ({
  team_id: id,
  start,
  end,
  team: { name: nombre, type: tipo },
});

test('clubActualSportmonks: el club doméstico vigente hoy (ignora la selección)', () => {
  const r = clubActualSportmonks([eq(609, 'Tigres UANL', 'domestic', '2026-02-06', '2029-12-31'), eq(1, 'Uruguay', 'national', '2024-11-16', null)], HOY);
  assert.deepEqual(r, { smId: '609', nombre: 'Tigres UANL', desde: '2026-02-06' });
});

test('clubActualSportmonks: con dos vigentes (cesión) gana el de inicio más reciente', () => {
  const r = clubActualSportmonks([eq(10, 'Club dueño', 'domestic', '2024-01-01', '2028-06-30'), eq(20, 'Club cedido', 'domestic', '2026-07-01', '2027-06-30')], HOY);
  assert.equal(r?.smId, '20');
});

test('clubActualSportmonks: contratos vencidos o que empiezan después de hoy no cuentan; sin datos → null', () => {
  assert.equal(clubActualSportmonks([eq(10, 'Viejo', 'domestic', '2020-01-01', '2025-06-30')], HOY), null);
  assert.equal(clubActualSportmonks([eq(10, 'Futuro', 'domestic', '2027-01-01', null)], HOY), null);
  assert.equal(clubActualSportmonks([], HOY), null);
  assert.equal(clubActualSportmonks(null, HOY), null);
});

test('clubActualSportmonks: sin fecha de fin = vigente', () => {
  assert.equal(clubActualSportmonks([eq(3338, 'Peñarol', 'domestic', '2026-01-01', null)], HOY)?.smId, '3338');
});

test('detectarCambioSportmonks: mismo club → igual', () => {
  const r = detectarCambioSportmonks('609', { smId: '609', nombre: 'Tigres UANL', desde: '2026-02-06' });
  assert.deepEqual(r, { estado: 'igual' });
});

test('detectarCambioSportmonks: club distinto → cambio con destino y fecha', () => {
  const r = detectarCambioSportmonks('7808', { smId: '1024', nombre: 'Flamengo', desde: '2026-08-01' });
  assert.deepEqual(r, { estado: 'cambio', hacia: 'Flamengo', haciaSmId: '1024', desde: '2026-08-01' });
});

test('detectarCambioSportmonks: SportMonks sin club vigente → sin_dato; nuestro club sin código → sin_codigo', () => {
  assert.deepEqual(detectarCambioSportmonks('609', null), { estado: 'sin_dato' });
  assert.deepEqual(detectarCambioSportmonks(null, { smId: '609', nombre: 'Tigres UANL', desde: null }), { estado: 'sin_codigo', actual: 'Tigres UANL' });
});
