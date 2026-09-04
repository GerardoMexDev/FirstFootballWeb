/**
 * Cliente de Supabase para el navegador (Client Components).
 * Usa la clave anon + el JWT del usuario. NUNCA la service_role acá.
 */
'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/supabase/tipos-db';

export function crearClienteNavegador() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
