/**
 * Datos para el buscador ⌘K: el plantel + los próximos partidos, para filtrar en el cliente
 * (con 6 jugadores y ~30 partidos, precargar una vez y filtrar al tipear es instantáneo).
 * Cliente SSR (cookies del usuario) → RLS aplica.
 *
 * Football First (Fase 1). Creado 2026-09-06.
 */
import { NextResponse } from 'next/server';
import { RepositorioJugadoresSupabase } from '@/lib/repositorios/repositorio-jugadores';
import { RepositorioPartidosSupabase } from '@/lib/repositorios/repositorio-partidos';
import { crearClienteServidor } from '@/lib/supabase/cliente-servidor';

export async function GET() {
  const supabase = crearClienteServidor();
  const [jugadores, partidos] = await Promise.all([
    new RepositorioJugadoresSupabase(supabase).listar(),
    new RepositorioPartidosSupabase(supabase).listarProximos(),
  ]);
  return NextResponse.json({ jugadores, partidos });
}
