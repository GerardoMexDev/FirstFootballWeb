/**
 * Tarjeta chica de una fecha de Contenido (cumpleaños / aniversarios) dentro de la lista de
 * `/partidos`, debajo de los partidos del mismo día. Más liviana que `.match` a propósito:
 * se tiene que leer como "algo de ese día", no como otro partido.
 *
 * Cumpleaños y debuts abren el panel del jugador (mismo criterio que Calendario General);
 * el aniversario de club queda como `<div>`: `refId` apunta al club y no hay panel de club.
 *
 * Football First. Creado 2026-09-28.
 */
'use client';

import { Ico } from '@/components/comunes/Ico';
import { usePanel } from '@/lib/paneles/use-panel';
import type { FechaContenido, FuenteFecha } from '@/lib/partidos/fechas-contenido';

const META: Record<FuenteFecha, { icono: 'torta' | 'medalla' | 'globo' | 'trofeo'; etiqueta: string }> = {
  cumpleanos: { icono: 'torta', etiqueta: 'Cumpleaños' },
  aniversario_debut: { icono: 'medalla', etiqueta: 'Debut profesional' },
  aniversario_seleccion: { icono: 'globo', etiqueta: 'Debut en selección' },
  aniversario_club: { icono: 'trofeo', etiqueta: 'Aniversario de club' },
};

export function TarjetaFecha({ fecha }: { fecha: FechaContenido }) {
  const { abrir } = usePanel();
  const { icono, etiqueta } = META[fecha.fuente];
  const contenido = (
    <>
      <span className="fechac__ico" aria-hidden="true">
        <Ico nombre={icono} clase="ico ico--sm" />
      </span>
      <span className="fechac__t">
        <small>{etiqueta}</small>
        <b>{fecha.titulo}</b>
      </span>
    </>
  );

  if (fecha.fuente !== 'aniversario_club' && fecha.refId) {
    const refId = fecha.refId;
    return (
      <button type="button" className="fechac fechac--link" onClick={() => abrir('jugador', refId, fecha.fuente)}>
        {contenido}
        <Ico nombre="chevron" clase="ico ico--sm fechac__ir" />
      </button>
    );
  }
  return <div className="fechac">{contenido}</div>;
}
