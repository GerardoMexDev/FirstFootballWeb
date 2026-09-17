/**
 * Estado del panel lateral, en la URL. `?panel=jugador&id=…` · `?panel=partido&id=…` ·
 * `?panel=perfil` (sin id, o `&id=<pestaña>` para abrir en Datos / Contraseña / Notificaciones).
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

export type TipoPanel = 'jugador' | 'partido' | 'perfil' | 'jugador-contenido';

const TIPOS: readonly TipoPanel[] = ['jugador', 'partido', 'perfil', 'jugador-contenido'];

/**
 * Arma la URL que abre un panel, sin leer `useSearchParams` — para los componentes que
 * disparan un panel pero no viven dentro de una vista (buscador, menú de usuario) y no
 * quieren la dependencia de `<Suspense>`. No preserva otros query params (en esta app no hay).
 */
export function rutaPanel(pathname: string, tipo: TipoPanel, id?: string): string {
  const q = new URLSearchParams({ panel: tipo });
  if (id) q.set('id', id);
  return `${pathname}?${q.toString()}`;
}

export interface EstadoPanel {
  tipo: TipoPanel | null;
  /** Para jugador/partido: el id de la entidad. Para perfil: la pestaña inicial, o null. */
  id: string | null;
  /**
   * Qué dato destacar en la ficha del jugador (p.ej. `cumpleanos`, `aniversario_debut`) —
   * viene del evento del calendario que abrió el panel, para que el diseñador vea de un
   * vistazo qué se está festeciendo. `null` si el panel se abrió por otro camino (buscador,
   * grilla de plantel, próximos partidos).
   */
  destacar: string | null;
  /** `id` es obligatorio para jugador/partido; opcional para perfil (pestaña inicial). */
  abrir: (tipo: TipoPanel, id?: string, destacar?: string) => void;
  cerrar: () => void;
}

export function usePanel(): EstadoPanel {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const tipoCrudo = params.get('panel');
  const tipo = (TIPOS as readonly string[]).includes(tipoCrudo ?? '') ? (tipoCrudo as TipoPanel) : null;
  const id = tipo ? params.get('id') : null;
  const destacar = tipo ? params.get('destacar') : null;

  const abrir = useCallback(
    (t: TipoPanel, i?: string, d?: string) => {
      const q = new URLSearchParams(Array.from(params.entries()));
      q.set('panel', t);
      if (i) q.set('id', i);
      else q.delete('id');
      if (d) q.set('destacar', d);
      else q.delete('destacar');
      router.push(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const cerrar = useCallback(() => {
    const q = new URLSearchParams(Array.from(params.entries()));
    q.delete('panel');
    q.delete('id');
    q.delete('destacar');
    const cadena = q.toString();
    router.push(cadena ? `${pathname}?${cadena}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  return { tipo, id, destacar, abrir, cerrar };
}
