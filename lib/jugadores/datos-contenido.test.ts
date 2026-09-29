import { test } from 'node:test';
import assert from 'node:assert/strict';
import { datosParaContenido, proximasFechas, proximoAniversario, textoFecha } from './datos-contenido.ts';

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

test('meses en el club: entero, para los fichajes recientes', () => {
  // fichó el 06/03/2026 → 6 meses exactos al 06/09/2026
  assert.equal(datosParaContenido({ fichaje: '2026-03-06' }, HOY).mesesEnClub, 6);
  // fichó hace ~3 semanas → 1 mes redondeado
  assert.equal(datosParaContenido({ fichaje: '2026-08-18' }, HOY).mesesEnClub, 1);
});

test('años de carrera: entero redondeado', () => {
  const d = datosParaContenido({ debut: '2018-09-22' }, HOY);
  assert.equal(d.aniosDeCarrera, 8);
});

test('años desde el debut con la selección: entero redondeado', () => {
  const d = datosParaContenido({ debutSeleccion: '2020-09-09' }, HOY);
  assert.equal(d.aniosDeSeleccion, 6);
});

test('fechas legibles: día, mes y año en español — para saber qué se festeja', () => {
  const d = datosParaContenido(
    { fichaje: '2026-03-06', debut: '2018-09-22', debutSeleccion: '2020-09-09' },
    HOY,
  );
  assert.equal(d.fichajeLegible, '6 de marzo de 2026');
  assert.equal(d.debutLegible, '22 de septiembre de 2018');
  assert.equal(d.debutSeleccionLegible, '9 de septiembre de 2020');
});

test('campos ausentes → null, nunca 0 ni NaN', () => {
  const d = datosParaContenido({}, HOY);
  assert.equal(d.edad, null);
  assert.equal(d.cumpleLegible, null);
  assert.equal(d.aniosEnClub, null);
  assert.equal(d.mesesEnClub, null);
  assert.equal(d.aniosDeCarrera, null);
  assert.equal(d.aniosDeSeleccion, null);
  assert.equal(d.fichajeLegible, null);
  assert.equal(d.debutLegible, null);
  assert.equal(d.debutSeleccionLegible, null);
});

test('fecha en el futuro (dato cargado mal) → null, no un número negativo', () => {
  const d = datosParaContenido(
    { fechaNacimiento: '2030-01-01', fichaje: '2031-01-01', debut: '2040-01-01', debutSeleccion: '2040-01-01' },
    HOY,
  );
  assert.equal(d.edad, null);
  assert.equal(d.aniosEnClub, null);
  assert.equal(d.mesesEnClub, null);
  assert.equal(d.aniosDeCarrera, null);
  assert.equal(d.aniosDeSeleccion, null);
});

test('textoFecha: fecha + años entre paréntesis', () => {
  assert.equal(textoFecha('9 de septiembre de 2020', 6), '9 de septiembre de 2020 (6 años)');
});

test('textoFecha: sin años, solo la fecha', () => {
  assert.equal(textoFecha('9 de septiembre de 2020', null), '9 de septiembre de 2020');
});

test('textoFecha: sin fecha → "Sin datos"', () => {
  assert.equal(textoFecha(null, null), 'Sin datos');
});

test('fecha inválida → null (no rompe)', () => {
  const d = datosParaContenido({ fechaNacimiento: 'no-es-fecha' }, HOY);
  assert.equal(d.edad, null);
  assert.equal(d.cumpleLegible, null);
});

test('proximoAniversario: si el día del año todavía no pasó, es este año', () => {
  assert.equal(proximoAniversario('1990-12-28', '2026-09-06'), '2026-12-28');
});

test('proximoAniversario: si ya pasó este año, es el que viene', () => {
  assert.equal(proximoAniversario('1990-03-16', '2026-09-06'), '2027-03-16');
});

test('proximoAniversario: hoy mismo cuenta como la próxima ocurrencia', () => {
  assert.equal(proximoAniversario('2000-09-06', '2026-09-06'), '2026-09-06');
});

test('proximoAniversario: fecha vacía, null o inválida → null', () => {
  assert.equal(proximoAniversario(null, '2026-09-06'), null);
  assert.equal(proximoAniversario('', '2026-09-06'), null);
  assert.equal(proximoAniversario('no-es-fecha', '2026-09-06'), null);
});

test('proximasFechas: las 4 fechas de Contenido, próxima ocurrencia y ordenadas', () => {
  const j = { fechaNacimiento: '1994-10-01', clubNombre: 'Tigres UANL', clubFechaFundacion: '1960-03-07', debutSeleccion: '2024-11-15', debut: '2011-09-04' };
  assert.deepEqual(proximasFechas(j, '2026-09-29'), [
    { etiqueta: 'Cumpleaños', proximaIso: '2026-10-01' },
    { etiqueta: 'Debut en selección', proximaIso: '2026-11-15' },
    { etiqueta: 'Aniversario de Tigres UANL', proximaIso: '2027-03-07' },
    { etiqueta: 'Debut profesional', proximaIso: '2027-09-04' },
  ]);
});

test('proximasFechas: sin fechas cargadas → lista vacía; club sin nombre → "Aniversario de club"', () => {
  const vacio = { fechaNacimiento: null, clubNombre: null, clubFechaFundacion: null, debutSeleccion: null, debut: null };
  assert.deepEqual(proximasFechas(vacio, '2026-09-29'), []);
  assert.deepEqual(proximasFechas({ ...vacio, clubFechaFundacion: '1899-05-14' }, '2026-09-29'), [
    { etiqueta: 'Aniversario de club', proximaIso: '2027-05-14' },
  ]);
});
