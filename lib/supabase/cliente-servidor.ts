/**
 * Cliente de Supabase para el servidor (Server Components, Route Handlers, Server Actions).
 * Lee y escribe las cookies de sesión para SSR. Usa la clave anon + el JWT del usuario.
 * La service_role vive solo en Edge Functions y scripts, nunca acá.
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/supabase/tipos-db';

type CookieAConfigurar = { name: string; value: string; options: CookieOptions };

export function crearClienteServidor() {
  const almacenCookies = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return almacenCookies.getAll();
        },
        setAll(cookiesAConfigurar: CookieAConfigurar[]) {
          // En Server Components no siempre se pueden setear cookies; se ignora el error.
          // El middleware (a agregar en la sesión de auth) refresca la sesión.
          try {
            cookiesAConfigurar.forEach(({ name, value, options }) => {
              almacenCookies.set(name, value, options);
            });
          } catch {
            /* llamado desde un Server Component sin respuesta mutable: sin efecto */
          }
        },
      },
    },
  );
}
