/**
 * Datos de la ficha SLIM (servicio Contenido) para el panel lateral, como JSON.
 * Cliente SSR (cookies del usuario) → RLS. 404 si el jugador no existe, está inactivo o no
 * es del servicio Contenido.
 *
 * Football First (Fase 1). Creado 2026-09-10 (Sesión 7).
 */
import { NextResponse } from 'next/server';
import { cargarFichaContenido } from '@/lib/jugadores/cargar-ficha-contenido';
import { crearClienteServidor } from '@/lib/supabase/cliente-servidor';

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta el parámetro id.' }, { status: 400 });

  const bundle = await cargarFichaContenido(crearClienteServidor(), id);
  if (!bundle) return NextResponse.json({ error: 'Jugador no encontrado.' }, { status: 404 });

  return NextResponse.json(bundle);
}
