/**
 * Datos de "Mi cuenta" para el panel de perfil: nombre, correo, cargo y preferencias de
 * aviso. Las ESCRITURAS (nombre, contraseña, avisos) las hace el propio panel desde el
 * cliente (RLS permite la fila propia + `auth.updateUser` con la sesión activa).
 *
 * Football First (Fase 1). Creado 2026-09-06.
 */
import { NextResponse } from 'next/server';
import { sesionActual } from '@/lib/sesion/sesion-actual';

export async function GET() {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  return NextResponse.json({
    usuarioId: sesion.usuarioId,
    nombreCompleto: sesion.nombreCompleto,
    email: sesion.email,
    cargo: sesion.cargo,
    avisos: sesion.avisos,
  });
}
