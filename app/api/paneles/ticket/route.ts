/**
 * Datos del panel del ticket, como JSON para el panel lateral. Cliente SSR (cookies del
 * usuario) → RLS aplica. 404 si no existe o no se puede leer.
 *
 * Football First. Creado 2026-09-28.
 */
import { NextResponse } from 'next/server';
import { cargarDetalleTicket } from '@/lib/tickets/cargar-detalle-ticket';
import { crearClienteServidor } from '@/lib/supabase/cliente-servidor';

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta el parámetro id.' }, { status: 400 });

  const bundle = await cargarDetalleTicket(crearClienteServidor(), id);
  if (!bundle) return NextResponse.json({ error: 'Ticket no encontrado.' }, { status: 404 });

  return NextResponse.json(bundle);
}
