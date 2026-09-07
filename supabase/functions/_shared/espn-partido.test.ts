import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarEvento, nombreRivalDesdeName, mapearEstadoEspn } from './espn-partido.ts';

/**
 * Fixtures recortados de respuestas reales de `sports.core.api.espn.com`
 * (`/leagues/<slug>/events/<id>`). Solo los campos que consume `normalizarEvento`.
 */
function eventoGenkDeVisitante() {
  return {
    id: '401879035',
    date: '2026-08-09T14:00Z',
    name: 'Racing Genk at Zulte-Waregem',
    competitions: [
      {
        venue: { fullName: 'Elindus Arena', address: { city: 'Waregem', country: 'Belgium' } },
        status: { $ref: 'http://x/events/401879035/competitions/401879035/status?lang=en' },
        competitors: [
          { id: '4691', homeAway: 'home', team: {} },
          { id: '938', homeAway: 'away', team: {} },
        ],
      },
    ],
  };
}

function eventoGenkDeLocal() {
  return {
    id: '401879041',
    date: '2026-08-15T18:45Z',
    name: 'KVC Westerlo at Racing Genk',
    competitions: [
      {
        venue: { fullName: 'Cegeka Arena', address: { city: 'Genk', country: 'Belgium' } },
        status: { $ref: 'http://x/status' },
        competitors: [
          { id: '938', homeAway: 'home', team: {} },
          { id: '2727', homeAway: 'away', team: {} },
        ],
      },
    ],
  };
}

test('nuestro equipo de visitante: nuestroLado visitante, rival es el local', () => {
  const p = normalizarEvento(eventoGenkDeVisitante(), '938');
  assert.equal(p.nuestroLado, 'visitante');
  assert.equal(p.rivalEspnId, '4691');
  assert.equal(p.rivalNombre, 'Zulte-Waregem');
});

test('nuestro equipo de local: nuestroLado local, rival es el visitante', () => {
  const p = normalizarEvento(eventoGenkDeLocal(), '938');
  assert.equal(p.nuestroLado, 'local');
  assert.equal(p.rivalEspnId, '2727');
  assert.equal(p.rivalNombre, 'KVC Westerlo');
});

test('extrae id de evento, instante UTC y sede', () => {
  const p = normalizarEvento(eventoGenkDeVisitante(), '938');
  assert.equal(p.eventoId, '401879035');
  assert.equal(p.inicioUtc, '2026-08-09T14:00Z');
  assert.equal(p.sedeNombre, 'Elindus Arena');
  assert.equal(p.sedeCiudad, 'Waregem');
  assert.equal(p.sedePais, 'Belgium');
});

test('extrae el $ref del estado (se resuelve aparte con otra llamada)', () => {
  const p = normalizarEvento(eventoGenkDeVisitante(), '938');
  assert.equal(p.statusRef, 'http://x/events/401879035/competitions/401879035/status?lang=en');
});

test('sede ausente: campos en null, sin romper', () => {
  const evento = eventoGenkDeVisitante();
  delete (evento.competitions[0] as { venue?: unknown }).venue;
  const p = normalizarEvento(evento, '938');
  assert.equal(p.sedeNombre, null);
  assert.equal(p.sedeCiudad, null);
  assert.equal(p.sedePais, null);
});

test('nuestro equipo no está en el partido: lanza (nunca debería pasar)', () => {
  assert.throws(() => normalizarEvento(eventoGenkDeVisitante(), '99999'), /no aparece/i);
});

test('name sin " at " reconocible: rivalNombre null (el orquestador lo resuelve por otra vía)', () => {
  const evento = eventoGenkDeVisitante();
  evento.name = 'Racing Genk vs Zulte-Waregem';
  const p = normalizarEvento(evento, '938');
  assert.equal(p.rivalNombre, null);
});

test('nombreRivalDesdeName: "{visitante} at {local}"', () => {
  assert.equal(nombreRivalDesdeName('Al Qadsiah at Neom SC', 'visitante'), 'Neom SC');
  assert.equal(nombreRivalDesdeName('Al Qadsiah at Neom SC', 'local'), 'Al Qadsiah');
});

test('nombreRivalDesdeName: sin " at " → null', () => {
  assert.equal(nombreRivalDesdeName('Al Qadsiah vs Neom SC', 'local'), null);
  assert.equal(nombreRivalDesdeName('', 'local'), null);
});

test('nombreRivalDesdeName: nombre de club que contiene " at " no rompe el resto', () => {
  // Formato ESPN siempre "{visitante} at {local}"; se corta en el ÚLTIMO " at ".
  assert.equal(nombreRivalDesdeName('Team at Work at Bayer Leverkusen', 'visitante'), 'Bayer Leverkusen');
  assert.equal(nombreRivalDesdeName('Team at Work at Bayer Leverkusen', 'local'), 'Team at Work');
});

test('mapearEstadoEspn: pre → programado, in → en_juego, post completo → finalizado', () => {
  assert.equal(mapearEstadoEspn({ state: 'pre', completed: false, name: 'STATUS_SCHEDULED' }), 'programado');
  assert.equal(mapearEstadoEspn({ state: 'in', completed: false, name: 'STATUS_FIRST_HALF' }), 'en_juego');
  assert.equal(mapearEstadoEspn({ state: 'post', completed: true, name: 'STATUS_FULL_TIME' }), 'finalizado');
});

test('mapearEstadoEspn: post sin completar → suspendido si es aplazado/abandonado', () => {
  assert.equal(mapearEstadoEspn({ state: 'post', completed: false, name: 'STATUS_POSTPONED' }), 'suspendido');
  assert.equal(mapearEstadoEspn({ state: 'post', completed: false, name: 'STATUS_ABANDONED' }), 'suspendido');
});

test('mapearEstadoEspn: cancelado o estado desconocido → sin_datos (no se inventa)', () => {
  assert.equal(mapearEstadoEspn({ state: 'post', completed: false, name: 'STATUS_CANCELED' }), 'sin_datos');
  assert.equal(mapearEstadoEspn({ state: 'unknown', completed: false, name: '' }), 'sin_datos');
  assert.equal(mapearEstadoEspn(null), 'sin_datos');
});
