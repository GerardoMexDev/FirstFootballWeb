import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EQUIPOS_URUGUAY, URUGUAY_ESPN_ID, tareasDeSync, claveCompetencia, jugadoresPorClub, mapaCarteraEspn, zonaDeSede,
} from './espn-uruguay.ts';

test('tareasDeSync: Peñarol y Nacional × 3 ligas + Uruguay × 4 = 10 tareas', () => {
  const t = tareasDeSync();
  assert.equal(t.length, 10);
  assert.deepEqual(
    t.filter((x) => x.equipo.clave === 'uruguay').map((x) => x.slug),
    ['fifa.friendly', 'fifa.worldq.conmebol', 'conmebol.america', 'fifa.world'],
  );
  assert.deepEqual(t.find((x) => x.equipo.clave === 'penarol' && x.slug === 'conmebol.libertadores')?.competencia, { proveedor: 'api-football', idExterno: '13' });
  assert.equal(EQUIPOS_URUGUAY.find((e) => e.esSeleccion)?.espnTeamId, URUGUAY_ESPN_ID);
});

test('claveCompetencia', () => {
  assert.equal(claveCompetencia({ proveedor: 'espn', idExterno: 'uru.1' }), 'espn:uru.1');
});

test('jugadoresPorClub: solo activos, solo-Contenido, del club pedido', () => {
  const base = { activo: true, servicio_match_day: false, servicio_contenido: true };
  const m = jugadoresPorClub(
    [
      { ...base, id: 'abel', club_actual_id: 'PEN' },
      { ...base, id: 'franco', club_actual_id: 'PEN' },
      { ...base, id: 'silvera', club_actual_id: 'NAC' },
      { ...base, id: 'md', club_actual_id: 'PEN', servicio_match_day: true },
      { ...base, id: 'baja', club_actual_id: 'PEN', activo: false },
      { ...base, id: 'seFue', club_actual_id: 'BOCA' }, // cambió de club: ya no se vincula
    ],
    ['PEN', 'NAC'],
  );
  assert.deepEqual(m.get('PEN'), ['abel', 'franco']);
  assert.deepEqual(m.get('NAC'), ['silvera']);
  assert.equal(m.has('BOCA'), false);
});

test('mapaCarteraEspn: clásico — cada club ESPN apunta a nuestro uuid (no se crea un rival duplicado)', () => {
  const m = mapaCarteraEspn(new Map([['2348', 'uuid-pen'], ['2356', 'uuid-nac']]));
  assert.equal(m.get('2683'), 'uuid-pen');
  assert.equal(m.get('2684'), 'uuid-nac');
  assert.equal(m.has(URUGUAY_ESPN_ID), false); // la selección se resuelve aparte
});

test('zonaDeSede: país conocido; uru.1 sin país → Montevideo; selección sin país → null', () => {
  assert.equal(zonaDeSede('India', 'fifa.friendly'), 'Asia/Kolkata');
  assert.equal(zonaDeSede(null, 'uru.1'), 'America/Montevideo');
  assert.equal(zonaDeSede(null, 'fifa.friendly'), null);
});
