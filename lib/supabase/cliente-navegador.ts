/**
 * Cliente de Supabase para el navegador (Client Components).
 * Usa la clave anon + el JWT del usuario. NUNCA la service_role acá.
 */
'use client';

import { createBrowserClient } from '@supabase/ssr';

export function crearClienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
