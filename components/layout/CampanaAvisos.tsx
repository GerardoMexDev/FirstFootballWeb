/**
 * Campanita de avisos del sistema en la barra superior, solo para el Administrador (el layout no
 * los pide para otros cargos y la base tampoco se los devuelve): "La fuente de … no se actualiza
 * desde el dd/mm", "Traspaso detectado: …". Reemplaza al cartel que iba arriba de cada vista
 * (pedido de Gerardo 2026-10-05: al abrir la web parecía que "todo estaba mal"). Sin avisos no
 * se renderiza. Mismo desplegable `.drop` que el contador de tickets.
 *
 * Accesibilidad: Escape cierra y devuelve el foco al botón.
 *
 * Football First. Creado 2026-10-05 (antes: AvisosSistema, 2026-09-30).
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { Ico } from '@/components/comunes/Ico';
import type { AvisoSistema } from '@/lib/sistema/avisos-sistema';

export function CampanaAvisos({ avisos }: { avisos: AvisoSistema[] }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function fuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setAbierto(false);
        botonRef.current?.focus();
      }
    }
    document.addEventListener('click', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('click', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  if (!avisos.length) return null;
  const n = avisos.length;

  return (
    <div className="avc" ref={ref}>
      <button
        type="button"
        ref={botonRef}
        className="avc__btn"
        aria-haspopup="true"
        aria-expanded={abierto}
        aria-label={`${n} aviso${n === 1 ? '' : 's'} del sistema`}
        onClick={() => setAbierto((v) => !v)}
      >
        <Ico nombre="campana" clase="ico ico--sm" />
        <b>{n}</b>
      </button>
      <div className={abierto ? 'drop on' : 'drop'}>
        <div className="drop__h">
          <div>
            <b>Avisos del sistema</b>
            <span>Solo los ve el Administrador</span>
          </div>
        </div>
        <ul className="avc__l">
          {avisos.map((a) => (
            <li key={a.clave} className="avc__i">
              <Ico nombre="alerta" clase="ico ico--sm" />
              <span>{a.texto}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
