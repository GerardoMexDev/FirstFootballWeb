import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textoCopiarPartido } from './copiar.ts';

test('textoCopiarPartido: equipos, fecha, hora local y de Uruguay, estadio', () => {
  assert.equal(
    textoCopiarPartido({ local: 'Toluca', visitante: 'Atlante', inicioUtc: '2026-10-05T02:00:00Z', zona: 'America/Mexico_City', estadio: 'Estadio Nemesio Díez', ciudad: 'Toluca' }),
    'Toluca vs Atlante\nDomingo 4 de octubre\n20:00 hora local · 23:00 hora de Uruguay\nEstadio Nemesio Díez, Toluca',
  );
});

test('textoCopiarPartido: misma hora que Uruguay; sin estadio ni hora', () => {
  assert.equal(
    textoCopiarPartido({ local: 'RB Bragantino', visitante: 'Mirassol', inicioUtc: '2026-10-05T21:30:00Z', zona: 'America/Sao_Paulo', estadio: null, ciudad: null }),
    'RB Bragantino vs Mirassol\nLunes 5 de octubre\n18:30 hora de Uruguay (misma hora local)',
  );
  assert.equal(
    textoCopiarPartido({ local: 'Genk', visitante: null, inicioUtc: null, zona: null, estadio: 'Cegeka Arena', ciudad: 'Genk' }),
    'Genk vs ?\nFecha a confirmar\nCegeka Arena, Genk',
  );
});

test('textoCopiarPartido: sin zona de la sede (o inválida) no inventa "misma hora local"', () => {
  for (const zona of [null, 'Zona/Inexistente']) {
    assert.equal(
      textoCopiarPartido({ local: 'Genk', visitante: 'Gent', inicioUtc: '2026-10-05T21:30:00Z', zona, estadio: null, ciudad: null }),
      'Genk vs Gent\nLunes 5 de octubre\n18:30 hora de Uruguay',
    );
  }
});
