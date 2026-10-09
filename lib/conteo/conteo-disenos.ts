/**
 * Conteo mensual de diseños para el pago del Diseñador (migración 0044, `conteo_disenos()`):
 * diseños completados en un período (6 → 5), Match Day + pedidos. La base solo responde al
 * Administrador y al Diseñador; acá también se filtra por cargo para no pedir de más.
 *
 * Football First. Creado 2026-10-08.
 */
import type { crearClienteServidor } from '@/lib/supabase/cliente-servidor';
import type { Periodo } from '@/lib/conteo/periodos';

/** Cargos que ven el conteo (información de pago; decidido por Gerardo 2026-10-08). */
export const CARGOS_CONTEO = ['Administrador', 'Diseñador'];

export function puedeVerConteo(cargo: string | undefined | null): boolean {
  return !!cargo && CARGOS_CONTEO.includes(cargo);
}

export type TipoDiseno = 'matchday' | 'pedido';

export interface DisenoContado {
  tipo: TipoDiseno;
  /** YYYY-MM-DD (Uruguay) en que se completó. */
  completadoDia: string;
  jugadorId: string;
  jugadorNombre: string;
  titulo: string;
  completadoPorNombre: string | null;
}

export interface TotalesConteo {
  matchday: number;
  pedidos: number;
  total: number;
  /** Por jugador, de más a menos diseños. */
  porJugador: { jugadorNombre: string; matchday: number; pedidos: number; total: number }[];
}

type Fila = {
  tipo: TipoDiseno;
  completado_dia: string;
  jugador_id: string;
  jugador_nombre: string;
  titulo: string;
  completado_por_nombre: string | null;
};

export async function leerConteo(supabase: ReturnType<typeof crearClienteServidor>, periodo: Periodo): Promise<DisenoContado[]> {
  // La función es nueva para el generador de tipos (0044): se llama sin tipar y se tipa la fila a mano.
  const { data, error } = await (supabase.rpc as unknown as (f: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }>)(
    'conteo_disenos',
    { p_desde: periodo.desde, p_hasta: periodo.hasta },
  );
  if (error) throw new Error(`No se pudo leer el conteo de diseños: ${error.message}`);
  return ((data ?? []) as Fila[]).map((f) => ({
    tipo: f.tipo,
    completadoDia: f.completado_dia,
    jugadorId: f.jugador_id,
    jugadorNombre: f.jugador_nombre,
    titulo: f.titulo,
    completadoPorNombre: f.completado_por_nombre,
  }));
}

/** Totales del período y por jugador. Puro. */
export function totalizar(disenos: DisenoContado[]): TotalesConteo {
  const porJugador = new Map<string, { jugadorNombre: string; matchday: number; pedidos: number; total: number }>();
  let matchday = 0;
  let pedidos = 0;
  for (const d of disenos) {
    const fila = porJugador.get(d.jugadorId) ?? { jugadorNombre: d.jugadorNombre, matchday: 0, pedidos: 0, total: 0 };
    if (d.tipo === 'matchday') {
      matchday++;
      fila.matchday++;
    } else {
      pedidos++;
      fila.pedidos++;
    }
    fila.total++;
    porJugador.set(d.jugadorId, fila);
  }
  return {
    matchday,
    pedidos,
    total: matchday + pedidos,
    porJugador: [...porJugador.values()].sort((a, b) => b.total - a.total || a.jugadorNombre.localeCompare(b.jugadorNombre, 'es')),
  };
}
