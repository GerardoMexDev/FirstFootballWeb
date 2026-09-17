import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarFixture, mapearEstadoSportmonks, convocadoEnLineups, extraerEstadisticaSportmonks } from './sportmonks-partido.ts';
import type { FixtureSportmonks } from './sportmonks.ts';

/** Recorte real de `/fixtures/between/.../967?include=...` (derby Atlante vs Toluca, verificado en vivo 2026-09-16). */
function fixtureTolucaDeVisitante(): FixtureSportmonks {
  return {
    id: 19715288,
    league_id: 743,
    starting_at_timestamp: 1786834800, // 2026-08-15T23:00:00Z
    state: { state: 'FT' },
    participants: [
      { id: 967, name: 'Toluca', image_path: 'https://cdn.sportmonks.com/images/soccer/teams/7/967.png', meta: { location: 'away' } },
      { id: 7023, name: 'Atlante', image_path: 'https://cdn.sportmonks.com/images/soccer/teams/9/7023.png', meta: { location: 'home' } },
    ],
    venue: { name: 'Mexico City Stadium', city_name: 'Mexico City' },
    lineups: [
      { player_id: 34907430, team_id: 967, type_id: 11, player: { display_name: 'Federico Pereira' } },
    ],
  };
}

function fixtureTolucaDeLocal(): FixtureSportmonks {
  return {
    id: 19715289,
    league_id: 743,
    starting_at_timestamp: 1786000000,
    state: { state: 'NS' },
    participants: [
      { id: 967, name: 'Toluca', meta: { location: 'home' } },
      { id: 999, name: 'Necaxa', meta: { location: 'away' } },
    ],
    venue: null,
    lineups: [],
  };
}

test('nuestro equipo de visitante: nuestroLado visitante, rival es el local', () => {
  const p = normalizarFixture(fixtureTolucaDeVisitante(), '967');
  assert.equal(p.nuestroLado, 'visitante');
  assert.equal(p.rivalId, '7023');
  assert.equal(p.rivalNombre, 'Atlante');
});

test('nuestro equipo de local: nuestroLado local, rival es el visitante', () => {
  const p = normalizarFixture(fixtureTolucaDeLocal(), '967');
  assert.equal(p.nuestroLado, 'local');
  assert.equal(p.rivalId, '999');
  assert.equal(p.rivalNombre, 'Necaxa');
});

test('extrae id de fixture, sede y convierte starting_at_timestamp a ISO UTC', () => {
  const p = normalizarFixture(fixtureTolucaDeVisitante(), '967');
  assert.equal(p.fixtureId, '19715288');
  assert.equal(p.inicioUtc, '2026-08-15T23:00:00.000Z');
  assert.equal(p.sedeNombre, 'Mexico City Stadium');
  assert.equal(p.sedeCiudad, 'Mexico City');
});

test('extrae el escudo del rival desde participants (sin llamada aparte)', () => {
  const p = normalizarFixture(fixtureTolucaDeVisitante(), '967');
  assert.equal(p.rivalEscudoUrl, 'https://cdn.sportmonks.com/images/soccer/teams/9/7023.png');
});

test('rival sin image_path: rivalEscudoUrl null, sin romper', () => {
  const evento = fixtureTolucaDeVisitante();
  delete (evento.participants![1] as { image_path?: string }).image_path;
  const p = normalizarFixture(evento, '967');
  assert.equal(p.rivalEscudoUrl, null);
});

test('sede ausente: campos en null, sin romper', () => {
  const p = normalizarFixture(fixtureTolucaDeLocal(), '967');
  assert.equal(p.sedeNombre, null);
  assert.equal(p.sedeCiudad, null);
});

test('nuestro equipo no está entre los participantes: lanza (nunca debería pasar)', () => {
  assert.throws(() => normalizarFixture(fixtureTolucaDeVisitante(), '99999'), /no aparece/i);
});

test('mapearEstadoSportmonks: NS → programado, en-juego, finalizado, suspendido', () => {
  assert.equal(mapearEstadoSportmonks('NS'), 'programado');
  assert.equal(mapearEstadoSportmonks('INPLAY_1ST_HALF'), 'en_juego');
  assert.equal(mapearEstadoSportmonks('FT'), 'finalizado');
  assert.equal(mapearEstadoSportmonks('AET'), 'finalizado');
  assert.equal(mapearEstadoSportmonks('POSTPONED'), 'suspendido');
  assert.equal(mapearEstadoSportmonks('ABANDONED'), 'suspendido');
});

test('mapearEstadoSportmonks: cancelado / desconocido / null → sin_datos (no se inventa)', () => {
  assert.equal(mapearEstadoSportmonks('CANCELLED'), 'sin_datos');
  assert.equal(mapearEstadoSportmonks('WO'), 'sin_datos');
  assert.equal(mapearEstadoSportmonks('ALGO_NUEVO_NO_CONTEMPLADO'), 'sin_datos');
  assert.equal(mapearEstadoSportmonks(null), 'sin_datos');
  assert.equal(mapearEstadoSportmonks(undefined), 'sin_datos');
});

test('convocadoEnLineups: lineups vacío → null (todavía no se publicó, no se inventa un false)', () => {
  assert.equal(convocadoEnLineups([], '34907430'), null);
  assert.equal(convocadoEnLineups(undefined, '34907430'), null);
  assert.equal(convocadoEnLineups(null, '34907430'), null);
});

test('convocadoEnLineups: jugador presente en lineups → true (titular o suplente, cualquier type_id)', () => {
  const lineups = fixtureTolucaDeVisitante().lineups!;
  assert.equal(convocadoEnLineups(lineups, '34907430'), true);
});

test('convocadoEnLineups: lineups publicado pero jugador ausente → false real, no null', () => {
  const lineups = fixtureTolucaDeVisitante().lineups!;
  assert.equal(convocadoEnLineups(lineups, '30081977'), false);
});

/** Recorte real de `/fixtures/19715288?include=lineups.details;events` (Pereira, 90'). */
function lineupPereiraTitular() {
  return {
    player_id: 34907430,
    team_id: 967,
    type_id: 11,
    details: [
      { type_id: 119, data: { value: 90 } }, // Minutes Played
      { type_id: 118, data: { value: 8.17 } }, // Rating
    ],
  };
}

function lineupSuplenteNoUsado() {
  return { player_id: 999, team_id: 967, type_id: 12, details: [] };
}

const golDePereira = { type_id: 14, player_id: 34907430, related_player_id: 37342996 };
const asistenciaDePereira = { type_id: 14, player_id: 999, related_player_id: 34907430 };
const amarillaDePereira = { type_id: 19, player_id: 34907430, related_player_id: null };
const rojaDeOtro = { type_id: 20, player_id: 999, related_player_id: null };

test('extraerEstadisticaSportmonks: minutos y rating desde details', () => {
  const e = extraerEstadisticaSportmonks(lineupPereiraTitular(), [], '34907430');
  assert.equal(e?.minutos, 90);
  assert.equal(e?.valoracion, 8.17);
  assert.equal(e?.titular, true);
});

test('extraerEstadisticaSportmonks: suplente no usado (sin minutos) → null, no cuenta el partido', () => {
  const e = extraerEstadisticaSportmonks(lineupSuplenteNoUsado(), [], '999');
  assert.equal(e, null);
});

test('extraerEstadisticaSportmonks: cuenta gol propio, ignora eventos de otro jugador', () => {
  const e = extraerEstadisticaSportmonks(lineupPereiraTitular(), [golDePereira, rojaDeOtro], '34907430');
  assert.equal(e?.goles, 1);
  assert.equal(e?.rojas, 0);
});

test('extraerEstadisticaSportmonks: asistencia = related_player_id en un evento de gol ajeno', () => {
  const e = extraerEstadisticaSportmonks(lineupPereiraTitular(), [asistenciaDePereira], '34907430');
  assert.equal(e?.asistencias, 1);
  assert.equal(e?.goles, 0);
});

test('extraerEstadisticaSportmonks: amarilla cuenta, sin eventos propios → 0 en el resto', () => {
  const e = extraerEstadisticaSportmonks(lineupPereiraTitular(), [amarillaDePereira], '34907430');
  assert.equal(e?.amarillas, 1);
  assert.equal(e?.goles, 0);
  assert.equal(e?.asistencias, 0);
  assert.equal(e?.rojas, 0);
});

test('extraerEstadisticaSportmonks: segunda amarilla (type_id 21) también cuenta como roja', () => {
  const e = extraerEstadisticaSportmonks(lineupPereiraTitular(), [{ type_id: 21, player_id: 34907430, related_player_id: null }], '34907430');
  assert.equal(e?.rojas, 1);
});

test('extraerEstadisticaSportmonks: suplente (type_id 12) que sí entró → titular false', () => {
  const lineup = { player_id: 1, team_id: 967, type_id: 12, details: [{ type_id: 119, data: { value: 20 } }] };
  const e = extraerEstadisticaSportmonks(lineup, [], '1');
  assert.equal(e?.titular, false);
  assert.equal(e?.minutos, 20);
});
