/**
 * Fechas de los jugadores de Contenido (cumpleaños, aniversarios de debut / debut en
 * selección / fundación del club) mezcladas con los partidos en la lista de `/partidos`:
 * "como si se juntaran los calendarios de Match Day y Contenido" (pedido 2026-09-28).
 *
 * Puro — la lectura de `agenda_contenido` vive en `RepositorioAgendaSupabase`. Solo importa
 * luxon y tipos (como el resto de lo testeado con `node --test`, que no resuelve `@/`): por
 * eso `hoyUy` entra como parámetro y el día del partido se calcula acá (`diaPartido`).
 * Reglas:
 *  - Cada día muestra sus partidos (orden original, por hora) y después sus fechas.
 *  - Filtros: Todos/Hoy/Esta semana → partidos + fechas; Internacional/Con hito → solo
 *    partidos (no aplican a un cumpleaños); Fechas → solo fechas.
 *  - Ventana: de hoy hasta el último partido cargado, así la lista termina en el mismo lugar.
 *
 * Football First. Creado 2026-09-28.
 */
import { DateTime } from 'luxon';
import type { FiltroPartidos } from '@/lib/partidos/utilidades';
import type { PartidoProximo } from '@/lib/repositorios/tipos';

export type FuenteFecha = 'cumpleanos' | 'aniversario_debut' | 'aniversario_seleccion' | 'aniversario_club';

export interface FechaContenido {
  fuente: FuenteFecha;
  /** Jugador (cumpleaños / debuts) o club (aniversario de club). */
  refId: string | null;
  titulo: string;
  /** YYYY-MM-DD, fecha civil (sin sede). */
  dia: string;
}

/** Orden dentro del día: primero lo del jugador, al final el club. */
const ORDEN_FUENTE: Record<FuenteFecha, number> = {
  cumpleanos: 0,
  aniversario_debut: 1,
  aniversario_seleccion: 2,
  aniversario_club: 3,
};

/** Día del partido: el de la sede, con fallback al de Uruguay (= `diaDePartido`). */
function diaPartido(p: PartidoProximo): string | null {
  return p.diaLocalSede ?? p.diaUy;
}

/** Días enteros de `hoyUy` a `dia` (ambos YYYY-MM-DD). */
function diasEntre(hoyUy: string, dia: string): number {
  return Math.round(
    DateTime.fromISO(dia, { zone: 'utc' }).diff(DateTime.fromISO(hoyUy, { zone: 'utc' }), 'days').days,
  );
}

/** Días de fechas a mostrar cuando no hay ningún partido cargado. */
export const DIAS_FECHAS_SIN_PARTIDOS = 60;

/**
 * Hasta qué día (inclusive) se muestran fechas: el del último partido, o hoy+60 si no hay
 * partidos (o si el último es anterior a hoy).
 */
export function hastaFechas(partidos: PartidoProximo[], hoyUy: string): string {
  const dias = partidos.map(diaPartido).filter((d): d is string => d !== null).sort();
  const ultimo = dias.at(-1);
  if (ultimo && ultimo >= hoyUy) return ultimo;
  return DateTime.fromISO(hoyUy, { zone: 'utc' }).plus({ days: DIAS_FECHAS_SIN_PARTIDOS }).toISODate() ?? hoyUy;
}

/** Quita repetidos (misma fuente + referencia + día) y ordena por día y fuente. */
export function normalizarFechas(fechas: FechaContenido[]): FechaContenido[] {
  const vistas = new Set<string>();
  const unicas: FechaContenido[] = [];
  for (const f of fechas) {
    const clave = `${f.fuente}|${f.refId ?? f.titulo}|${f.dia}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    unicas.push(f);
  }
  return unicas.sort(
    (a, b) =>
      a.dia.localeCompare(b.dia) ||
      ORDEN_FUENTE[a.fuente] - ORDEN_FUENTE[b.fuente] ||
      a.titulo.localeCompare(b.titulo, 'es'),
  );
}

/** Fechas que muestra cada filtro (los partidos los filtra `filtrarPartidos`). */
export function filtrarFechas(
  fechas: FechaContenido[],
  filtro: FiltroPartidos,
  hoyUy: string,
): FechaContenido[] {
  switch (filtro) {
    case 'hoy':
      return fechas.filter((f) => diasEntre(hoyUy, f.dia) === 0);
    case 'semana':
      return fechas.filter((f) => diasEntre(hoyUy, f.dia) < 7);
    case 'int':
    case 'hito':
      return [];
    case 'fechas':
    case 'todos':
    default:
      return fechas;
  }
}

export interface GrupoDia {
  /** YYYY-MM-DD, o `'sin-fecha'` para partidos sin día confirmado (van al final). */
  dia: string;
  partidos: PartidoProximo[];
  fechas: FechaContenido[];
}

/**
 * Mezcla partidos y fechas en grupos por día, en orden cronológico. Los partidos conservan
 * el orden en que vienen (por hora); las fechas, el de `normalizarFechas`.
 */
export function mezclarPorDia(partidos: PartidoProximo[], fechas: FechaContenido[]): GrupoDia[] {
  const grupos = new Map<string, GrupoDia>();
  const grupo = (dia: string) => {
    let g = grupos.get(dia);
    if (!g) {
      g = { dia, partidos: [], fechas: [] };
      grupos.set(dia, g);
    }
    return g;
  };
  for (const p of partidos) grupo(diaPartido(p) ?? 'sin-fecha').partidos.push(p);
  for (const f of fechas) grupo(f.dia).fechas.push(f);

  return [...grupos.values()].sort((a, b) => {
    if (a.dia === 'sin-fecha') return 1;
    if (b.dia === 'sin-fecha') return -1;
    return a.dia.localeCompare(b.dia);
  });
}

/** "2 partidos · 1 fecha", "1 partido", "3 fechas". */
export function textoCantidades(partidos: number, fechas: number): string {
  const partes: string[] = [];
  if (partidos || !fechas) partes.push(`${partidos} partido${partidos !== 1 ? 's' : ''}`);
  if (fechas) partes.push(`${fechas} fecha${fechas !== 1 ? 's' : ''}`);
  return partes.join(' · ');
}
