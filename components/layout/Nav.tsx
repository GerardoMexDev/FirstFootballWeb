/**
 * Navegación principal (arriba, > 960 px). Emite EXACTAMENTE el marcado `.nav` de la demo:
 * <nav class="nav"><button>…</button></nav>. El CSS de la demo estiliza `.nav button`,
 * por eso son <button> y no <a>; la navegación va por el router.
 * Las secciones salen de `lib/navegacion/secciones.ts` (compartidas con `BarraInferior`).
 * En ≤ 960 px se oculta y manda la barra inferior (app.css).
 */
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { esSeccionActiva, seccionesPara } from '@/lib/navegacion/secciones';

export function Nav({ cargo }: { cargo: string }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav className="nav" id="nav" aria-label="Secciones">
      {seccionesPara(cargo).map(({ v, etiqueta }) => {
        const activa = esSeccionActiva(pathname, v);
        return (
          <button
            key={v}
            data-v={v}
            className={activa ? 'on' : undefined}
            aria-current={activa ? 'page' : undefined}
            onClick={() => router.push(`/${v}`)}
          >
            {etiqueta}
          </button>
        );
      })}
    </nav>
  );
}
