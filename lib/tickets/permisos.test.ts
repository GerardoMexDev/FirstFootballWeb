import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accionesPermitidas, debeActuar, pendientesDe, puedeCrear } from './permisos.ts';
import type { ResumenTicket } from './tipos.ts';

test('puedeCrear: solo Administrador y Community Manager', () => {
  assert.equal(puedeCrear('Administrador'), true);
  assert.equal(puedeCrear('Community Manager'), true);
  assert.equal(puedeCrear('Diseñador'), false);
  assert.equal(puedeCrear('Prueba'), false);
});

test('Diseñador: entregar en pendiente, publicar en aprobado, siempre comentar', () => {
  const d = (estado: ResumenTicket['estado']) => accionesPermitidas({ cargo: 'Diseñador', esCreador: false, estado });
  assert.deepEqual(d('pendiente'), ['entregar', 'comentar']);
  assert.deepEqual(d('en_revision'), ['comentar']);
  assert.deepEqual(d('aprobado'), ['publicar', 'comentar']);
  assert.deepEqual(d('publicado'), ['comentar']);
});

test('Revisor: creador CM o cualquier Admin aprueba/devuelve en revisión y cancela en pendiente', () => {
  assert.deepEqual(
    accionesPermitidas({ cargo: 'Community Manager', esCreador: true, estado: 'en_revision' }),
    ['aprobar', 'devolver', 'comentar'],
  );
  assert.deepEqual(
    accionesPermitidas({ cargo: 'Administrador', esCreador: false, estado: 'pendiente' }),
    ['cancelar', 'comentar'],
  );
  assert.deepEqual(
    accionesPermitidas({ cargo: 'Community Manager', esCreador: false, estado: 'en_revision' }),
    ['comentar'],
  );
});

test('Prueba: ninguna acción', () => {
  assert.deepEqual(accionesPermitidas({ cargo: 'Prueba', esCreador: false, estado: 'pendiente' }), []);
});

const r = (id: string, estado: ResumenTicket['estado'], creadoPor: string, fechaLimite: string | null): ResumenTicket => ({
  id, partidoId: 'p', jugadorId: 'j', jugadorNombre: 'N', titulo: id, estado, creadoPor,
  creadoPorNombre: null, inicioUtc: null, fechaLimite, partidoEliminado: false, creadoEn: '2026-09-28T12:00:00Z', fechaEvento: null, motivo: null,
});

test('pendientesDe: qué le toca a cada cargo, ordenado por fecha límite (sin fecha al final)', () => {
  const lista = [
    r('a', 'pendiente', 'felipe', '2026-10-05'),
    r('b', 'en_revision', 'pedro', '2026-10-01'),
    r('c', 'aprobado', 'felipe', null),
    r('d', 'en_revision', 'felipe', '2026-09-30'),
    r('e', 'pendiente', 'pedro', '2026-09-29'),
    r('f', 'publicado', 'felipe', '2026-09-20'),
  ];
  assert.deepEqual(pendientesDe('Diseñador', 'maxi', lista).map((x) => x.id), ['e', 'a', 'c']);
  assert.deepEqual(pendientesDe('Community Manager', 'pedro', lista).map((x) => x.id), ['b']);
  assert.deepEqual(pendientesDe('Administrador', 'felipe', lista).map((x) => x.id), ['d', 'b']);
  assert.deepEqual(pendientesDe('Prueba', 'alexis', lista), []);
});

test('pendientesDe: un pendiente huérfano (partido borrado) lo ve quien puede cancelarlo', () => {
  const huerfano = (id: string, creadoPor: string): ResumenTicket => ({
    ...r(id, 'pendiente', creadoPor, '2026-10-02'),
    partidoId: null,
    partidoEliminado: true,
  });
  const lista = [huerfano('h1', 'pedro'), huerfano('h2', 'felipe'), r('n', 'pendiente', 'pedro', '2026-10-03')];
  assert.deepEqual(pendientesDe('Administrador', 'felipe', lista).map((x) => x.id), ['h1', 'h2']);
  assert.deepEqual(pendientesDe('Community Manager', 'pedro', lista).map((x) => x.id), ['h1']);
  assert.deepEqual(pendientesDe('Community Manager', 'otro', lista), []);
  assert.deepEqual(pendientesDe('Diseñador', 'maxi', lista).map((x) => x.id), ['h1', 'h2', 'n']);
});

test('debeActuar: el Diseñador actúa en pendiente y aprobado, no en revisión', () => {
  assert.equal(debeActuar('Diseñador', 'maxi', r('a', 'pendiente', 'felipe', null)), true);
  assert.equal(debeActuar('Diseñador', 'maxi', r('a', 'aprobado', 'felipe', null)), true);
  assert.equal(debeActuar('Diseñador', 'maxi', r('a', 'en_revision', 'felipe', null)), false);
});

test('debeActuar: el CM revisa solo lo suyo; el Admin revisa todo; Prueba nunca', () => {
  assert.equal(debeActuar('Community Manager', 'pedro', r('a', 'en_revision', 'pedro', null)), true);
  assert.equal(debeActuar('Community Manager', 'pedro', r('a', 'en_revision', 'felipe', null)), false);
  assert.equal(debeActuar('Administrador', 'felipe', r('a', 'en_revision', 'pedro', null)), true);
  assert.equal(debeActuar('Prueba', 'alexis', r('a', 'pendiente', 'felipe', null)), false);
});

test('debeActuar: publicado y cancelado no le tocan a nadie', () => {
  assert.equal(debeActuar('Administrador', 'felipe', r('a', 'publicado', 'felipe', null)), false);
  assert.equal(debeActuar('Diseñador', 'maxi', r('a', 'cancelado', 'felipe', null)), false);
});

test('pendientesDe: un ticket de fecha (0028) no es huérfano — el CM no lo ve si está pendiente', () => {
  const deFecha: ResumenTicket = { ...r('f', 'pendiente', 'pedro', '2026-10-01'), partidoId: null, partidoEliminado: false, fechaEvento: '2026-10-03', motivo: 'Cumpleaños' };
  assert.deepEqual(pendientesDe('Community Manager', 'pedro', [deFecha]), []);
  assert.deepEqual(pendientesDe('Diseñador', 'maxi', [deFecha]).map((x) => x.id), ['f']);
});
