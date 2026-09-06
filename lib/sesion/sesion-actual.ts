/**
 * Carga la sesión actual (usuario de Supabase Auth + su fila de `perfiles`) UNA sola vez
 * por request: `React.cache` deduplica las llamadas entre el layout raíz (que necesita el
 * `tema` para pintar `<html data-theme>` sin parpadeo) y `app/(app)/layout.tsx` (que
 * necesita nombre/cargo para la barra y el guard de sesión).
 *
 * Sin sesión → `null` (p.ej. en `/login` y `/`).
 *
 * Football First (Fase 1). Creado 2026-09-06.
 */
import { cache } from 'react';
import { crearClienteServidor } from '@/lib/supabase/cliente-servidor';
import type { Database } from '@/lib/supabase/tipos-db';

type FilaPerfil = Pick<
  Database['public']['Tables']['perfiles']['Row'],
  'nombre_completo' | 'cargo' | 'tema'
>;

export type Tema = 'claro' | 'oscuro';

export interface Sesion {
  usuarioId: string;
  email: string;
  nombreCompleto: string;
  cargo: string;
  tema: Tema;
}

export const sesionActual = cache(async (): Promise<Sesion | null> => {
  const supabase = crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('nombre_completo, cargo, tema')
    .eq('id', user.id)
    .returns<FilaPerfil[]>()
    .single();

  return {
    usuarioId: user.id,
    email: user.email ?? '',
    nombreCompleto: perfil?.nombre_completo || '',
    cargo: perfil?.cargo || 'Prueba',
    tema: perfil?.tema === 'oscuro' ? 'oscuro' : 'claro',
  };
});
