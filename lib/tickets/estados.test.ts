import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoMasUrgente, resumirPorPartido, META_ESTADO } from './estados.ts';
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
