/**
 * Barra de pestañas inferior (celular y tablet, ≤ 960 px; decisión de Gerardo 2026-09-29):
 * Partidos · Match Day · General · Jugadores · Tickets, con ícono y nombre corto. La pestaña
 * Tickets muestra cuántos te esperan (mismo número que el globito de la barra de arriba).
 * En > 960 px no se ve (app.css) y manda `Nav`.
 *
 * Football First. Creado 2026-09-29.
 */
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Ico } from '@/components/comunes/Ico';
import { esSeccionActiva, seccionesPara } from '@/lib/navegacion/secciones';

export function BarraInferior({ cargo, pendientes }: { cargo: string; pendientes: number }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav className="binf" aria-label="Secciones">
      {seccionesPara(cargo).map(({ v, etiqueta, corta, icono }) => {
        const activa = esSeccionActiva(pathname, v);
        const n = v === 'tickets' ? pendientes : 0;
        return (
          <button
            key={v}
            type="button"
            className={activa ? 'binf__b on' : 'binf__b'}
            aria-current={activa ? 'page' : undefined}
            aria-label={n ? `${etiqueta}, ${n} te espera${n === 1 ? '' : 'n'}` : etiqueta}
            onClick={() => router.push(`/${v}`)}
          >
            <span className="binf__i">
              <Ico nombre={icono} />
              {n > 0 && (
                <span className="binf__n" aria-hidden="true">
                  {n}
                </span>
              )}
            </span>
            <span className="binf__t" aria-hidden="true">
              {corta}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
