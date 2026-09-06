/**
 * Shell de la app autenticada. Emite el marcado de la demo:
 * <div class="app on"> con la barra superior + <main class="wrap"> + los contenedores
 * fijos de overlay (velo, panel lateral, toast, buscador).
 *
 * Guarda de sesión: sin usuario, redirige a /login. El middleware ya lo hace primero
 * (ver middleware.ts), pero esta verificación server-side es la que de verdad protege
 * los Server Components de acá para abajo (no solo la navegación) — mismo criterio que
 * cualquier política RLS: sin chequeo propio, no se confía solo en la capa de arriba.
 *
 * `sesionActual()` está envuelto en React.cache: el layout raíz ya lo llamó para el tema,
 * así que acá no hay una segunda ida a la BD.
 */
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { BarraSuperior } from '@/components/layout/BarraSuperior';
import { PanelLateral } from '@/components/paneles/PanelLateral';
import { sesionActual } from '@/lib/sesion/sesion-actual';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sesion = await sesionActual();
  if (!sesion) redirect('/login');

  return (
    <>
      <a className="saltar" href="#v-partidos">
        Saltar al contenido
      </a>
      <div className="app on" id="app">
        <BarraSuperior
          perfil={{
            usuarioId: sesion.usuarioId,
            nombreCompleto: sesion.nombreCompleto,
            cargo: sesion.cargo,
            email: sesion.email,
            tema: sesion.tema,
          }}
        />
        <main className="wrap">{children}</main>
      </div>

      {/* Panel lateral de detalle (partido / jugador). Se abre por la URL (?panel=…). */}
      <Suspense fallback={null}>
        <PanelLateral />
      </Suspense>

      {/* Toast — se cablea más adelante (sistema de toasts) */}
      <div className="toast" id="toast" role="status" aria-live="polite" />
    </>
  );
}
