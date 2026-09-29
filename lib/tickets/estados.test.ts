import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoMasUrgente, resumirPorPartido, META_ESTADO, TEXTO_ALERTA, alertasPorPartido, ticketsPorDia, alertasPorTicket } from './estados.ts';
import type { ResumenTicket } from './tipos.ts';

const t = (id: string, partidoId: string | null, estado: ResumenTicket['estado']): ResumenTicket => ({
  id,
  partidoId,
  jugadorId: 'j',
  jugadorNombre: 'Nández',
  titulo: `Ticket ${id}`,
  estado,
  creadoPor: 'u',
  creadoPorNombre: 'Felipe',
  inicioUtc: null,
  fechaLimite: null,
  partidoEliminado: partidoId === null,
  creadoEn: '2026-09-28T12:00:00Z',
  fechaEvento: null,
  motivo: null,
});

test('estadoMasUrgente: pendiente > en_revision > aprobado > publicado; cancelado no cuenta', () => {
  assert.equal(estadoMasUrgente(['publicado', 'en_revision', 'aprobado']), 'en_revision');
  assert.equal(estadoMasUrgente(['aprobado', 'pendiente']), 'pendiente');
  assert.equal(estadoMasUrgente(['publicado']), 'publicado');
  assert.equal(estadoMasUrgente(['cancelado']), null);
  assert.equal(estadoMasUrgente([]), null);
});

test('resumirPorPartido: agrupa por partido, ignora cancelados y tickets sin partido', () => {
  const r = resumirPorPartido([
    t('1', 'p1', 'publicado'),
    t('2', 'p1', 'pendiente'),
    t('3', 'p2', 'cancelado'),
    t('4', null, 'pendiente'),
    t('5', 'p3', 'aprobado'),
  ]);
  assert.deepEqual(r, {
    p1: { estado: 'pendiente', ticketIds: ['1', '2'] },
    p3: { estado: 'aprobado', ticketIds: ['5'] },
  });
});

test('META_ESTADO: cada estado tiene etiqueta, versión corta y símbolo (no solo color)', () => {
  for (const m of Object.values(META_ESTADO)) {
    assert.ok(m.etiqueta && m.corta && m.simbolo);
  }
});

test('alertasPorPartido: un texto por partido según lo que hay que hacer', () => {
  const a = alertasPorPartido([t('a', 'p1', 'pendiente'), t('b', 'p2', 'en_revision'), t('c', 'p3', 'aprobado')]);
  assert.deepEqual(a, { p1: 'Ticket pendiente', p2: 'Para revisar', p3: 'Para publicar' });
});

test('alertasPorPartido: con dos tickets en un partido manda el más urgente; sin partido no alerta', () => {
  assert.equal(alertasPorPartido([t('a', 'p1', 'aprobado'), t('b', 'p1', 'pendiente')]).p1, 'Ticket pendiente');
  assert.deepEqual(alertasPorPartido([t('a', null, 'pendiente')]), {});
});

test('TEXTO_ALERTA: solo los estados en los que alguien tiene que actuar', () => {
  assert.deepEqual(Object.keys(TEXTO_ALERTA).sort(), ['aprobado', 'en_revision', 'pendiente']);
});

const ev = (id: string, fechaEvento: string | null, estado: ResumenTicket['estado']): ResumenTicket => ({
  ...t(id, null, estado), partidoEliminado: false, fechaEvento, motivo: fechaEvento ? 'Cumpleaños' : null,
});

test('ticketsPorDia: agrupa por fecha del evento; sin fecha o cancelados no entran', () => {
  const r = ticketsPorDia([ev('a', '2026-10-01', 'pendiente'), ev('b', '2026-10-01', 'aprobado'), ev('c', '2026-10-05', 'cancelado'), ev('d', null, 'pendiente')]);
  assert.deepEqual(Object.keys(r), ['2026-10-01']);
  assert.deepEqual(r['2026-10-01'].map((x) => x.id), ['a', 'b']);
});

test('alertasPorTicket: texto por id, solo tickets de fecha', () => {
  assert.deepEqual(alertasPorTicket([ev('a', '2026-10-01', 'pendiente'), ev('b', '2026-10-02', 'en_revision'), t('c', 'p1', 'pendiente')]), {
    a: 'Ticket pendiente',
    b: 'Para revisar',
  });
});
