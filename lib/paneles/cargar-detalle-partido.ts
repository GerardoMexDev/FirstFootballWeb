/**
 * Arma el bundle del panel de detalle de partido: el partido plegado (`plegarDetallePartido`)
 * + los hitos que caerían en ese partido (mismo motor que la vista `partidos`).
 *
 * Recibe el cliente Supabase ya creado (SSR, cookies del usuario).
 *
 * Football First (Fase 1). Creado 2026-09-06.
 */
import { DateTime } from 'luxon';
import { calcularHitos, ordenarHitos } from '@/lib/motor-hitos';
import { agruparPorJugador } from '@/lib/partidos/utilidades';
import { ZONA_AGENCIA } from '@/lib/fechas/zonas';
import { plegarDetallePartido, type DetallePartido } from '@/lib/paneles/detalle-partido';
import type { crearClienteServidor } from '@/lib/supabase/cliente-servidor';
import { RepositorioHitosSupabase } from '@/lib/repositorios/repositorio-hitos';
import { RepositorioPartidosSupabase } from '@/lib/repositorios/repositorio-partidos';
import type { Hito } from '@/lib/motor-hitos/tipos';

type ClienteSupabase = ReturnType<typeof crearClienteServidor>;

export interface DetallePartidoBundle {
  detalle: DetallePartido;
  /** Hitos estimados PARA este partido (métrica pj + carrera, los únicos ubicables). */
  hitos: Hito[];
  hoyUy: string;
}

/** Devuelve el bundle, o `null` si el partido no tiene filas en `proximos_partidos`. */
export async function cargarDetallePartido(
  supabase: ClienteSupabase,
  partidoId: string,
): Promise<DetallePartidoBundle | null> {
  const repositorioPartidos = new RepositorioPartidosSupabase(supabase);
  const filas = await repositorioPartidos.listarPorPartido(partidoId);
  const detalle = plegarDetallePartido(filas);
  if (!detalle) return null;

  const repositorioHitos = new RepositorioHitosSupabase(supabase);
  const [proximos, jugadoresBasicos, totales, escalas] = await Promise.all([
    repositorioPartidos.listarProximos(),
    repositorioHitos.listarJugadoresActivos(),
    repositorioHitos.listarTotales(),
    repositorioHitos.listarEscalasActivas(),
  ]);

  const totalesPorJugador = new Map(totales.map((t) => [t.jugadorId, t]));
  const hitos = ordenarHitos(
    calcularHitos(jugadoresBasicos, totalesPorJugador, escalas, agruparPorJugador(proximos)),
  ).filter((h) => h.partido?.partidoId === partidoId);

  return {
    detalle,
    hitos,
    hoyUy: DateTime.now().setZone(ZONA_AGENCIA).toISODate() ?? '',
  };
}
