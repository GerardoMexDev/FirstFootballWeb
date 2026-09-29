import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aMapaLinks, linkSeguro } from './links-dropbox.ts';

test('linkSeguro: https pasa (recortado)', () => {
  assert.equal(
    linkSeguro(' https://www.dropbox.com/scl/fo/abc?dl=0 '),
    'https://www.dropbox.com/scl/fo/abc?dl=0',
  );
});

test('linkSeguro: vacío / null / undefined → null', () => {
  assert.equal(linkSeguro(''), null);
  assert.equal(linkSeguro(null), null);
  assert.equal(linkSeguro(undefined), null);
});

test('linkSeguro: rechaza esquemas peligrosos o inseguros', () => {
  assert.equal(linkSeguro('javascript:alert(1)'), null);
  assert.equal(linkSeguro('JAVASCRIPT:alert(1)'), null);
  assert.equal(linkSeguro('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(linkSeguro('http://www.dropbox.com/x'), null);
});

test('linkSeguro: texto que no es URL → null', () => {
  assert.equal(linkSeguro('carpeta de fotos'), null);
  assert.equal(linkSeguro('www.dropbox.com/x'), null);
});

test('aMapaLinks: arma el mapa por id y sanea cada link', () => {
  const mapa = aMapaLinks([
    { id: 'a', dropbox_fotografias_url: 'https://x.com/f', dropbox_matchday_url: null },
    { id: 'b', dropbox_fotografias_url: 'javascript:alert(1)', dropbox_matchday_url: 'https://x.com/m' },
  ]);
  assert.deepEqual(mapa, {
    a: { fotografias: 'https://x.com/f', matchday: null },
    b: { fotografias: null, matchday: 'https://x.com/m' },
  });
});
