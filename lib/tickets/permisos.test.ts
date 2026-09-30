import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accionesPermitidas, debeActuar, pendientesDe, puedeCrear } from './permisos.ts';
import { esUrgenteHoy } from './pantalla.ts';
import type { ResumenTicket } from './tipos.ts';

test('puedeCrear: solo Administrador y Community Manager', () => {
  assert.equal(puedeCrear('Administrador'), true);
  assert.equal(puedeCrear('Community Manager'), true);
  assert.equal(puedeCrear('Diseñador'), false);
  assert.equal(puedeCrear('Prueba'), false);
});

test('accionesPermitidas: Diseñador completa (pendiente) y reabre (completado); creador/Admin cancelan pendiente; comentan', () => {
  assert.deepEqual(accionesPermitidas({ cargo: 'Diseñador', esCreador: false, estado: 'pendiente' }), ['completar', 'comentar']);
  assert.deepEqual(accionesPermitidas({ cargo: 'Diseñador', esCreador: false, estado: 'publicado' }), ['reabrir', 'comentar']);
  assert.deepEqual(accionesPermitidas({ cargo: 'Administrador', esCreador: false, estado: 'pendiente' }), ['cancelar', 'comentar']);
  assert.deepEqual(accionesPermitidas({ cargo: 'Community Manager', esCreador: true, estado: 'pendiente' }), ['cancelar', 'comentar']);
  assert.deepEqual(accionesPermitidas({ cargo: 'Community Manager', esCreador: false, estado: 'pendiente' }), ['comentar']);
  assert.deepEqual(accionesPermitidas({ cargo: 'Prueba', esCreador: false, estado: 'pendiente' }), []);
});

const r = (id: string, estado: ResumenTicket['estado'], creadoPor: string, fechaLimite: string | null): ResumenTicket => ({
  id, partidoId: 'p', jugadorId: 'j', jugadorNombre: 'N', titulo: id, estado, creadoPor,
  creadoPorNombre: null, inicioUtc: null, fechaLimite, partidoEliminado: false, creadoEn: '2026-09-28T12:00:00Z', fechaEvento: null, motivo: null,
});

test('pendientesDe: solo vencidos y por vencer; CM ve sus manuales y todos los automáticos; Prueba nada', () => {
  const HOY = '2026-10-05';
  const l = [
    r('v', 'pendiente', 'felipe', '2026-10-01'), // vencido
    r('p', 'pendiente', 'pedro', '2026-10-06'), // por vencer
    r('a', 'pendiente', 'felipe', '2026-10-20'), // al día → no
    r('c', 'publicado', 'felipe', '2026-10-01'), // completado → no
    { ...r('md', 'pendiente', '', '2026-10-04'), automatico: true }, // automático vencido
  ];
  assert.deepEqual(pendientesDe('Diseñador', 'maxi', l, esUrgenteHoy(HOY)).map((x) => x.id), ['v', 'md', 'p']);
  assert.deepEqual(pendientesDe('Administrador', 'felipe', l, esUrgenteHoy(HOY)).map((x) => x.id), ['v', 'md', 'p']);
  assert.deepEqual(pendientesDe('Community Manager', 'pedro', l, esUrgenteHoy(HOY)).map((x) => x.id), ['md', 'p']);
  assert.deepEqual(pendientesDe('Prueba', 'alexis', l, esUrgenteHoy(HOY)), []);
});

test('debeActuar: igual criterio que pendientesDe para un ticket', () => {
  assert.equal(debeActuar('Diseñador', 'maxi', r('v', 'pendiente', 'felipe', '2026-10-01'), esUrgenteHoy('2026-10-05')), true);
  assert.equal(debeActuar('Diseñador', 'maxi', r('a', 'pendiente', 'felipe', '2026-10-20'), esUrgenteHoy('2026-10-05')), false);
});
