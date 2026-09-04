/**
 * Shell de la app autenticada. Emite el marcado de la demo:
 * <div class="app on"> con la barra superior + <main class="wrap"> + los contenedores
 * fijos de overlay (velo, panel lateral, toast, buscador).
 *
 * Guarda de sesión: sin usuario, redirige a /login. El middleware ya lo hace primero
 * (ver middleware.ts), pero esta verificación server-side es la que de verdad protege
 * los Server Components de acá para abajo (no solo la navegación) — mismo criterio que
 * cualquier política RLS: sin chequeo propio, no se confía solo en la capa de arriba.
 */
import { redirect } from 'next/navigation';
import { BarraSuperior } from '@/components/layout/BarraSuperior';
import { crearClienteServidor } from '@/lib/supabase/cliente-servidor';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('nombre_completo, cargo')
    .eq('id', user.id)
    .single();

  return (
    <>
      <a className="saltar" href="#v-partidos">
        Saltar al contenido
      </a>
      <div className="app on" id="app">
        <BarraSuperior
          perfil={{
            nombreCompleto: perfil?.nombre_completo || '',
            cargo: perfil?.cargo || 'Prueba',
            email: user.email ?? '',
          }}
        />
        <main className="wrap">{children}</main>
      </div>

      {/* Overlays a nivel de app — se cablean en las sesiones de paneles y buscador */}
      <div className="velo" id="velo" />
      <aside className="panel" id="panel" role="dialog" aria-modal="true" aria-labelledby="panel-t">
        <div className="panel__top">
          <span className="label" id="panel-t">
            Detalle
          </span>
          <button className="panel__x" id="panel-x" aria-label="Cerrar">
            <svg className="ico" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="panel__b" id="panel-b" />
      </aside>
      <div className="toast" id="toast" role="status" aria-live="polite" />
    </>
  );
}
