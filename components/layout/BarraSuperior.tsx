/**
 * Barra superior de la app. Emite el marcado `.top` de la demo:
 * marca + nav + acciones (buscador ⌘K, cambio de tema, menú de usuario).
 *
 * ANDAMIAJE: la marca y la nav ya funcionan. El buscador, el toggle de tema y el
 * menú de usuario se cablean en sesiones siguientes (por eso los botones no hacen nada aún).
 */
import { Nav } from '@/components/layout/Nav';
import { Ico } from '@/components/comunes/Ico';

export function BarraSuperior() {
  return (
    <header className="top">
      <div className="top__in">
        <div className="brand">
          <span>
            <svg className="logo">
              <use href="#ff" />
            </svg>
          </span>
          <b>Football First</b>
          <span className="fase">Fase 1</span>
        </div>

        <Nav />

        <div className="top__acc">
          {/* TODO(sesión buscador): abrir modal .busca con ⌘K / click */}
          <button className="buscabtn" id="abrir-busca" aria-label="Buscar" disabled>
            <svg className="ico" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.6-3.6" />
            </svg>
            <span>Buscar</span>
            <kbd>⌘K</kbd>
          </button>

          {/* TODO(sesión tema): alternar data-theme en <html> y persistir preferencia */}
          <button className="icobtn" id="tema" aria-label="Cambiar tema" disabled>
            <svg className="ico luna" viewBox="0 0 24 24">
              <path d="M20 14.6A8.5 8.5 0 1 1 9.4 4a7 7 0 0 0 10.6 10.6Z" />
            </svg>
            <svg className="ico sol" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="4.2" />
              <path d="M12 2.6v2.1M12 19.3v2.1M2.6 12h2.1M19.3 12h2.1M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M18.7 5.3l-1.5 1.5M6.8 17.2l-1.5 1.5" />
            </svg>
          </button>

          {/* TODO(sesión auth): datos reales del perfil + menú desplegable + cerrar sesión */}
          <div className="who">
            <button className="who__btn" id="who-btn" aria-haspopup="true" aria-expanded="false" disabled>
              <div className="who__t">
                <b>—</b>
                <span>Sin sesión</span>
              </div>
              <span className="who__av" id="who-av" aria-hidden="true">
                <Ico nombre="globo" clase="ico ico--sm" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
