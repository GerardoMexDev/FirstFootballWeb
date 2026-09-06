/**
 * Barra superior de la app. Emite el marcado `.top` de la demo:
 * marca + nav + acciones (buscador ⌘K, cambio de tema, menú de usuario).
 *
 * La marca, la nav, el buscador ⌘K y el toggle de tema ya funcionan. El menú de usuario
 * muestra el perfil real y cierra sesión; "Mi perfil" / "Cambiar contraseña" /
 * "Notificaciones" abren el panel de perfil (sesión aparte, por eso siguen deshabilitados).
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Nav } from '@/components/layout/Nav';
import { Ico } from '@/components/comunes/Ico';
import { Buscador } from '@/components/buscador/Buscador';
import { ToggleTema } from '@/components/layout/ToggleTema';
import { crearClienteNavegador } from '@/lib/supabase/cliente-navegador';
import type { Tema } from '@/lib/sesion/sesion-actual';

export interface PerfilBarra {
  usuarioId: string;
  nombreCompleto: string;
  cargo: string;
  email: string;
  tema: Tema;
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
          <Buscador />

          <ToggleTema usuarioId={perfil.usuarioId} temaInicial={perfil.tema} />

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
