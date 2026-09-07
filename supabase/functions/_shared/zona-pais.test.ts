import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zonaDePais } from './zona-pais.ts';

test('países de la cartera, nombre en español (como competencias.pais)', () => {
  assert.equal(zonaDePais('México'), 'America/Mexico_City');
  assert.equal(zonaDePais('Brasil'), 'America/Sao_Paulo');
  assert.equal(zonaDePais('Chile'), 'America/Santiago');
  assert.equal(zonaDePais('Bélgica'), 'Europe/Brussels');
  assert.equal(zonaDePais('Arabia Saudita'), 'Asia/Riyadh');
  assert.equal(zonaDePais('Uruguay'), 'America/Montevideo');
});

test('nombre en inglés (como lo da API-Football en /venues)', () => {
  assert.equal(zonaDePais('Brazil'), 'America/Sao_Paulo');
  assert.equal(zonaDePais('Belgium'), 'Europe/Brussels');
  assert.equal(zonaDePais('Saudi Arabia'), 'Asia/Riyadh');
  assert.equal(zonaDePais('Mexico'), 'America/Mexico_City');
});

test('acentos y mayúsculas no importan', () => {
  assert.equal(zonaDePais('  méxico '), 'America/Mexico_City');
  assert.equal(zonaDePais('BÉLGICA'), 'Europe/Brussels');
});

test('rivales de continentales sudamericanas', () => {
  assert.equal(zonaDePais('Argentina'), 'America/Argentina/Buenos_Aires');
  assert.equal(zonaDePais('Paraguay'), 'America/Asuncion');
  assert.equal(zonaDePais('Colombia'), 'America/Bogota');
});

test('EEUU (Leagues Cup) resuelve a un default', () => {
  assert.equal(zonaDePais('USA'), 'America/New_York');
  assert.equal(zonaDePais('Estados Unidos'), 'America/New_York');
});

test('un continente (competencias.pais de las copas) → null', () => {
  assert.equal(zonaDePais('Sudamérica'), null);
  assert.equal(zonaDePais('Norteamérica'), null);
  assert.equal(zonaDePais('Asia'), null);
  assert.equal(zonaDePais('Europa'), null);
});

test('null / vacío / desconocido → null', () => {
  assert.equal(zonaDePais(null), null);
  assert.equal(zonaDePais(''), null);
  assert.equal(zonaDePais('Narnia'), null);
});
