/**
 * Toggle de tema claro/oscuro de la barra superior (`#tema` de la demo). La preferencia se
 * guarda en `perfiles.tema` (sigue al usuario entre dispositivos); el `<html data-theme>`
 * inicial lo pinta el layout raíz server-side, así que acá no hay parpadeo al cargar.
 *
 * Al alternar: primero se cambia `data-theme` en `<html>` (feedback inmediato), después se
 * persiste. Si la escritura falla, el cambio visual ya quedó — se registra en consola y en
 * la próxima carga el layout leerá el valor viejo del perfil.
 *
 * SVG `.luna`/`.sol` y clase `.icobtn` verbatim de la demo; el CSS muestra uno u otro según
 * `[data-theme]`.
 *
 * Football First (Fase 1). Creado 2026-09-06.
 */
'use client';

import { useState } from 'react';
import { crearClienteNavegador } from '@/lib/supabase/cliente-navegador';
import type { Database } from '@/lib/supabase/tipos-db';
import type { Tema } from '@/lib/sesion/sesion-actual';

export function ToggleTema({ usuarioId, temaInicial }: { usuarioId: string; temaInicial: Tema }) {
  const [tema, setTema] = useState<Tema>(temaInicial);

  async function alternar() {
    const nuevo: Tema = tema === 'oscuro' ? 'claro' : 'oscuro';
    setTema(nuevo);
    document.documentElement.dataset.theme = nuevo === 'oscuro' ? 'dark' : 'light';

    // El payload se tipa contra el `Update` generado (atrapa un typo de columna), pero el
    // builder de esta combinación de versiones (@supabase/ssr 0.5 + postgrest-js 2.115)
    // infiere `never` para el argumento de `.update()` — de ahí el `as never`. Se va cuando
    // se suba `@supabase/ssr` (ver avances.md §10). Mismo espíritu que el `.returns<T[]>()`
    // de los repositorios para las lecturas.
    const cambio: Database['public']['Tables']['perfiles']['Update'] = { tema: nuevo };
    const { error } = await crearClienteNavegador()
      .from('perfiles')
      .update(cambio as never)
      .eq('id', usuarioId);
    if (error) {
      console.error('No se pudo guardar la preferencia de tema:', error.message);
    }
  }

  return (
    <button
      className="icobtn"
      id="tema"
      type="button"
      aria-label={`Cambiar a modo ${tema === 'oscuro' ? 'claro' : 'oscuro'}`}
      aria-pressed={tema === 'oscuro'}
      onClick={alternar}
    >
      <svg className="ico luna" viewBox="0 0 24 24">
        <path d="M20 14.6A8.5 8.5 0 1 1 9.4 4a7 7 0 0 0 10.6 10.6Z" />
      </svg>
      <svg className="ico sol" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.6v2.1M12 19.3v2.1M2.6 12h2.1M19.3 12h2.1M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M18.7 5.3l-1.5 1.5M6.8 17.2l-1.5 1.5" />
      </svg>
    </button>
  );
}
