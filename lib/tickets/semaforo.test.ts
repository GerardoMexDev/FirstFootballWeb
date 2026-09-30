import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoVisual, peorEstado } from './semaforo.ts';
import type { ResumenTicket } from './tipos.ts';

const HOY = '2026-10-05';
const tk = (estado: ResumenTicket['estado'], fechaLimite: string | null): ResumenTicket => ({
  id: 't', partidoId: 'p', jugadorId: 'j', jugadorNombre: 'N', titulo: 'T', estado, creadoPor: '', creadoPorNombre: null,
  inicioUtc: null, fechaLimite, partidoEliminado: false, creadoEn: '2026-10-01T00:00:00Z', fechaEvento: null, motivo: null,
});

test('estadoVisual: publicado → completado; pendiente vencido → vencido; pendiente al día → pendiente; cancelado → null', () => {
  assert.equal(estadoVisual(tk('publicado', '2026-10-01'), HOY), 'completado');
  assert.equal(estadoVisual(tk('pendiente', '2026-10-04'), HOY), 'vencido');
  assert.equal(estadoVisual(tk('pendiente', '2026-10-05'), HOY), 'pendiente');
  assert.equal(estadoVisual(tk('pendiente', null), HOY), 'pendiente');
  assert.equal(estadoVisual(tk('cancelado', '2026-10-01'), HOY), null);
});

test('peorEstado: vencido > pendiente > completado; sin estados → null', () => {
  assert.equal(peorEstado(['completado', 'vencido', 'pendiente']), 'vencido');
  assert.equal(peorEstado(['completado', 'pendiente']), 'pendiente');
  assert.equal(peorEstado(['completado', null]), 'completado');
  assert.equal(peorEstado([null]), null);
});
