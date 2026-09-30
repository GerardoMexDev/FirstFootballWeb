/**
 * Tests de la lógica pura del calendario. Runner nativo de Node (incluido en `npm test`).
 * Football First (Fase 1). Creado 2026-09-05.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { agruparPorDia, partidosPorMes, celdasDelMes, filtrarCalendario, quitarSeleccionDuplicada, unirEventos, type EventoCalendario } from './eventos.ts';

function ev(p: Partial<EventoCalendario>): EventoCalendario {
  const base = {
    fuente: 'partido' as const, refId: null, titulo: 'x', diaUy: '2026-09-09',
    cuandoUtc: null, competenciaCodigo: null, esInternacional: false, tentativo: false,
    ...p,
  };
  // `diaLocalSede` por defecto sigue a `diaUy` salvo que el test lo fije aparte.
  return { diaLocalSede: base.diaUy, ...base };
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

test('agruparPorDia ubica el partido por diaLocalSede, no por diaUy', () => {
  // Partido del viernes en la sede que en Uruguay ya es sábado.
  const eventos = [
    ev({ fuente: 'partido', refId: 'p1', titulo: 'Atlante vs Pachuca', diaUy: '2026-09-12', diaLocalSede: '2026-09-11' }),
    ev({ fuente: 'cumpleanos', titulo: 'Zulma', diaUy: '2026-09-11', diaLocalSede: '2026-09-11' }),
  ];
  const porDia = agruparPorDia(eventos);
  assert.equal(porDia.get('2026-09-11')?.length, 2);
  assert.equal(porDia.has('2026-09-12'), false);
});

test('partidosPorMes cuenta por el mes de diaLocalSede', () => {
  // Partido que en la sede es 31/08 pero en Uruguay 01/09 → cuenta en agosto.
  const c = partidosPorMes([ev({ fuente: 'partido', refId: 'x', diaUy: '2026-09-01', diaLocalSede: '2026-08-31' })], 2026);
  assert.equal(c[7], 1); // agosto
  assert.equal(c[8], 0); // septiembre
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

test('unirEventos + filtrarCalendario: sin duplicados; Match Day solo partidos MD; Contenido fechas y partidos de Contenido', () => {
  const md = [
    ev({ fuente: 'partido', refId: 'p1', diaUy: '2026-10-03', grupo: 'matchday' }),
    ev({ fuente: 'cumpleanos', refId: 'j1', diaUy: '2026-10-01', grupo: 'matchday' }), // ya está en Contenido
  ];
  const co = [
    ev({ fuente: 'cumpleanos', refId: 'j1', diaUy: '2026-10-01', grupo: 'contenido' }),
    ev({ fuente: 'partido', refId: 'p9', diaUy: '2026-10-10', grupo: 'contenido' }),
  ];
  const todos = unirEventos(md, co);
  assert.deepEqual(todos.map((e) => `${e.fuente}:${e.refId}`), ['partido:p1', 'cumpleanos:j1', 'partido:p9']);
  assert.deepEqual(filtrarCalendario(todos, 'matchday').map((e) => e.refId), ['p1']);
  assert.deepEqual(filtrarCalendario(todos, 'contenido').map((e) => e.refId).sort(), ['j1', 'p9']);
  assert.equal(filtrarCalendario(todos, 'todos').length, 3);
});

test('unirEventos: la fecha fija de un jugador solo de Match Day no se pierde y va a Contenido', () => {
  const md = [
    ev({ fuente: 'cumpleanos', refId: 'j1', diaUy: '2026-10-01', grupo: 'matchday' }), // también en Contenido
    ev({ fuente: 'cumpleanos', refId: 'j2', diaUy: '2026-10-02', grupo: 'matchday' }), // solo Match Day
  ];
  const co = [ev({ fuente: 'cumpleanos', refId: 'j1', diaUy: '2026-10-01', grupo: 'contenido' })];
  const todos = unirEventos(md, co);
  assert.deepEqual(todos.map((e) => e.refId).sort(), ['j1', 'j2']);
  assert.deepEqual(filtrarCalendario(todos, 'contenido').map((e) => e.refId).sort(), ['j1', 'j2']);
  assert.deepEqual(filtrarCalendario(todos, 'matchday'), []);
});

test('filtrarCalendario("seleccion") y Todos; un partido de Uruguay ya en Match Day no se repite en Todos', () => {
  const eventos = [
    ev({ fuente: 'partido', refId: 'm1', titulo: 'Uruguay vs India', diaUy: '2026-10-06', grupo: 'matchday' }),
    ev({ fuente: 'partido', refId: 's1', titulo: 'Uruguay vs India', diaUy: '2026-10-06', grupo: 'seleccion' }),
    ev({ fuente: 'partido', refId: 's2', titulo: 'Uruguay vs Chile', diaUy: '2026-11-12', grupo: 'seleccion' }),
    ev({ fuente: 'cumpleanos', refId: 'j1', diaUy: '2026-10-06', grupo: 'contenido' }),
  ];
  assert.deepEqual(filtrarCalendario(eventos, 'seleccion').map((e) => e.refId), ['s1', 's2']);
  assert.deepEqual(quitarSeleccionDuplicada(eventos).map((e) => e.refId), ['m1', 's2', 'j1']);
  assert.deepEqual(filtrarCalendario(eventos, 'matchday').map((e) => e.refId), ['m1']);
});
