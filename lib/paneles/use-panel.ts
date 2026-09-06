/**
 * Estado del panel lateral, en la URL. `?panel=jugador&id=…` (o `partido`).
 *
 * Abrir = agregar los params al path actual (sin scrollear). Cerrar = sacarlos. Así el
 * panel se abre desde cualquier vista, el botón "atrás" del navegador lo cierra, y las
 * rutas propias (`/jugadores/[id]`) quedan intactas como enlace directo.
 *
 * Nombre en inglés (`usePanel`, no `usarPanel`) a propósito: el prefijo `use` es un
 * protocolo de React — la regla `react-hooks/rules-of-hooks` y el análisis del compilador
 * solo reconocen un hook si el nombre empieza con `use`. Es la única excepción a "todo en
 * español" del proyecto, igual que `className` o `useState`.
 *
 * Football First (Fase 1). Creado 2026-09-06.
 */
'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type TipoPanel = 'jugador' | 'partido';

export interface EstadoPanel {
  tipo: TipoPanel | null;
  id: string | null;
  abrir: (tipo: TipoPanel, id: string) => void;
  cerrar: () => void;
}

export function usePanel(): EstadoPanel {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const tipoCrudo = params.get('panel');
  const tipo: TipoPanel | null = tipoCrudo === 'jugador' || tipoCrudo === 'partido' ? tipoCrudo : null;
  const id = tipo ? params.get('id') : null;

  const abrir = useCallback(
    (t: TipoPanel, i: string) => {
      const q = new URLSearchParams(Array.from(params.entries()));
      q.set('panel', t);
      q.set('id', i);
      router.push(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const cerrar = useCallback(() => {
    const q = new URLSearchParams(Array.from(params.entries()));
    q.delete('panel');
    q.delete('id');
    const cadena = q.toString();
    router.push(cadena ? `${pathname}?${cadena}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  return { tipo, id: id && tipo ? id : null, abrir, cerrar };
}
