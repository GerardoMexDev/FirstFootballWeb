/**
 * Middleware de sesión. Corre en cada request (menos assets estáticos):
 * - Refresca el JWT de Supabase en las cookies (patrón oficial de @supabase/ssr), para que
 *   los Server Components siempre lean una sesión vigente.
 * - Sin sesión y pidiendo una ruta privada -> redirige a /login.
 * - Con sesión y pidiendo /login -> redirige a /partidos (no tiene sentido loguearse dos veces).
 * - Más de 12 h sin usar la web -> cierra la sesión de este dispositivo y manda a
 *   /login?motivo=inactividad (cookie ff_actividad, ver lib/sesion/inactividad.ts; 2026-10-05).
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_ACTIVIDAD, sesionVencidaPorInactividad } from '@/lib/sesion/inactividad';

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

  if (user && sesionVencidaPorInactividad(request.cookies.get(COOKIE_ACTIVIDAD)?.value, Date.now())) {
    // scope local: revoca solo la sesión de este dispositivo; signOut borra las cookies de
    // Supabase vía setAll (en `response`) y se copian a la redirección.
    await supabase.auth.signOut({ scope: 'local' });
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '?motivo=inactividad';
    const redireccion = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redireccion.cookies.set(cookie));
    redireccion.cookies.delete(COOKIE_ACTIVIDAD);
    return redireccion;
  }

  const esRutaPublica = RUTAS_PUBLICAS.some(
    (ruta) => request.nextUrl.pathname === ruta || request.nextUrl.pathname.startsWith(`${ruta}/`),
  );

  if (!user && !esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const redireccion = NextResponse.redirect(url);
    redireccion.cookies.delete(COOKIE_ACTIVIDAD);
    return redireccion;
  }

  if (user && esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = '/partidos';
    return NextResponse.redirect(url);
  }

  if (user) {
    // Último uso de la web en este dispositivo (se renueva en cada pedido).
    response.cookies.set(COOKIE_ACTIVIDAD, String(Date.now()), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  } else {
    // Sin sesión (p. ej. en /login): una marca vieja no debe cerrar el próximo login.
    response.cookies.delete(COOKIE_ACTIVIDAD);
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
