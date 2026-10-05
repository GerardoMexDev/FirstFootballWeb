import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EQUIPOS_URUGUAY, EQUIPOS_COPAS_MD, EQUIPOS_ESPN, URUGUAY_ESPN_ID, tareasDeSync, claveCompetencia, jugadoresPorClub, mapaCarteraEspn, zonaDeSede,
  vinculosSobrantes, estadoDeCorrida, quedaTiempo,
} from './espn-uruguay.ts';

test('claveCompetencia', () => {
  assert.equal(claveCompetencia({ proveedor: 'espn', idExterno: 'uru.1' }), 'espn:uru.1');
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

test('vinculosSobrantes: el que se fue del club se desvincula; en el clásico cada uno sigue con su club', () => {
  const vigentes = new Map([['PEN', ['franco']], ['NAC', ['silvera']]]); // Abel se fue de Peñarol
  const filas = [
    { partido_id: 'p1', jugador_id: 'abel', club_local_id: 'PEN', club_visitante_id: 'RAC' },
    { partido_id: 'p1', jugador_id: 'franco', club_local_id: 'PEN', club_visitante_id: 'RAC' },
    { partido_id: 'clasico', jugador_id: 'franco', club_local_id: 'NAC', club_visitante_id: 'PEN' },
    { partido_id: 'clasico', jugador_id: 'silvera', club_local_id: 'NAC', club_visitante_id: 'PEN' },
  ];
  assert.deepEqual(vinculosSobrantes(filas, vigentes), [{ partido_id: 'p1', jugador_id: 'abel' }]);
});

test('estadoDeCorrida: un evento suelto que falla no prende el aviso; una liga caída sí', () => {
  assert.equal(estadoDeCorrida({ falloGeneral: false, ligasFallidas: 0, guardados: 7 }), 'ok');
  assert.equal(estadoDeCorrida({ falloGeneral: false, ligasFallidas: 1, guardados: 5 }), 'parcial');
  assert.equal(estadoDeCorrida({ falloGeneral: false, ligasFallidas: 10, guardados: 0 }), 'error');
  assert.equal(estadoDeCorrida({ falloGeneral: true, ligasFallidas: 0, guardados: 0 }), 'error');
  assert.equal(estadoDeCorrida({ falloGeneral: true, ligasFallidas: 0, guardados: 3 }), 'parcial');
});

test('tareasDeSync: Uruguay (10) + copas y amistosos de los 6 clubes de Match Day (46) = 56', () => {
  const t = tareasDeSync();
  assert.equal(t.length, 56);
  // Amistosos de clubes (2026-10-05): uno por club de Match Day, ninguno para Uruguay.
  assert.deepEqual(
    t.filter((x) => x.slug === 'club.friendly').map((x) => x.equipo.clave),
    EQUIPOS_COPAS_MD.map((e) => e.clave),
  );
  assert.deepEqual(
    t.filter((x) => x.equipo.clave === 'uruguay').map((x) => x.slug),
    ['fifa.friendly', 'fifa.worldq.conmebol', 'conmebol.america', 'fifa.world'],
  );
  assert.deepEqual(t.find((x) => x.equipo.clave === 'penarol' && x.slug === 'conmebol.libertadores')?.competencia, { proveedor: 'api-football', idExterno: '13' });
  assert.deepEqual(t.find((x) => x.equipo.clave === 'colo-colo' && x.slug === 'chi.copa_chi')?.competencia, { proveedor: 'api-football', idExterno: '267' });
  assert.deepEqual(t.find((x) => x.equipo.clave === 'genk' && x.slug === 'uefa.europa_qual')?.competencia, { proveedor: 'api-football', idExterno: '3' });
  assert.deepEqual(t.find((x) => x.equipo.clave === 'al-qadisiyah' && x.slug === 'afc.champions')?.competencia, { proveedor: 'api-football', idExterno: '17' });
  assert.deepEqual(t.find((x) => x.equipo.clave === 'bragantino' && x.slug === 'bra.camp.paulista')?.competencia, { proveedor: 'espn', idExterno: 'bra.camp.paulista' });
  // Ninguna liga doméstica de los 6 clubes (esas son de SportMonks).
  const ligas = new Set(['mex.1', 'bra.1', 'chi.1', 'bel.1', 'ksa.1']);
  assert.equal(t.filter((x) => ligas.has(x.slug)).length, 0);
  assert.equal(EQUIPOS_URUGUAY.find((e) => e.esSeleccion)?.espnTeamId, URUGUAY_ESPN_ID);
  assert.equal(EQUIPOS_COPAS_MD.every((e) => e.servicio === 'matchday'), true);
  assert.equal(EQUIPOS_ESPN.length, 9);
});

test('jugadoresPorClub: Contenido → solo-Contenido; Match Day → de Match Day; activos y del club', () => {
  const j = (id: string, club: string, md: boolean, co: boolean, activo = true) =>
    ({ id, club_actual_id: club, activo, servicio_match_day: md, servicio_contenido: co });
  const m = jugadoresPorClub(
    [
      j('abel', 'PEN', false, true),
      j('franco', 'PEN', false, true),
      j('mdEnPen', 'PEN', true, true), // de Match Day en un club de Contenido: no
      j('javi', 'COL', true, true),
      j('soloCoEnCol', 'COL', false, true), // solo-Contenido en un club de Match Day: no
      j('baja', 'COL', true, true, false),
      j('seFue', 'BOCA', false, true),
    ],
    new Map([['PEN', 'contenido'], ['COL', 'matchday']]),
  );
  assert.deepEqual(m.get('PEN'), ['abel', 'franco']);
  assert.deepEqual(m.get('COL'), ['javi']);
  assert.equal(m.has('BOCA'), false);
});

test('mapaCarteraEspn: Toluca vs Atlante (Leagues Cup) → cada id ESPN apunta a nuestro club', () => {
  const m = mapaCarteraEspn(new Map([['2281', 'uuid-tol'], ['2312', 'uuid-atl'], ['2348', 'uuid-pen']]));
  assert.equal(m.get('223'), 'uuid-tol');
  assert.equal(m.get('226'), 'uuid-atl');
  assert.equal(m.get('2683'), 'uuid-pen');
});

test('tareasDeSync: primero las copas de Match Day (generan tickets) y después Uruguay', () => {
  const t = tareasDeSync();
  const primeraUruguay = t.findIndex((x) => x.equipo.servicio === 'contenido');
  assert.equal(t.slice(0, primeraUruguay).length, 46);
  assert.equal(t.slice(primeraUruguay).every((x) => x.equipo.servicio === 'contenido'), true);
});

test('quedaTiempo: corta antes del límite de la Edge Function', () => {
  assert.equal(quedaTiempo(0, 119_000), true);
  assert.equal(quedaTiempo(0, 120_000), false);
});
