/**
 * Texto que copia el botón "Copiar datos del partido" (0030): lo pega el Diseñador en
 * Photoshop sin tipear. Hora local y de Uruguay (si coinciden, una sola línea). Puro.
 *
 * Football First. Creado 2026-09-30.
 */
import { DateTime } from 'luxon';

const UY = 'America/Montevideo';
export function textoCopiarPartido(p: {
  local: string | null; visitante: string | null; inicioUtc: string | null;
  zona: string | null; estadio: string | null; ciudad: string | null;
}): string {
  const lineas = [`${p.local ?? '?'} vs ${p.visitante ?? '?'}`];
  if (p.inicioUtc) {
    const enSede = DateTime.fromISO(p.inicioUtc, { zone: 'utc' }).setZone(p.zona ?? UY).setLocale('es');
    const enUy = DateTime.fromISO(p.inicioUtc, { zone: 'utc' }).setZone(UY);
    const fecha = enSede.toFormat("cccc d 'de' LLLL");
    lineas.push(fecha.charAt(0).toUpperCase() + fecha.slice(1));
    const hl = enSede.toFormat('HH:mm');
    const hu = enUy.toFormat('HH:mm');
    lineas.push(hl === hu ? `${hu} hora de Uruguay (misma hora local)` : `${hl} hora local · ${hu} hora de Uruguay`);
  } else {
    lineas.push('Fecha a confirmar');
  }
  const lugar = [p.estadio, p.ciudad].filter(Boolean).join(', ');
  if (lugar) lineas.push(lugar);
  return lineas.join('\n');
}
