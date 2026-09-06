/**
 * Arma el bundle de la ficha de jugador (datos + temporada + hitos + próximos partidos).
 * Lo comparten la ruta SSR `/jugadores/[id]` y el endpoint `/api/paneles/jugador` (que
 * alimenta el panel lateral) — mismo contenido, dos formas de mostrarlo.
 *
 * Recibe el cliente Supabase ya creado (SSR, con las cookies del usuario) para no repetir
 * el chequeo de sesión ni la creación del cliente.
 *
 * Football First (Fase 1). Creado 2026-09-06.
 */
import { DateTime } from 'luxon';
import { calcularHitos, ordenarHitos } from '@/lib/motor-hitos';
import { ZONA_AGENCIA } from '@/lib/fechas/zonas';
import type { crearClienteServidor } from '@/lib/supabase/cliente-servidor';
import { RepositorioJugadoresSupabase } from '@/lib/repositorios/repositorio-jugadores';
import { RepositorioHitosSupabase } from '@/lib/repositorios/repositorio-hitos';
import { RepositorioPartidosSupabase } from '@/lib/repositorios/repositorio-partidos';
import type { Hito } from '@/lib/motor-hitos/tipos';
import type { JugadorFicha, PartidoProximo, TemporadaActual } from '@/lib/repositorios/tipos';

type ClienteSupabase = ReturnType<typeof crearClienteServidor>;

const MAXIMO_PROXIMOS = 5;

export interface FichaJugadorBundle {
  jugador: JugadorFicha;
  temporada: TemporadaActual | null;
  hitos: Hito[];
  proximos: PartidoProximo[];
  /** Día de hoy en Uruguay, YYYY-MM-DD. */
  hoyUy: string;
}

/** Devuelve el bundle, o `null` si el jugador no existe / está inactivo. */
export async function cargarFichaJugador(
  supabase: ClienteSupabase,
  jugadorId: string,
): Promise<FichaJugadorBundle | null> {
  const repositorioJugadores = new RepositorioJugadoresSupabase(supabase);
  const jugador = await repositorioJugadores.obtener(jugadorId);
  if (!jugador) return null;

  const repositorioHitos = new RepositorioHitosSupabase(supabase);
  const [temporada, proximos, jugadoresBasicos, totales, escalas] = await Promise.all([
    repositorioJugadores.temporadaActual(jugador.id),
    new RepositorioPartidosSupabase(supabase).listarPorJugador(jugador.id),
    repositorioHitos.listarJugadoresActivos(),
    repositorioHitos.listarTotales(),
    repositorioHitos.listarEscalasActivas(),
  ]);

  const totalesPorJugador = new Map(totales.map((t) => [t.jugadorId, t]));
  const hitos = ordenarHitos(
    calcularHitos(
      jugadoresBasicos.filter((j) => j.id === jugador.id),
      totalesPorJugador,
      escalas,
      new Map([[jugador.id, proximos]]),
    ),
  );

  return {
    jugador,
    temporada,
    hitos,
    proximos: proximos.slice(0, MAXIMO_PROXIMOS),
    hoyUy: DateTime.now().setZone(ZONA_AGENCIA).toISODate() ?? '',
  };
}
