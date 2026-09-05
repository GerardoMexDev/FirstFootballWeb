/**
 * Tests de `extraerLineaJugador`. Runner nativo de Node (incluido en `npm test`):
 *   node --test supabase/functions/_shared/estadisticas.test.ts
 *
 * Football First (Fase 1). Creado 2026-09-05.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { extraerLineaJugador } from './estadisticas.ts';

/** Respuesta mínima de /fixtures/players con un jugador y sus statistics. */
function fixturePlayers(playerId: number, stats: Record<string, unknown>): unknown[] {
  return [
    {
      team: { id: 1, name: 'A' },
      players: [{ player: { id: playerId, name: 'X' }, statistics: [stats] }],
    },
  ];
}

test('titular que jugó 90, marcó 1, sin tarjetas', () => {
  const r = extraerLineaJugador(
    fixturePlayers(6122, { games: { minutes: 90, substitute: false, rating: '7.4' }, goals: { total: 1, assists: null }, cards: { yellow: null, red: null } }),
    '6122',
  );
  assert.deepEqual(r, {
    convocado: true,
    jugo: true,
    estadistica: { minutos: 90, goles: 1, asistencias: 0, amarillas: 0, rojas: 0, titular: true, valoracion: 7.4 },
  });
});

test('null en goles/asistencias/tarjetas => 0 (el jugador tiene línea)', () => {
  const r = extraerLineaJugador(
    fixturePlayers(10, { games: { minutes: 62, substitute: true, rating: null }, goals: { total: null, assists: null }, cards: { yellow: null, red: null } }),
    '10',
  );
  assert.equal(r?.estadistica?.goles, 0);
  assert.equal(r?.estadistica?.asistencias, 0);
  assert.equal(r?.estadistica?.titular, false); // entró desde el banco
  assert.equal(r?.estadistica?.valoracion, null); // rating sí es "sin dato"
});

test('suplente no usado (minutos null): convocado pero sin fila de estadística', () => {
  const r = extraerLineaJugador(
    fixturePlayers(10, { games: { minutes: null, substitute: true, rating: null }, goals: {}, cards: {} }),
    '10',
  );
  assert.deepEqual(r, { convocado: true, jugo: false, estadistica: null });
});

test('minutos 0 cuenta como no jugó', () => {
  const r = extraerLineaJugador(fixturePlayers(10, { games: { minutes: 0, substitute: true } }), '10');
  assert.equal(r?.jugo, false);
  assert.equal(r?.estadistica, null);
});

test('jugador que no figura en el partido => null', () => {
  assert.equal(extraerLineaJugador(fixturePlayers(6122, { games: { minutes: 90 } }), '999'), null);
  assert.equal(extraerLineaJugador([], '6122'), null);
});

test('busca en todos los equipos del partido', () => {
  const resp = [
    { team: { id: 1 }, players: [{ player: { id: 1 }, statistics: [{ games: { minutes: 90 } }] }] },
    { team: { id: 2 }, players: [{ player: { id: 51549 }, statistics: [{ games: { minutes: 45, substitute: false }, goals: { total: 2 } }] }] },
  ];
  const r = extraerLineaJugador(resp, '51549');
  assert.equal(r?.estadistica?.minutos, 45);
  assert.equal(r?.estadistica?.goles, 2);
});

test('id se compara como string (la API lo da number, jugadores.id_externo es text)', () => {
  const r = extraerLineaJugador(fixturePlayers(2614, { games: { minutes: 90 } }), '2614');
  assert.equal(r?.jugo, true);
});
