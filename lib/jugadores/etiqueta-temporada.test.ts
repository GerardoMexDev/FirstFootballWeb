import { test } from 'node:test';
import assert from 'node:assert/strict';
import { etiquetaBloqueTemporada } from './etiqueta-temporada.ts';
import type { TemporadaActual } from '@/lib/repositorios/tipos';

function temporada(over: Partial<TemporadaActual>): TemporadaActual {
  return {
    partidos: 1,
    minutos: 90,
    goles: 0,
    asistencias: 0,
    amarillas: 0,
    rojas: 0,
    valoracionPromedio: 7,
    temporadaAnioDesde: null,
    temporadaAnioHasta: null,
    temporadaInicio: null,
    ...over,
  };
}

test('sin temporada (jugador sin partidos este año) -> "Este año (AAAA)"', () => {
  assert.equal(etiquetaBloqueTemporada(null, 'Brasil', '2026'), 'Este año (2026)');
});

test('sin temporada real conocida (copas/API-Football) -> año calendario', () => {
  const t = temporada({});
  assert.equal(etiquetaBloqueTemporada(t, 'Brasil', '2026'), 'Este año (2026)');
});

test('Liga MX, temporada arrancada en julio -> "Apertura AAAA"', () => {
  const t = temporada({ temporadaAnioDesde: 2026, temporadaAnioHasta: 2026, temporadaInicio: '2026-07-17T18:00:00Z' });
  assert.equal(etiquetaBloqueTemporada(t, 'México', '2026'), 'Apertura 2026');
});

test('Liga MX, temporada arrancada en enero -> "Clausura AAAA"', () => {
  const t = temporada({ temporadaAnioDesde: 2027, temporadaAnioHasta: 2027, temporadaInicio: '2027-01-09T18:00:00Z' });
  assert.equal(etiquetaBloqueTemporada(t, 'México', '2027'), 'Clausura 2027');
});

test('Liga MX pero sin temporadaInicio (dato viejo/incompleto) -> cae al criterio genérico', () => {
  const t = temporada({ temporadaAnioDesde: 2026, temporadaAnioHasta: 2026, temporadaInicio: null });
  assert.equal(etiquetaBloqueTemporada(t, 'México', '2026'), 'Este año (2026)');
});

test('temporada que cruza el año calendario (Bélgica/Arabia) -> "Temporada AAAA-AAAA"', () => {
  const t = temporada({ temporadaAnioDesde: 2026, temporadaAnioHasta: 2027, temporadaInicio: '2026-08-01T00:00:00Z' });
  assert.equal(etiquetaBloqueTemporada(t, 'Bélgica', '2026'), 'Temporada 2026-2027');
  assert.equal(etiquetaBloqueTemporada(t, 'Arabia Saudita', '2026'), 'Temporada 2026-2027');
});

test('temporada real dentro de un solo año, país no-México (Brasil/Chile) -> "Este año" con el año de la temporada', () => {
  const t = temporada({ temporadaAnioDesde: 2026, temporadaAnioHasta: 2026, temporadaInicio: '2026-04-01T00:00:00Z' });
  assert.equal(etiquetaBloqueTemporada(t, 'Brasil', '2026'), 'Este año (2026)');
  assert.equal(etiquetaBloqueTemporada(t, 'Chile', '2026'), 'Este año (2026)');
});
