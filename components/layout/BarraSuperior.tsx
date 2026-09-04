/**
 * Barra superior de la app. Emite el marcado `.top` de la demo:
 * marca + nav + acciones (buscador ⌘K, cambio de tema, menú de usuario).
 *
 * ANDAMIAJE: la marca y la nav ya funcionan. El buscador y el toggle de tema se cablean
 * en sesiones siguientes. El menú de usuario (sesión de auth) ya muestra el perfil real
 * y cierra sesión; "Mi perfil" / "Cambiar contraseña" / "Notificaciones" abren paneles
 * que se cablean en la sesión de paneles (por eso siguen deshabilitados).
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Nav } from '@/components/layout/Nav';
import { Ico } from '@/components/comunes/Ico';
import { crearClienteNavegador } from '@/lib/supabase/cliente-navegador';

export interface PerfilBarra {
  nombreCompleto: string;
  cargo: string;
  email: string;
}

export function BarraSuperior({ perfil }: { perfil: PerfilBarra }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  // Cierra el desplegable al hacer click afuera o al presionar Escape (mismo criterio que
  // el buscador ⌘K: un overlay contextual se cierra con las dos vías, no solo con un botón).
  useEffect(() => {
    if (!abierto) return;
    function alHacerClickFuera(evento: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(evento.target as Node)) {
        setAbierto(false);
      }
    }
    function alPresionarTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setAbierto(false);
    }
    document.addEventListener('click', alHacerClickFuera);
    document.addEventListener('keydown', alPresionarTecla);
    return () => {
      document.removeEventListener('click', alHacerClickFuera);
      document.removeEventListener('keydown', alPresionarTecla);
    };
  }, [abierto]);

  async function cerrarSesion() {
    setSaliendo(true);
    const supabase = crearClienteNavegador();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh(); // fuerza a los Server Components a releer que ya no hay sesión
  }

  const inicial = (perfil.nombreCompleto.trim().charAt(0) || perfil.email.charAt(0) || '?').toUpperCase();

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

          <div className="who" ref={contenedorRef}>
            <button
              className="who__btn"
              id="who-btn"
              aria-haspopup="true"
              aria-expanded={abierto}
              onClick={() => setAbierto((valor) => !valor)}
            >
              <div className="who__t">
                <b>{perfil.nombreCompleto || 'Sin nombre'}</b>
                <span>{perfil.cargo}</span>
              </div>
              <span className="who__av" id="who-av" aria-hidden="true">
                {inicial}
              </span>
            </button>

            <div className={abierto ? 'drop on' : 'drop'} id="drop">
              <div className="drop__h" id="drop-h">
                <span className="av" aria-hidden="true">
                  {inicial}
                </span>
                <div>
                  <b>{perfil.nombreCompleto || 'Sin nombre'}</b>
                  <span>{perfil.email}</span>
                  <span className="drop__rol">{perfil.cargo}</span>
                </div>
              </div>
              {/* TODO(sesión paneles): Mi perfil / Cambiar contraseña / Notificaciones */}
              <button data-perfil="datos" disabled>
                <Ico nombre="persona" />
                Mi perfil
              </button>
              <button data-perfil="clave" disabled>
                <Ico nombre="candado" />
                Cambiar contraseña
              </button>
              <button data-perfil="avisos" disabled>
                <Ico nombre="campana" />
                Notificaciones
              </button>
              <div className="drop__sep" />
              <button className="sal" id="salir" onClick={cerrarSesion} disabled={saliendo}>
                <Ico nombre="salir" />
                {saliendo ? 'Saliendo…' : 'Cerrar sesión'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
