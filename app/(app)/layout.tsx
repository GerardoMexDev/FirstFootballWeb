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
 *
 * Saludo de bienvenida ("Buenas tardes, Felipe") arriba de cada vista, con la hora de
 * Uruguay. El layout ya es dinámico (lee cookies), así que se calcula en cada request.
 */
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { DateTime } from 'luxon';
import { BarraSuperior } from '@/components/layout/BarraSuperior';
import { PanelLateral } from '@/components/paneles/PanelLateral';
import { sesionActual } from '@/lib/sesion/sesion-actual';
import { saludoPorHora, primerNombre } from '@/lib/sesion/saludo';
import { ZONA_AGENCIA } from '@/lib/fechas/zonas';
import { RepositorioTicketsSupabase } from '@/lib/repositorios/repositorio-tickets';
import { crearClienteServidor } from '@/lib/supabase/cliente-servidor';
import { pendientesDe } from '@/lib/tickets/permisos';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sesion = await sesionActual();
  if (!sesion) redirect('/login');

  const saludo = saludoPorHora(DateTime.now().setZone(ZONA_AGENCIA).hour);
  const nombre = primerNombre(sesion.nombreCompleto);
  const hoyUy = DateTime.now().setZone(ZONA_AGENCIA).toISODate() ?? '';
  // Degradación elegante: si la lectura de tickets falla, la barra se ve sin contador.
  const tickets = await new RepositorioTicketsSupabase(crearClienteServidor()).listarResumen().catch(() => []);
  const pendientes = pendientesDe(sesion.cargo, sesion.usuarioId, tickets);

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
          pendientes={pendientes}
          hoyUy={hoyUy}
        />
        <main className="wrap">
          <p className="saludo" id="saludo">
            {nombre ? (
              <>
                {saludo}, <b>{nombre}</b>
              </>
            ) : (
              saludo
            )}
          </p>
          {children}
        </main>
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
