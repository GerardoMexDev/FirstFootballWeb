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
  'nombre_completo' | 'cargo' | 'tema' | 'avisos'
>;

export type Tema = 'claro' | 'oscuro';

/** Preferencias de notificación (el envío es Fase 2; esto solo persiste la elección). */
export interface Avisos {
  hitos: boolean;
  partidos: boolean;
  resumen: boolean;
}

export const AVISOS_POR_DEFECTO: Avisos = { hitos: true, partidos: true, resumen: true };

export interface Sesion {
  usuarioId: string;
  email: string;
  nombreCompleto: string;
  cargo: string;
  tema: Tema;
  avisos: Avisos;
}

/** Normaliza el jsonb crudo de `perfiles.avisos` a la forma `Avisos` (todo booleano). */
function aAvisos(crudo: unknown): Avisos {
  const o = (crudo && typeof crudo === 'object' ? crudo : {}) as Record<string, unknown>;
  return {
    hitos: o.hitos !== false,
    partidos: o.partidos !== false,
    resumen: o.resumen !== false,
  };
}

export const sesionActual = cache(async (): Promise<Sesion | null> => {
  const supabase = crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('nombre_completo, cargo, tema, avisos')
    .eq('id', user.id)
    .returns<FilaPerfil[]>()
    .single();

  return {
    usuarioId: user.id,
    email: user.email ?? '',
    nombreCompleto: perfil?.nombre_completo || '',
    cargo: perfil?.cargo || 'Prueba',
    tema: perfil?.tema === 'oscuro' ? 'oscuro' : 'claro',
    avisos: aAvisos(perfil?.avisos),
  };
});
