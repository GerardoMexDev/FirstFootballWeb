import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import {
  filtrarFechas,
  hastaFechas,
  mezclarPorDia,
  normalizarFechas,
  textoCantidades,
  type FechaContenido,
} from './fechas-contenido.ts';
import type { PartidoProximo } from '../repositorios/tipos.ts';

// Fecha fija: los tests no dependen del día en que se corren.
const hoy = DateTime.fromISO('2026-09-28', { zone: 'utc' });
const dia = (n: number) => hoy.plus({ days: n }).toISODate()!;

function partido(id: string, diaN: number | null, extra: Partial<PartidoProximo> = {}): PartidoProximo {
  return {
    partidoId: id,
    jugadorId: 'j1',
    diaLocalSede: diaN === null ? null : dia(diaN),
    diaUy: diaN === null ? null : dia(diaN),
    esInternacional: false,
    ...extra,
  } as PartidoProximo;
}

const fecha = (fuente: FechaContenido['fuente'], diaN: number, titulo: string, refId = titulo): FechaContenido => ({
  fuente,
  refId,
  titulo,
  dia: dia(diaN),
});

test('hastaFechas: el día del último partido', () => {
  assert.equal(hastaFechas([partido('a', 2), partido('b', 40), partido('c', 10)], dia(0)), dia(40));
});

test('hastaFechas: sin partidos → hoy + 60', () => {
  assert.equal(hastaFechas([], dia(0)), dia(60));
  assert.equal(hastaFechas([partido('s', null)], dia(0)), dia(60));
});

test('normalizarFechas: quita repetidos y ordena por día y después por fuente', () => {
  const r = normalizarFechas([
    fecha('aniversario_club', 1, 'Aniversario de Nacional'),
    fecha('cumpleanos', 1, 'Cumpleaños de Aguirre'),
    fecha('cumpleanos', 0, 'Cumpleaños de Silvera'),
    fecha('cumpleanos', 1, 'Cumpleaños de Aguirre'),
  ]);
  assert.deepEqual(
    r.map((f) => f.titulo),
    ['Cumpleaños de Silvera', 'Cumpleaños de Aguirre', 'Aniversario de Nacional'],
  );
});

test('filtrarFechas: Todos / Fechas → todas', () => {
  const fs = [fecha('cumpleanos', 0, 'a'), fecha('cumpleanos', 30, 'b')];
  assert.equal(filtrarFechas(fs, 'todos', dia(0)).length, 2);
  assert.equal(filtrarFechas(fs, 'fechas', dia(0)).length, 2);
});

test('filtrarFechas: Hoy / Esta semana por día (ayer no entra en "hoy")', () => {
  const fs = [fecha('cumpleanos', -1, 'ayer'), fecha('cumpleanos', 0, 'hoy'), fecha('cumpleanos', 6, 'seis'), fecha('cumpleanos', 7, 'siete')];
  assert.deepEqual(filtrarFechas(fs, 'hoy', dia(0)).map((f) => f.titulo), ['hoy']);
  assert.deepEqual(filtrarFechas(fs, 'semana', dia(0)).map((f) => f.titulo), ['ayer', 'hoy', 'seis']);
});

test('filtrarFechas: Internacional / Con hito → ninguna', () => {
  const fs = [fecha('cumpleanos', 0, 'a')];
  assert.deepEqual(filtrarFechas(fs, 'int', dia(0)), []);
  assert.deepEqual(filtrarFechas(fs, 'hito', dia(0)), []);
});

test('mezclarPorDia: agrupa por día, en orden, partidos primero y "sin fecha" al final', () => {
  const grupos = mezclarPorDia(
    [partido('p2', 2), partido('sf', null), partido('p0', 0)],
    [fecha('cumpleanos', 1, 'solo fecha'), fecha('cumpleanos', 2, 'mismo día')],
  );
  assert.deepEqual(
    grupos.map((g) => [g.dia, g.partidos.map((p) => p.partidoId), g.fechas.map((f) => f.titulo)]),
    [
      [dia(0), ['p0'], []],
      [dia(1), [], ['solo fecha']],
      [dia(2), ['p2'], ['mismo día']],
      ['sin-fecha', ['sf'], []],
    ],
  );
});

test('textoCantidades', () => {
  assert.equal(textoCantidades(86, 24), '86 partidos · 24 fechas');
  assert.equal(textoCantidades(1, 1), '1 partido · 1 fecha');
  assert.equal(textoCantidades(0, 3), '3 fechas');
  assert.equal(textoCantidades(2, 0), '2 partidos');
  assert.equal(textoCantidades(0, 0), '0 partidos');
});

test('filtrarFechas: Match Day → ninguna; Contenido → todas', () => {
  const fs = [fecha('cumpleanos', 0, 'a'), fecha('cumpleanos', 10, 'b')];
  assert.deepEqual(filtrarFechas(fs, 'matchday', dia(0)), []);
  assert.equal(filtrarFechas(fs, 'contenido', dia(0)).length, 2);
});
