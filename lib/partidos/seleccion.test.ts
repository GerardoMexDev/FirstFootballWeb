import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unirConSeleccion, listaSegunFiltro } from './seleccion.ts';
import type { PartidoProximo } from '../repositorios/tipos.ts';

const pp = (id: string, dia: string, extra: Partial<PartidoProximo> = {}): PartidoProximo => ({
  partidoId: id, jugadorId: 'j', jugadorNombre: 'X', jugadorApodo: null, jugadorFotoUrl: null, jugadorSeleccion: null,
  conSeleccion: false, competenciaId: null, competenciaNombre: null, competenciaCodigo: null, competenciaTipo: 'liga',
  esInternacional: false, competenciaCobertura: null, clubId: null, clubNombre: null, clubEscudoUrl: null, rivalId: null,
  rivalNombre: null, rivalEscudoUrl: null, esLocal: null, inicioUtc: `${dia}T20:00:00Z`, zonaHorariaEvento: null,
  diaUy: dia, diaLocalSede: dia, estado: 'programado', ronda: null, estadio: null, ciudad: null, marcadorLocal: null,
  marcadorVisitante: null, tentativo: false, ...extra,
});

test('unirConSeleccion: ordena por fecha y NO repite un partido de Uruguay que ya está en Match Day', () => {
  const md = [pp('m1', '2026-10-04'), pp('m2', '2026-10-06', { competenciaTipo: 'seleccion', conSeleccion: true })];
  const sel = [pp('s1', '2026-10-06', { esSeleccion: true, competenciaTipo: 'seleccion' }), pp('s2', '2026-10-10', { esSeleccion: true, competenciaTipo: 'seleccion' })];
  assert.deepEqual(unirConSeleccion(md, sel).map((p) => p.partidoId), ['m1', 'm2', 's2']);
});

test('listaSegunFiltro: Selección = solo selección; Todos = Match Day + selección; Contenido aparte; Match Day sin selección', () => {
  const listas = {
    partidos: [pp('m1', '2026-10-04')],
    contenido: [pp('c1', '2026-10-05')],
    seleccion: [pp('s1', '2026-10-06', { esSeleccion: true, competenciaTipo: 'seleccion' })],
  };
  const resto = (l: PartidoProximo[]) => l; // en la app: filtrarPartidos(l, filtro, conHito)
  assert.deepEqual(listaSegunFiltro('seleccion', listas, resto).map((p) => p.partidoId), ['s1']);
  assert.deepEqual(listaSegunFiltro('todos', listas, resto).map((p) => p.partidoId), ['m1', 's1']);
  assert.deepEqual(listaSegunFiltro('contenido', listas, resto).map((p) => p.partidoId), ['c1']);
  assert.deepEqual(listaSegunFiltro('matchday', listas, resto).map((p) => p.partidoId), ['m1']);
});
