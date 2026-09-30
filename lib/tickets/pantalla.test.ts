import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contarUrgencias, esAbierto, esUrgenteHoy, filtrarPantalla, haceCuanto, ordenarPantalla, textoCreado, urgencia, visiblesPara } from './pantalla.ts';
import type { ResumenTicket } from './tipos.ts';

const HOY = '2026-09-29';
const tk = (id: string, estado: ResumenTicket['estado'], fechaLimite: string | null, creadoPor = 'felipe'): ResumenTicket => ({
  id, partidoId: 'p', jugadorId: 'j', jugadorNombre: 'Nacho', titulo: `T ${id}`, estado, creadoPor,
  creadoPorNombre: 'Felipe', inicioUtc: null, fechaLimite, partidoEliminado: false, creadoEn: '2026-09-28T12:00:00Z', fechaEvento: null, motivo: null,
});

test('esAbierto: solo pendiente (0030: completado = publicado)', () => {
  assert.equal(esAbierto('pendiente'), true);
  assert.equal(esAbierto('publicado'), false);
  assert.equal(esAbierto('cancelado'), false);
});

test('visiblesPara: Admin y Diseñador todos; CM los suyos y los automáticos; Prueba nada', () => {
  const l = [tk('a', 'pendiente', null, 'felipe'), tk('b', 'pendiente', null, 'pedro'), { ...tk('md', 'pendiente', null, ''), automatico: true }];
  assert.deepEqual(visiblesPara('Administrador', 'felipe', l).map((t) => t.id), ['a', 'b', 'md']);
  assert.deepEqual(visiblesPara('Diseñador', 'maxi', l).map((t) => t.id), ['a', 'b', 'md']);
  assert.deepEqual(visiblesPara('Community Manager', 'pedro', l).map((t) => t.id), ['b', 'md']);
  assert.deepEqual(visiblesPara('Prueba', 'alexis', l), []);
});

test('urgencia: bordes de "por vencer" (0, 1, 2 días) y vencido (-1)', () => {
  assert.equal(urgencia(tk('a', 'pendiente', '2026-09-28'), HOY), 'vencido');
  assert.equal(urgencia(tk('a', 'pendiente', '2026-09-29'), HOY), 'por_vencer');
  assert.equal(urgencia(tk('a', 'pendiente', '2026-10-01'), HOY), 'por_vencer');
  assert.equal(urgencia(tk('a', 'pendiente', '2026-10-02'), HOY), 'al_dia');
});

test('urgencia: sin fecha → al día; completados y cancelados → null', () => {
  assert.equal(urgencia(tk('a', 'pendiente', null), HOY), 'al_dia');
  assert.equal(urgencia(tk('a', 'publicado', '2026-09-01'), HOY), null);
  assert.equal(urgencia(tk('a', 'cancelado', '2026-09-01'), HOY), null);
});

test('contarUrgencias: solo abiertos', () => {
  const l = [
    tk('v', 'pendiente', '2026-09-20'),
    tk('p', 'pendiente', '2026-09-30'),
    tk('d', 'pendiente', null),
    tk('c', 'publicado', '2026-09-20'),
  ];
  assert.deepEqual(contarUrgencias(l, HOY), { vencido: 1, por_vencer: 1, al_dia: 1 });
});

test('filtrarPantalla: abiertos (pendientes) / completados / todos, respetando el orden', () => {
  const l = [tk('a', 'pendiente', null), tk('b', 'publicado', null), tk('c', 'cancelado', null)];
  assert.deepEqual(filtrarPantalla(l, { estado: 'abiertos', urgencia: null }, HOY).map((t) => t.id), ['a']);
  assert.deepEqual(filtrarPantalla(l, { estado: 'completados', urgencia: null }, HOY).map((t) => t.id), ['b']);
  assert.deepEqual(filtrarPantalla(l, { estado: 'todos', urgencia: null }, HOY).map((t) => t.id), ['a', 'b', 'c']);
});

test('esUrgenteHoy: vencido o por vencer', () => {
  const u = esUrgenteHoy(HOY);
  assert.equal(u(tk('a', 'pendiente', '2026-09-28')), true);
  assert.equal(u(tk('a', 'pendiente', '2026-10-01')), true);
  assert.equal(u(tk('a', 'pendiente', '2026-10-10')), false);
  assert.equal(u(tk('a', 'publicado', '2026-09-28')), false);
});

test('filtrarPantalla: con urgencia solo entran abiertos de esa urgencia (un cerrado vencido no)', () => {
  const l = [tk('v', 'pendiente', '2026-09-20'), tk('c', 'publicado', '2026-09-20'), tk('x', 'pendiente', '2026-10-20')];
  assert.deepEqual(filtrarPantalla(l, { estado: 'todos', urgencia: 'vencido' }, HOY).map((t) => t.id), ['v']);
});

test('haceCuanto: hoy, ayer, días, semanas, meses (día de Uruguay)', () => {
  const ahora = '2026-09-29T15:00:00Z';
  assert.equal(haceCuanto('2026-09-29T13:00:00Z', ahora), 'hoy');
  assert.equal(haceCuanto('2026-09-28T13:00:00Z', ahora), 'ayer');
  assert.equal(haceCuanto('2026-09-26T13:00:00Z', ahora), 'hace 3 días');
  assert.equal(haceCuanto('2026-09-08T13:00:00Z', ahora), 'hace 3 semanas');
  assert.equal(haceCuanto('2026-07-20T13:00:00Z', ahora), 'hace 2 meses');
  // 01:30 UTC del 29 = 22:30 del 28 en Uruguay → "ayer", no "hoy"
  assert.equal(haceCuanto('2026-09-29T01:30:00Z', ahora), 'ayer');
});

test('textoCreado: con y sin nombre del creador', () => {
  const ahora = '2026-09-29T15:00:00Z';
  assert.equal(textoCreado(tk('a', 'pendiente', null), ahora), 'Creado por Felipe · ayer');
  assert.equal(textoCreado({ ...tk('a', 'pendiente', null), creadoPorNombre: null }, ahora), 'Creado por alguien del equipo · ayer');
});

test('ordenarPantalla: pendientes por fecha límite (sin fecha al final); después el resto del más nuevo al más viejo', () => {
  const l = [
    { ...tk('c1', 'publicado', '2026-09-01'), creadoEn: '2026-09-10T00:00:00Z' },
    tk('p2', 'pendiente', '2026-10-05'),
    tk('p0', 'pendiente', null),
    { ...tk('c2', 'publicado', '2026-09-01'), creadoEn: '2026-09-20T00:00:00Z' },
    tk('p1', 'pendiente', '2026-09-30'),
  ];
  assert.deepEqual(ordenarPantalla(l).map((t) => t.id), ['p1', 'p2', 'p0', 'c2', 'c1']);
});
