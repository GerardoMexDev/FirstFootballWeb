/**
 * Shell de la app autenticada. Emite el marcado de la demo:
 * <div class="app on"> con la barra superior + <main class="wrap"> + los contenedores
 * fijos de overlay (velo, panel lateral, toast, buscador).
 *
 * Guarda de sesión: sin usuario, redirige a /login. El middleware ya lo hace primero
 * (ver middleware.ts), pero esta verificación server-side es la que de verdad protege
 * los Server Components de acá para abajo (no solo la navegación) — mismo criterio que
 * cualquier política RLS: sin chequeo propio, no se confía solo en la capa de arriba.
 */
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { BarraSuperior } from '@/components/layout/BarraSuperior';
import { PanelLateral } from '@/components/paneles/PanelLateral';
import { crearClienteServidor } from '@/lib/supabase/cliente-servidor';
import type { Database } from '@/lib/supabase/tipos-db';

type PerfilFilas = Pick<Database['public']['Tables']['perfiles']['Row'], 'nombre_completo' | 'cargo'>;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('nombre_completo, cargo')
    .eq('id', user.id)
    .returns<PerfilFilas[]>()
    .single();

  return (
    <>
      <a className="saltar" href="#v-partidos">
        Saltar al contenido
      </a>
      <div className="app on" id="app">
        <BarraSuperior
          perfil={{
            nombreCompleto: perfil?.nombre_completo || '',
            cargo: perfil?.cargo || 'Prueba',
            email: user.email ?? '',
          }}
        />
        <main className="wrap">{children}</main>
      </div>

      {/* Panel lateral de detalle (partido / jugador). Se abre por la URL (?panel=…). */}
      <Suspense fallback={null}>
        <PanelLateral />
      </Suspense>

      {/* Toast — se cablea en la sesión de buscador/tema */}
      <div className="toast" id="toast" role="status" aria-live="polite" />
    </>
  );
}
