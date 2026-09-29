import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contarUrgencias, esAbierto, filtrarPantalla, haceCuanto, textoCreado, urgencia, visiblesPara } from './pantalla.ts';
import type { ResumenTicket } from './tipos.ts';

const HOY = '2026-09-29';
const tk = (id: string, estado: ResumenTicket['estado'], fechaLimite: string | null, creadoPor = 'felipe'): ResumenTicket => ({
  id, partidoId: 'p', jugadorId: 'j', jugadorNombre: 'Nacho', titulo: `T ${id}`, estado, creadoPor,
  creadoPorNombre: 'Felipe', inicioUtc: null, fechaLimite, partidoEliminado: false, creadoEn: '2026-09-28T12:00:00Z',
});

test('esAbierto: pendiente, en revisión y aprobado; publicado y cancelado no', () => {
  assert.equal(esAbierto('pendiente'), true);
  assert.equal(esAbierto('en_revision'), true);
  assert.equal(esAbierto('aprobado'), true);
  assert.equal(esAbierto('publicado'), false);
  assert.equal(esAbierto('cancelado'), false);
});

test('visiblesPara: Admin y Diseñador todos; CM los suyos; Prueba nada', () => {
  const l = [tk('a', 'pendiente', null, 'felipe'), tk('b', 'pendiente', null, 'pedro')];
  assert.deepEqual(visiblesPara('Administrador', 'felipe', l).map((t) => t.id), ['a', 'b']);
  assert.deepEqual(visiblesPara('Diseñador', 'maxi', l).map((t) => t.id), ['a', 'b']);
  assert.deepEqual(visiblesPara('Community Manager', 'pedro', l).map((t) => t.id), ['b']);
  assert.deepEqual(visiblesPara('Prueba', 'alexis', l), []);
});

test('urgencia: bordes de "por vencer" (0, 1, 2 días) y vencido (-1)', () => {
  assert.equal(urgencia(tk('a', 'pendiente', '2026-09-28'), HOY), 'vencido');
  assert.equal(urgencia(tk('a', 'pendiente', '2026-09-29'), HOY), 'por_vencer');
  assert.equal(urgencia(tk('a', 'en_revision', '2026-10-01'), HOY), 'por_vencer');
  assert.equal(urgencia(tk('a', 'pendiente', '2026-10-02'), HOY), 'al_dia');
});

test('urgencia: aprobado o sin fecha → al día; cerrados → null', () => {
  assert.equal(urgencia(tk('a', 'aprobado', '2026-09-01'), HOY), 'al_dia');
  assert.equal(urgencia(tk('a', 'pendiente', null), HOY), 'al_dia');
  assert.equal(urgencia(tk('a', 'publicado', '2026-09-01'), HOY), null);
  assert.equal(urgencia(tk('a', 'cancelado', '2026-09-01'), HOY), null);
});

test('contarUrgencias: solo abiertos', () => {
  const l = [
    tk('v', 'pendiente', '2026-09-20'),
    tk('p', 'en_revision', '2026-09-30'),
    tk('d', 'aprobado', null),
    tk('c', 'publicado', '2026-09-20'),
  ];
  assert.deepEqual(contarUrgencias(l, HOY), { vencido: 1, por_vencer: 1, al_dia: 1 });
});

test('filtrarPantalla: estado abiertos / cerrados / todos, respetando el orden', () => {
  const l = [tk('a', 'pendiente', null), tk('b', 'publicado', null), tk('c', 'cancelado', null), tk('d', 'aprobado', null)];
  assert.deepEqual(filtrarPantalla(l, { estado: 'abiertos', urgencia: null }, HOY).map((t) => t.id), ['a', 'd']);
  assert.deepEqual(filtrarPantalla(l, { estado: 'cerrados', urgencia: null }, HOY).map((t) => t.id), ['b', 'c']);
  assert.deepEqual(filtrarPantalla(l, { estado: 'todos', urgencia: null }, HOY).map((t) => t.id), ['a', 'b', 'c', 'd']);
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
