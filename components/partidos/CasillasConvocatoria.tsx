/**
 * Casillas "Convocado: <jugador>" en la tarjeta de un partido de la selección uruguaya (0032).
 * Tildar = ese partido pasa a Match Day con la cara del jugador y su ticket automático.
 * Habilitadas solo para Administrador y Community Manager (la base lo vuelve a validar).
 * Optimista, como `CasillasDiseno`: cambia al instante y vuelve atrás si el servidor la rechaza.
 * Estilos `.csds` / `.csd` (los de las casillas de diseño).
 *
 * Football First. Creado 2026-09-30.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteNavegador } from '@/lib/supabase/cliente-navegador';
import { convocar } from '@/lib/partidos/convocatoria';

export interface Convocable {
  id: string;
  nombre: string;
}

/** Lo que la página le pasa a la lista para armar las casillas de cada partido de la selección. */
export interface DatosConvocatoria {
  convocables: Convocable[];
  /** `{ partidoId: [jugadorId…] }` de los ya convocados. */
  convocados: Record<string, string[]>;
  /** Administrador o Community Manager. */
  puedeMarcar: boolean;
}

export function CasillasConvocatoria({
  partidoId,
  convocables,
  convocados,
  puedeMarcar,
}: {
  partidoId: string;
  convocables: Convocable[];
  /** ids de los jugadores ya convocados a este partido. */
  convocados: string[];
  puedeMarcar: boolean;
}) {
  const router = useRouter();
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(convocados));
  const [enviando, setEnviando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (convocables.length === 0) return null;

  async function cambiar(jugadorId: string, nuevo: boolean) {
    const poner = (valor: boolean) =>
      setMarcados((prev) => {
        const s = new Set(prev);
        if (valor) s.add(jugadorId);
        else s.delete(jugadorId);
        return s;
      });
    poner(nuevo);
    setEnviando(jugadorId);
    setError(null);
    const r = await convocar(crearClienteNavegador(), partidoId, jugadorId, nuevo);
    setEnviando(null);
    if (!r.ok) {
      poner(!nuevo);
      setError(r.mensaje);
      return;
    }
    router.refresh();
  }

  return (
    <span className="csds">
      {convocables.map((j) => (
        <label key={j.id} className="csd">
          <input
            type="checkbox"
            checked={marcados.has(j.id)}
            disabled={!puedeMarcar || enviando !== null}
            onChange={(e) => void cambiar(j.id, e.target.checked)}
          />
          Convocado: {j.nombre}
        </label>
      ))}
      {error && (
        <span role="alert" className="csd__err">
          {error}
        </span>
      )}
    </span>
  );
}
