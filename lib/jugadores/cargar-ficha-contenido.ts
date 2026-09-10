/**
 * Bundle de la ficha SLIM de un jugador del servicio "Contenido": los datos de la persona +
 * las próximas ocurrencias de sus fechas de contenido. Sin temporada, sin hitos, sin
 * partidos (ese jugador no tiene seguimiento de fixture).
 *
 * Lo comparten la ruta SSR `/jugadores/[id]` (cuando el jugador es `soloContenido`) y el
 * endpoint `/api/paneles/jugador-contenido` (panel lateral).
 *
 * Football First (Fase 1). Creado 2026-09-10 (Sesión 7).
 */
import { DateTime } from 'luxon';
import { ZONA_AGENCIA } from '@/lib/fechas/zonas';
import { proximoAniversario } from '@/lib/jugadores/datos-contenido';
import { RepositorioJugadoresSupabase } from '@/lib/repositorios/repositorio-jugadores';
import type { crearClienteServidor } from '@/lib/supabase/cliente-servidor';
import type { JugadorFicha } from '@/lib/repositorios/tipos';

type ClienteSupabase = ReturnType<typeof crearClienteServidor>;

export interface ProximaFecha {
  /** "Cumpleaños", "Aniversario de <club>", "Debut en selección", "Debut profesional". */
  etiqueta: string;
  /** YYYY-MM-DD de la próxima ocurrencia (>= hoy). */
  proximaIso: string;
}

export interface FichaContenidoBundle {
  jugador: JugadorFicha;
  /** Ordenadas por fecha ascendente. Vacío si el jugador no tiene ninguna de las 4. */
  proximas: ProximaFecha[];
  /** Día de hoy en Uruguay, YYYY-MM-DD. */
  hoyUy: string;
}

/** Devuelve el bundle, o `null` si el jugador no existe, está inactivo, o no es `soloContenido`. */
export async function cargarFichaContenido(
  supabase: ClienteSupabase,
  jugadorId: string,
): Promise<FichaContenidoBundle | null> {
  const jugador = await new RepositorioJugadoresSupabase(supabase).obtener(jugadorId);
  if (!jugador || !jugador.soloContenido) return null;

  const hoyUy = DateTime.now().setZone(ZONA_AGENCIA).toISODate() ?? '';

  const crudas: Array<{ etiqueta: string; fecha: string | null }> = [
    { etiqueta: 'Cumpleaños', fecha: jugador.fechaNacimiento },
    { etiqueta: `Aniversario de ${jugador.clubNombre ?? 'club'}`, fecha: jugador.clubFechaFundacion },
    { etiqueta: 'Debut en selección', fecha: jugador.debutSeleccion },
    { etiqueta: 'Debut profesional', fecha: jugador.debut },
  ];

  const proximas: ProximaFecha[] = crudas
    .map((c) => ({ etiqueta: c.etiqueta, proximaIso: proximoAniversario(c.fecha, hoyUy) }))
    .filter((c): c is ProximaFecha => c.proximaIso !== null)
    .sort((a, b) => a.proximaIso.localeCompare(b.proximaIso));

  return { jugador, proximas, hoyUy };
}
