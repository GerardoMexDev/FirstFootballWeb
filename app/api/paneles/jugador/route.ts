/**
 * Datos del panel de detalle de jugador. Mismo contenido que la ruta `/jugadores/[id]`,
 * servido como JSON para que el panel lateral (Client Component en el shell) lo abra sin
 * recargar la vista de abajo.
 *
 * Usa el cliente SSR (cookies del usuario) → RLS aplica igual que en las páginas.
 * 404 si el jugador no existe o está inactivo.
 *
 * Football First (Fase 1). Creado 2026-09-06.
 */
import { NextResponse } from 'next/server';
import { cargarFichaJugador } from '@/lib/jugadores/cargar-ficha';
import { crearClienteServidor } from '@/lib/supabase/cliente-servidor';

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta el parámetro id.' }, { status: 400 });

  const bundle = await cargarFichaJugador(crearClienteServidor(), id);
  if (!bundle) return NextResponse.json({ error: 'Jugador no encontrado.' }, { status: 404 });

  return NextResponse.json(bundle);
}
