import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buscar, normalizar } from './indexar.ts';
import type { JugadorPlantel, PartidoProximo } from '../repositorios/tipos.ts';

function jugador(over: Partial<JugadorPlantel>): JugadorPlantel {
  return {
    id: 'j1',
    nombre: 'Nahitan Nández',
    apodo: 'Nahitan',
    dorsal: 8,
    posicion: 'Mediocampista',
    nacionalidad: 'Uruguay',
    seleccion: 'Uruguay',
    fotoUrl: null,
    clubNombre: 'Al-Qadisiyah FC',
    clubEscudoUrl: null,
    clubPais: 'Arabia Saudita',
    carreraPartidos: 388,
    carreraGoles: 28,
    carreraAsistencias: 53,
    ...over,
  };
}

function partido(over: Partial<PartidoProximo>): PartidoProximo {
  return {
    partidoId: 'p1',
    jugadorId: 'j1',
    jugadorNombre: 'Nahitan Nández',
    jugadorApodo: 'Nahitan',
    jugadorFotoUrl: null,
    jugadorSeleccion: null,
    conSeleccion: false,
    competenciaId: 'c1',
    competenciaNombre: 'Saudi Pro League',
    competenciaCodigo: 'SPL',
    competenciaTipo: 'liga',
    esInternacional: false,
    competenciaCobertura: true,
    clubId: 'club-a',
    clubNombre: 'Al-Qadisiyah FC',
    clubEscudoUrl: null,
    rivalId: 'club-b',
    rivalNombre: 'Al-Hilal',
    rivalEscudoUrl: null,
    esLocal: true,
    inicioUtc: '2026-09-12T17:00:00.000Z',
    zonaHorariaEvento: 'Asia/Riyadh',
    diaUy: '2026-09-12',
    estado: 'programado',
    ronda: 'Jornada 4',
    estadio: 'Kingdom Arena',
    ciudad: 'Riad',
    marcadorLocal: null,
    marcadorVisitante: null,
    tentativo: false,
    ...over,
  };
}

test('normalizar: saca acentos y mayúsculas', () => {
  assert.equal(normalizar('  Nández  '), 'nandez');
  assert.equal(normalizar('MÉXICO'), 'mexico');
});

test('consulta vacía → sin jugadores, primeros 5 próximos partidos, vacia=true', () => {
  const partidos = [1, 2, 3, 4, 5, 6, 7].map((n) => partido({ partidoId: `p${n}` }));
  const r = buscar('  ', [jugador({})], partidos);
  assert.equal(r.vacia, true);
  assert.equal(r.jugadores.length, 0);
  assert.deepEqual(r.partidos.map((p) => p.partidoId), ['p1', 'p2', 'p3', 'p4', 'p5']);
});

test('jugador por nombre, sin acento en la consulta', () => {
  const r = buscar('nandez', [jugador({})], []);
  assert.equal(r.jugadores.length, 1);
  assert.equal(r.vacia, false);
});

test('jugador por club y por país', () => {
  assert.equal(buscar('qadisiyah', [jugador({})], []).jugadores.length, 1);
  assert.equal(buscar('arabia', [jugador({})], []).jugadores.length, 1);
});

test('partido por rival, competencia, estadio y ciudad', () => {
  const p = [partido({})];
  assert.equal(buscar('hilal', [], p).partidos.length, 1);
  assert.equal(buscar('saudi pro', [], p).partidos.length, 1);
  assert.equal(buscar('spl', [], p).partidos.length, 1);
  assert.equal(buscar('kingdom', [], p).partidos.length, 1);
  assert.equal(buscar('riad', [], p).partidos.length, 1);
});

test('partidos se deduplican por partidoId (una fila por representado)', () => {
  const r = buscar('qadisiyah', [], [
    partido({ partidoId: 'p1', jugadorId: 'j1' }),
    partido({ partidoId: 'p1', jugadorId: 'j2' }),
  ]);
  assert.equal(r.partidos.length, 1);
});

test('tope de 8 partidos en los resultados', () => {
  const partidos = Array.from({ length: 12 }, (_, i) => partido({ partidoId: `p${i}` }));
  assert.equal(buscar('qadisiyah', [], partidos).partidos.length, 8);
});

test('sin coincidencias → ambos vacíos, vacia=false', () => {
  const r = buscar('zzz', [jugador({})], [partido({})]);
  assert.equal(r.jugadores.length, 0);
  assert.equal(r.partidos.length, 0);
  assert.equal(r.vacia, false);
});
