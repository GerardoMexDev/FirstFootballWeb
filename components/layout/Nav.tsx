/**
 * Navegación principal. Emite EXACTAMENTE el marcado `.nav` de la demo:
 * <nav class="nav"><button>…</button></nav>. El CSS de la demo estiliza `.nav button`,
 * por eso son <button> y no <a>; la navegación va por el router.
 */
'use client';

import { usePathname, useRouter } from 'next/navigation';

const SECCIONES = [
  { v: 'partidos', etiqueta: 'Partidos' },
  { v: 'calendario', etiqueta: 'Calendario' },
  { v: 'jugadores', etiqueta: 'Jugadores' },
] as const;

export function Nav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav className="nav" id="nav" aria-label="Secciones">
      {SECCIONES.map(({ v, etiqueta }) => {
        const activa = pathname === `/${v}` || pathname.startsWith(`/${v}/`);
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
