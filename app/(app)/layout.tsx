/**
 * Shell de la app autenticada. Emite el marcado de la demo:
 * <div class="app on"> con la barra superior + <main class="wrap"> + los contenedores
 * fijos de overlay (velo, panel lateral, toast, buscador).
 *
 * ANDAMIAJE: acá va, en la sesión de auth, la verificación de sesión (redirigir a /login
 * si no hay usuario). Por ahora renderiza el shell para poder ver las vistas.
 */
import { BarraSuperior } from '@/components/layout/BarraSuperior';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a className="saltar" href="#v-partidos">
        Saltar al contenido
      </a>
      <div className="app on" id="app">
        <BarraSuperior />
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
