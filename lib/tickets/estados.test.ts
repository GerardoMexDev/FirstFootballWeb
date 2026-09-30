import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoMasUrgente, resumirPorPartido, META_ESTADO, TEXTO_ALERTA, alertasPorPartido, alertasPorTarjeta, ticketsPorDia, alertasPorTicket, alertaDe } from './estados.ts';
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

test('alertasPorPartido: "Vencido" le gana a "Vence pronto" en el mismo partido; completados no', () => {
  const HOY = '2026-10-05';
  const a = alertasPorPartido([
    { ...t('a', 'p1', 'pendiente'), fechaLimite: '2026-10-06' },
    { ...t('b', 'p1', 'pendiente'), fechaLimite: '2026-10-01' },
    { ...t('c', 'p2', 'pendiente'), fechaLimite: '2026-10-07' },
    { ...t('d', 'p3', 'publicado'), fechaLimite: '2026-10-01' },
    { ...t('e', 'p4', 'pendiente'), fechaLimite: '2026-10-20' },
  ], HOY);
  assert.deepEqual(a, { p1: 'Vencido', p2: 'Vence pronto' });
});

test('TEXTO_ALERTA: vencido y por vencer', () => {
  assert.deepEqual(TEXTO_ALERTA, { vencido: 'Vencido', por_vencer: 'Vence pronto' });
});

const ev = (id: string, fechaEvento: string | null, estado: ResumenTicket['estado']): ResumenTicket => ({
  ...t(id, null, estado), partidoEliminado: false, fechaEvento, motivo: fechaEvento ? 'Cumpleaños' : null,
});

test('ticketsPorDia: agrupa por fecha del evento; sin fecha o cancelados no entran', () => {
  const r = ticketsPorDia([ev('a', '2026-10-01', 'pendiente'), ev('b', '2026-10-01', 'aprobado'), ev('c', '2026-10-05', 'cancelado'), ev('d', null, 'pendiente')]);
  assert.deepEqual(Object.keys(r), ['2026-10-01']);
  assert.deepEqual(r['2026-10-01'].map((x) => x.id), ['a', 'b']);
});

test('alertasPorTicket: texto por id, solo tickets de fecha pendientes y urgentes', () => {
  const HOY = '2026-10-05';
  const a = alertasPorTicket([
    { ...ev('a', '2026-10-03', 'pendiente'), fechaLimite: '2026-10-01' },
    { ...ev('b', '2026-10-08', 'pendiente'), fechaLimite: '2026-10-06' },
    { ...ev('c', '2026-10-03', 'publicado'), fechaLimite: '2026-10-01' },
    { ...t('d', 'p1', 'pendiente'), fechaLimite: '2026-10-01' },
  ], HOY);
  assert.deepEqual(a, { a: 'Vencido', b: 'Vence pronto' });
});

test('alertaDe: texto de la lucecita para un ticket (vencido / vence pronto / nada)', () => {
  const HOY = '2026-10-05';
  assert.equal(alertaDe({ ...t('a', 'p1', 'pendiente'), fechaLimite: '2026-10-01' }, HOY), 'Vencido');
  assert.equal(alertaDe({ ...t('a', 'p1', 'pendiente'), fechaLimite: '2026-10-07' }, HOY), 'Vence pronto');
  assert.equal(alertaDe({ ...t('a', 'p1', 'pendiente'), fechaLimite: '2026-10-20' }, HOY), undefined);
  assert.equal(alertaDe({ ...t('a', 'p1', 'publicado'), fechaLimite: '2026-10-01' }, HOY), undefined);
});

test('alertasPorTarjeta: con dos jugadores en el partido, la alerta es de cada uno', () => {
  const HOY = '2026-10-05';
  const a = alertasPorTarjeta([
    { ...t('a', 'p1', 'publicado'), jugadorId: 'jA', fechaLimite: '2026-10-01' },
    { ...t('b', 'p1', 'pendiente'), jugadorId: 'jB', fechaLimite: '2026-10-01' },
  ], HOY);
  assert.deepEqual(a, { 'p1:jB': 'Vencido' });
});
