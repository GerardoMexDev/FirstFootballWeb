/**
 * Datos del panel de detalle de partido, como JSON para el panel lateral.
 * Usa el cliente SSR (cookies del usuario) → RLS aplica. 404 si el partido no existe.
 *
 * Football First (Fase 1). Creado 2026-09-06.
 */
import { NextResponse } from 'next/server';
import { cargarDetallePartido } from '@/lib/paneles/cargar-detalle-partido';
import { crearClienteServidor } from '@/lib/supabase/cliente-servidor';

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta el parámetro id.' }, { status: 400 });

  const bundle = await cargarDetallePartido(crearClienteServidor(), id);
  if (!bundle) return NextResponse.json({ error: 'Partido no encontrado.' }, { status: 404 });

  return NextResponse.json(bundle);
}
