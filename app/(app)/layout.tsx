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
import { BarraInferior } from '@/components/layout/BarraInferior';
import { PanelLateral } from '@/components/paneles/PanelLateral';
import { sesionActual } from '@/lib/sesion/sesion-actual';
import { saludoPorHora, primerNombre } from '@/lib/sesion/saludo';
import { ZONA_AGENCIA } from '@/lib/fechas/zonas';
import { pendientesDeSesion } from '@/lib/tickets/pendientes-de-sesion';
import { leerAvisosSistema } from '@/lib/sistema/avisos-sistema';
import { crearClienteServidor } from '@/lib/supabase/cliente-servidor';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sesion = await sesionActual();
  if (!sesion) redirect('/login');

  const saludo = saludoPorHora(DateTime.now().setZone(ZONA_AGENCIA).hour);
  const nombre = primerNombre(sesion.nombreCompleto);
  const hoyUy = DateTime.now().setZone(ZONA_AGENCIA).toISODate() ?? '';
  // Si la lectura de tickets falla, la barra se ve sin contador (ver pendientesDeSesion).
  const pendientes = await pendientesDeSesion();
  // Avisos de fuentes caídas y traspasos detectados (0029): solo el Administrador, en la campanita.
  const avisos = sesion.cargo === 'Administrador' ? await leerAvisosSistema(crearClienteServidor()) : [];

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
          avisos={avisos}
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
        {/* Pestañas abajo en celular/tablet (≤ 960 px); en desktop manda la nav de arriba. */}
        <BarraInferior cargo={sesion.cargo} pendientes={pendientes.length} />
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
