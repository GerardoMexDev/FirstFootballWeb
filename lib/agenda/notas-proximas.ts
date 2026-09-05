/**
 * "Fechas señaladas" próximas — filtra la vista `agenda_anual` a los eventos de fecha fija
 * (cumpleaños, aniversario de club, aniversario del debut en selección) que caen dentro de
 * la ventana de aviso, para que los diseñadores preparen el arte a tiempo.
 *
 * Ventana (pedido de Gerardo, "entre 10 y 7 días"): la nota aparece desde
 * `DIAS_AVISO_AGENDA` días antes y se marca `urgente` cuando faltan `DIAS_AVISO_URGENTE`
 * o menos.
 *
 * Puro y determinista: recibe los eventos ya leídos + el día de hoy en Uruguay
 * (YYYY-MM-DD). No llama a `now()` ni a Supabase — así se testea sin mocks.
 *
 * Football First (Fase 1). Creado 2026-09-05.
 */
import { DateTime } from 'luxon';

export const DIAS_AVISO_AGENDA = 10;
export const DIAS_AVISO_URGENTE = 7;

export type FuenteAgenda =
  | 'partido'
  | 'convocatoria'
  | 'hito'
  | 'cumpleanos'
  | 'aniversario_club'
  | 'aniversario_seleccion';

/** Fila mínima de `agenda_anual` que necesita esta lógica. */
export interface EventoAgenda {
  fuente: FuenteAgenda;
  titulo: string;
  /** YYYY-MM-DD, ya en zona de Uruguay (lo calcula la vista con `at time zone`). */
  diaUy: string;
}

export interface NotaAgenda extends EventoAgenda {
  /** Días desde hoy hasta el evento. 0 = es hoy. */
  diasFalta: number;
  urgente: boolean;
}

/**
 * Eventos de fecha fija que sirven para anticipar diseño. Partidos, convocatorias e hitos
 * por conteo se muestran en otro lado (la vista `partidos` y `SeccionHitos`).
 */
const FUENTES_NOTA: readonly FuenteAgenda[] = ['cumpleanos', 'aniversario_club', 'aniversario_seleccion'];

/**
 * Días entre dos fechas civiles (YYYY-MM-DD). Ambas se anclan a medianoche UTC y se resta:
 * como son fechas de calendario ya expresadas en zona de Uruguay (no instantes que haya que
 * convertir), el gap en días es exacto y no lo afecta ningún cambio de horario. No es la
 * "aritmética sobre new Date()" que prohíbe contexto.md §6 — eso es para convertir instantes.
 */
function diasEntre(desdeIso: string, hastaIso: string): number {
  const desde = DateTime.fromISO(desdeIso, { zone: 'utc' }).startOf('day');
  const hasta = DateTime.fromISO(hastaIso, { zone: 'utc' }).startOf('day');
  return Math.round(hasta.diff(desde, 'days').days);
}

/**
 * @param eventos filas de `agenda_anual` (al menos `fuente`, `titulo`, `diaUy`)
 * @param hoyUy   día de hoy en zona de Uruguay, YYYY-MM-DD
 * @param opciones ventana y qué fuentes contar (por defecto: las 3 de fecha fija)
 * @returns notas dentro de la ventana, de la más cercana a la más lejana
 */
export function notasProximas(
  eventos: EventoAgenda[],
  hoyUy: string,
  opciones: { dias?: number; urgenteDias?: number; fuentes?: readonly FuenteAgenda[] } = {},
): NotaAgenda[] {
  const dias = opciones.dias ?? DIAS_AVISO_AGENDA;
  const urgenteDias = opciones.urgenteDias ?? DIAS_AVISO_URGENTE;
  const fuentes = new Set(opciones.fuentes ?? FUENTES_NOTA);

  return eventos
    .filter((e) => fuentes.has(e.fuente))
    .map((e) => {
      const diasFalta = diasEntre(hoyUy, e.diaUy);
      return { ...e, diasFalta, urgente: diasFalta <= urgenteDias };
    })
    .filter((n) => n.diasFalta >= 0 && n.diasFalta <= dias)
    .sort((a, b) => a.diasFalta - b.diasFalta || a.titulo.localeCompare(b.titulo, 'es'));
}

/** Etiqueta legible del tipo de fecha, para el pie de la nota. */
export function textoFuente(fuente: FuenteAgenda): string {
  switch (fuente) {
    case 'cumpleanos':
      return 'Cumpleaños';
    case 'aniversario_club':
      return 'Aniversario de club';
    case 'aniversario_seleccion':
      return 'Aniversario de debut en selección';
    default:
      return 'Fecha señalada';
  }
}
