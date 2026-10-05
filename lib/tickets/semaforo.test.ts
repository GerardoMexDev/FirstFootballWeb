import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoVisual, estadosPorPartidoJugador, peorEstado, ticketsPorPartidoJugador } from './semaforo.ts';
import type { ResumenTicket } from './tipos.ts';

const HOY = '2026-10-05';
const tk = (estado: ResumenTicket['estado'], fechaLimite: string | null): ResumenTicket => ({
  id: 't', partidoId: 'p', jugadorId: 'j', jugadorNombre: 'N', titulo: 'T', estado, creadoPor: '', creadoPorNombre: null,
  inicioUtc: null, fechaLimite, partidoEliminado: false, creadoEn: '2026-10-01T00:00:00Z', fechaEvento: null, motivo: null,
});

test('estadoVisual: publicado → completado; pendiente vencido → vencido; pendiente al día → pendiente; cancelado → cancelado (0040)', () => {
  assert.equal(estadoVisual(tk('publicado', '2026-10-01'), HOY), 'completado');
  assert.equal(estadoVisual(tk('pendiente', '2026-10-04'), HOY), 'vencido');
  assert.equal(estadoVisual(tk('pendiente', '2026-10-05'), HOY), 'pendiente');
  assert.equal(estadoVisual(tk('pendiente', null), HOY), 'pendiente');
  assert.equal(estadoVisual(tk('cancelado', '2026-10-01'), HOY), 'cancelado');
});

test('peorEstado: vencido > pendiente > completado > cancelado; sin estados → null', () => {
  assert.equal(peorEstado(['cancelado', 'completado']), 'completado');
  assert.equal(peorEstado(['cancelado']), 'cancelado');
  assert.equal(peorEstado(['completado', 'vencido', 'pendiente']), 'vencido');
  assert.equal(peorEstado(['completado', 'pendiente']), 'pendiente');
  assert.equal(peorEstado(['completado', null]), 'completado');
  assert.equal(peorEstado([null]), null);
});

test('estadosPorPartidoJugador: clave partido:jugador → semáforo; sin partido no entra; cancelado entra en gris (0040)', () => {
  const a = { ...tk('pendiente', '2026-10-01'), partidoId: 'p1', jugadorId: 'j1' };
  const b = { ...tk('publicado', '2026-10-01'), partidoId: 'p1', jugadorId: 'j2' };
  const c = { ...tk('cancelado', '2026-10-01'), partidoId: 'p2', jugadorId: 'j1' };
  const d = { ...tk('pendiente', '2026-10-09'), partidoId: null, jugadorId: 'j3' };
  assert.deepEqual(estadosPorPartidoJugador([a, b, c, d], HOY), { 'p1:j1': 'vencido', 'p1:j2': 'completado', 'p2:j1': 'cancelado' });
});

test('ticketsPorPartidoJugador: clave partido:jugador → ticket; sin partido no entra (0040)', () => {
  const a = { ...tk('pendiente', '2026-10-03'), partidoId: 'p1', jugadorId: 'j1', ultimoMomento: true };
  const b = { ...tk('pendiente', '2026-10-01'), partidoId: 'p2', jugadorId: 'j1', ultimoMomento: false };
  const c = { ...tk('pendiente', '2026-10-01'), partidoId: null, jugadorId: 'j2', ultimoMomento: true };
  assert.deepEqual(ticketsPorPartidoJugador([a, b, c]), { 'p1:j1': a, 'p2:j1': b });
});
