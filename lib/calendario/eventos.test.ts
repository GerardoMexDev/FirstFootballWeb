/**
 * Tests de la lógica pura del calendario. Runner nativo de Node (incluido en `npm test`).
 * Football First (Fase 1). Creado 2026-09-05.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { agruparPorDia, partidosPorMes, celdasDelMes, type EventoCalendario } from './eventos.ts';

function ev(p: Partial<EventoCalendario>): EventoCalendario {
  return {
    fuente: 'partido', refId: null, titulo: 'x', diaUy: '2026-09-09',
    cuandoUtc: null, competenciaCodigo: null, esInternacional: false, tentativo: false,
    ...p,
  };
}

test('agruparPorDia deduplica partidos por refId dentro del mismo día', () => {
  const eventos = [
    ev({ fuente: 'partido', refId: 'p1', titulo: 'A vs B', diaUy: '2026-09-09' }),
    ev({ fuente: 'partido', refId: 'p1', titulo: 'A vs B', diaUy: '2026-09-09' }), // 2º representado
    ev({ fuente: 'aniversario_seleccion', refId: 'j1', titulo: 'Aniv Kevin', diaUy: '2026-09-09' }),
  ];
  const porDia = agruparPorDia(eventos);
  assert.equal(porDia.get('2026-09-09')?.length, 2); // el partido una sola vez + el aniversario
});

test('agruparPorDia ordena: con hora primero, después por título', () => {
  const eventos = [
    ev({ fuente: 'cumpleanos', titulo: 'Zulma', diaUy: '2026-09-10' }),
    ev({ fuente: 'cumpleanos', titulo: 'Ana', diaUy: '2026-09-10' }),
    ev({ fuente: 'partido', refId: 'p9', titulo: 'Match', diaUy: '2026-09-10', cuandoUtc: '2026-09-10T18:00:00Z' }),
  ];
  assert.deepEqual(agruparPorDia(eventos).get('2026-09-10')?.map((e) => e.titulo), ['Match', 'Ana', 'Zulma']);
});

test('partidosPorMes cuenta solo partidos del año, deduplicados, por mes (0-index -> mes real)', () => {
  const eventos = [
    ev({ fuente: 'partido', refId: 'a', diaUy: '2026-09-05' }),
    ev({ fuente: 'partido', refId: 'a', diaUy: '2026-09-05' }),
    ev({ fuente: 'partido', refId: 'b', diaUy: '2026-09-20' }),
    ev({ fuente: 'partido', refId: 'c', diaUy: '2026-03-01' }),
    ev({ fuente: 'partido', refId: 'd', diaUy: '2025-09-01' }), // otro año
    ev({ fuente: 'cumpleanos', refId: 'j', diaUy: '2026-09-09' }), // no es partido
  ];
  const c = partidosPorMes(eventos, 2026);
  assert.equal(c[8], 2); // septiembre
  assert.equal(c[2], 1); // marzo
  assert.equal(c.reduce((s, n) => s + n, 0), 3);
});

test('celdasDelMes: 42 celdas, empieza el lunes, marca delMes y esHoy', () => {
  // Septiembre 2026: el 1 cae martes -> la grilla empieza el lunes 31/08.
  const celdas = celdasDelMes(2026, 8, '2026-09-09');
  assert.equal(celdas.length, 42);
  assert.equal(celdas[0].fecha, '2026-08-31');
  assert.equal(celdas[0].delMes, false);
  assert.equal(celdas[1].fecha, '2026-09-01');
  assert.equal(celdas[1].delMes, true);
  const hoy = celdas.find((c) => c.fecha === '2026-09-09');
  assert.equal(hoy?.esHoy, true);
  assert.equal(hoy?.dia, 9);
});
