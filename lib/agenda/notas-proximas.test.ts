/**
 * Tests de `notasProximas` — se corren con el runner nativo de Node (sin dependencias):
 *   node --test lib/agenda/notas-proximas.test.ts   (o: npm test)
 *
 * Football First (Fase 1). Creado 2026-09-05.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { notasProximas, type EventoAgenda } from './notas-proximas.ts';

const HOY = '2026-09-05';

function ev(diaUy: string, fuente: EventoAgenda['fuente'] = 'cumpleanos', titulo = 'x'): EventoAgenda {
  return { fuente, titulo, diaUy };
}

test('incluye un evento a 10 días y NO lo marca urgente', () => {
  const [n] = notasProximas([ev('2026-09-15')], HOY);
  assert.equal(n.diasFalta, 10);
  assert.equal(n.urgente, false);
});

test('marca urgente a 7 días o menos', () => {
  assert.equal(notasProximas([ev('2026-09-12')], HOY)[0].urgente, true); // 7
  assert.equal(notasProximas([ev('2026-09-11')], HOY)[0].urgente, true); // 6
});

test('excluye lo que cae fuera de la ventana de 10 días', () => {
  assert.equal(notasProximas([ev('2026-09-16')], HOY).length, 0); // 11 días
});

test('excluye lo que ya pasó (ayer) y cuenta hoy como día 0 urgente', () => {
  assert.equal(notasProximas([ev('2026-09-04')], HOY).length, 0);
  const hoy = notasProximas([ev('2026-09-05')], HOY)[0];
  assert.equal(hoy.diasFalta, 0);
  assert.equal(hoy.urgente, true);
});

test('ignora fuentes que no son de fecha fija (partido, convocatoria, hito)', () => {
  const eventos = [ev('2026-09-08', 'partido'), ev('2026-09-08', 'convocatoria'), ev('2026-09-08', 'hito')];
  assert.equal(notasProximas(eventos, HOY).length, 0);
});

test('acepta las 3 fuentes de fecha fija', () => {
  const eventos = [
    ev('2026-09-08', 'cumpleanos'),
    ev('2026-09-09', 'aniversario_club'),
    ev('2026-09-10', 'aniversario_seleccion'),
  ];
  assert.equal(notasProximas(eventos, HOY).length, 3);
});

test('ordena de la más cercana a la más lejana, y por título a igualdad de días', () => {
  const eventos = [ev('2026-09-12', 'cumpleanos', 'Zeta'), ev('2026-09-08', 'cumpleanos', 'B'), ev('2026-09-08', 'cumpleanos', 'A')];
  assert.deepEqual(
    notasProximas(eventos, HOY).map((n) => n.titulo),
    ['A', 'B', 'Zeta'],
  );
});

test('la ventana es configurable', () => {
  assert.equal(notasProximas([ev('2026-09-20')], HOY, { dias: 15 }).length, 1);
  assert.equal(notasProximas([ev('2026-09-09')], HOY, { urgenteDias: 3 })[0].urgente, false);
});
