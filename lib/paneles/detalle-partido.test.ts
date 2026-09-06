import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plegarDetallePartido } from './detalle-partido.ts';
import type { PartidoProximo } from '../repositorios/tipos.ts';

/** Fila mínima de proximos_partidos con overrides. */
function fila(over: Partial<PartidoProximo>): PartidoProximo {
  return {
    partidoId: 'p1',
    jugadorId: 'j1',
    jugadorNombre: 'Jugador Uno',
    jugadorApodo: null,
    jugadorFotoUrl: null,
    jugadorSeleccion: null,
    conSeleccion: false,
    competenciaId: 'c1',
    competenciaNombre: 'Liga MX',
    competenciaCodigo: 'MX',
    competenciaTipo: 'liga',
    esInternacional: false,
    competenciaCobertura: true,
    clubId: 'club-toluca',
    clubNombre: 'Toluca',
    clubEscudoUrl: null,
    rivalId: 'club-america',
    rivalNombre: 'América',
    rivalEscudoUrl: null,
    esLocal: true,
    inicioUtc: '2026-09-10T02:00:00.000Z',
    zonaHorariaEvento: 'America/Mexico_City',
    diaUy: '2026-09-09',
    estado: 'programado',
    ronda: 'Jornada 8',
    estadio: 'Nemesio Díez',
    ciudad: 'Toluca',
    marcadorLocal: null,
    marcadorVisitante: null,
    tentativo: false,
    ...over,
  };
}

test('sin filas → null', () => {
  assert.equal(plegarDetallePartido([]), null);
});

test('1 representado de local: duelo club vs rival, representadoEsLocal true', () => {
  const d = plegarDetallePartido([fila({ esLocal: true })])!;
  assert.equal(d.local.nombre, 'Toluca');
  assert.equal(d.visitante.nombre, 'América');
  assert.equal(d.representadoEsLocal, true);
  assert.equal(d.jugadores.length, 1);
});

test('1 representado de visitante: el club queda del lado visitante', () => {
  const d = plegarDetallePartido([fila({ esLocal: false })])!;
  assert.equal(d.local.nombre, 'América');
  assert.equal(d.visitante.nombre, 'Toluca');
  assert.equal(d.representadoEsLocal, false);
});

test('es_local desconocido → representadoEsLocal null, club en el lado izquierdo', () => {
  const d = plegarDetallePartido([fila({ esLocal: null })])!;
  assert.equal(d.local.nombre, 'Toluca');
  assert.equal(d.visitante.nombre, 'América');
  assert.equal(d.representadoEsLocal, null);
});

test('2 representados en el mismo equipo: un solo duelo, dos jugadores', () => {
  const d = plegarDetallePartido([
    fila({ jugadorId: 'j1', jugadorNombre: 'Ana' }),
    fila({ jugadorId: 'j2', jugadorNombre: 'Beto' }),
  ])!;
  assert.equal(d.local.nombre, 'Toluca');
  assert.equal(d.representadoEsLocal, true);
  assert.deepEqual(d.jugadores.map((j) => j.nombre), ['Ana', 'Beto']);
});

test('derby entre dos representados: duelo entre sus clubes, representadoEsLocal null', () => {
  const d = plegarDetallePartido([
    fila({ jugadorId: 'j1', jugadorNombre: 'Fede', clubNombre: 'Toluca', esLocal: true }),
    fila({
      jugadorId: 'j2',
      jugadorNombre: 'Martín',
      clubNombre: 'Atlante',
      clubId: 'club-atlante',
      esLocal: false,
      rivalNombre: 'Toluca',
    }),
  ])!;
  assert.equal(d.local.nombre, 'Toluca');
  assert.equal(d.visitante.nombre, 'Atlante');
  assert.equal(d.representadoEsLocal, null);
  assert.deepEqual(d.jugadores.map((j) => `${j.nombre}/${j.clubNombre}`), [
    'Fede/Toluca',
    'Martín/Atlante',
  ]);
});

test('jugador repetido en varias filas se cuenta una vez', () => {
  const d = plegarDetallePartido([fila({ jugadorId: 'j1' }), fila({ jugadorId: 'j1' })])!;
  assert.equal(d.jugadores.length, 1);
});

test('conserva competencia, sede, ronda y hora del partido', () => {
  const d = plegarDetallePartido([fila({})])!;
  assert.equal(d.competenciaNombre, 'Liga MX');
  assert.equal(d.estadio, 'Nemesio Díez');
  assert.equal(d.ronda, 'Jornada 8');
  assert.equal(d.inicioUtc, '2026-09-10T02:00:00.000Z');
  assert.equal(d.zonaHorariaEvento, 'America/Mexico_City');
});
