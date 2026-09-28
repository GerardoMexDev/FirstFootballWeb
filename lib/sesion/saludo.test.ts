import { test } from 'node:test';
import assert from 'node:assert/strict';
import { primerNombre, saludoPorHora } from './saludo.ts';

test('primer nombre de un nombre completo', () => {
  assert.equal(primerNombre('Felipe Merola'), 'Felipe');
  assert.equal(primerNombre('  Maxi   Rosales '), 'Maxi');
  assert.equal(primerNombre('Pedro'), 'Pedro');
  assert.equal(primerNombre(''), '');
});

test('saludo según la hora, con los bordes', () => {
  assert.equal(saludoPorHora(4), 'Buenas noches');
  assert.equal(saludoPorHora(5), 'Buenos días');
  assert.equal(saludoPorHora(11), 'Buenos días');
  assert.equal(saludoPorHora(12), 'Buenas tardes');
  assert.equal(saludoPorHora(19), 'Buenas tardes');
  assert.equal(saludoPorHora(20), 'Buenas noches');
  assert.equal(saludoPorHora(0), 'Buenas noches');
});
