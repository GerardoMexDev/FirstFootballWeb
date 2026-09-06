import { test } from 'node:test';
import assert from 'node:assert/strict';
import { datosParaContenido } from './datos-contenido.ts';

// hoy fijo para que los cálculos sean deterministas
const HOY = '2026-09-06';

test('edad: años cumplidos entre nacimiento y hoy', () => {
  // nació el 28/12/1995 → el 06/09/2026 todavía tiene 30 (cumple 31 en diciembre)
  const d = datosParaContenido({ fechaNacimiento: '1995-12-28' }, HOY);
  assert.equal(d.edad, 30);
});

test('edad: el día del cumpleaños ya cuenta el año nuevo', () => {
  const d = datosParaContenido({ fechaNacimiento: '2004-09-06' }, HOY);
  assert.equal(d.edad, 22);
});

test('cumpleLegible: día y mes en español, sin año', () => {
  const d = datosParaContenido({ fechaNacimiento: '1995-12-28' }, HOY);
  assert.equal(d.cumpleLegible, '28 de diciembre');
});

test('años en el club: un decimal', () => {
  // fichó el 06/03/2026 → ~0.5 años al 06/09/2026
  const d = datosParaContenido({ fichaje: '2026-03-06' }, HOY);
  assert.equal(d.aniosEnClub, 0.5);
});

test('años de carrera: entero redondeado', () => {
  const d = datosParaContenido({ debut: '2018-09-22' }, HOY);
  assert.equal(d.aniosDeCarrera, 8);
});

test('campos ausentes → null, nunca 0 ni NaN', () => {
  const d = datosParaContenido({}, HOY);
  assert.equal(d.edad, null);
  assert.equal(d.cumpleLegible, null);
  assert.equal(d.aniosEnClub, null);
  assert.equal(d.aniosDeCarrera, null);
});

test('fecha en el futuro (dato cargado mal) → null, no un número negativo', () => {
  const d = datosParaContenido({ fechaNacimiento: '2030-01-01', fichaje: '2031-01-01', debut: '2040-01-01' }, HOY);
  assert.equal(d.edad, null);
  assert.equal(d.aniosEnClub, null);
  assert.equal(d.aniosDeCarrera, null);
});

test('fecha inválida → null (no rompe)', () => {
  const d = datosParaContenido({ fechaNacimiento: 'no-es-fecha' }, HOY);
  assert.equal(d.edad, null);
  assert.equal(d.cumpleLegible, null);
});
