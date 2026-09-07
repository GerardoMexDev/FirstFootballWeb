/**
 * Middleware de sesión. Corre en cada request (menos assets estáticos):
 * - Refresca el JWT de Supabase en las cookies (patrón oficial de @supabase/ssr), para que
 *   los Server Components siempre lean una sesión vigente.
 * - Sin sesión y pidiendo una ruta privada -> redirige a /login.
 * - Con sesión y pidiendo /login -> redirige a /partidos (no tiene sentido loguearse dos veces).
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const RUTAS_PUBLICAS = ['/login'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesAConfigurar: { name: string; value: string; options: CookieOptions }[]) {
          // Hay que escribir la cookie en el request (para que la vea el resto de este mismo
          // request) y en la response (para que el navegador la guarde).
          cookiesAConfigurar.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesAConfigurar.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() (no getSession()) valida el JWT contra Supabase Auth, no solo lee la cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const esRutaPublica = RUTAS_PUBLICAS.some(
    (ruta) => request.nextUrl.pathname === ruta || request.nextUrl.pathname.startsWith(`${ruta}/`),
  );

  if (!user && !esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = '/partidos';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Todo MENOS: los internos de Next, el favicon, y cualquier archivo con extensión de
  // asset (las fotos de `public/jugadores` y `public/heroes`, fuentes, etc.). Sin la parte
  // de la extensión, el middleware corría sobre `/jugadores/nandez.webp` y lo redirigía a
  // /login (307) — en Vercel las fotos no cargaban.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:webp|png|jpg|jpeg|gif|svg|ico|avif|woff2?)$).*)'],
};
