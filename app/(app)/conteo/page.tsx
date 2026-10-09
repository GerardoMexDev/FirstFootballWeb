/**
 * `/conteo` sin período → el período en curso (`/conteo/2026-10`). Football First. Creado 2026-10-08.
 */
import { redirect } from 'next/navigation';
import { DateTime } from 'luxon';
import { periodoDeDia } from '@/lib/conteo/periodos';
import { ZONA_AGENCIA } from '@/lib/fechas/zonas';

export default function PaginaConteoActual() {
  redirect(`/conteo/${periodoDeDia(DateTime.now().setZone(ZONA_AGENCIA).toISODate() ?? '').clave}`);
}
