/**
 * El "Calendario general" se unió al calendario de Match Day en una sola vista con filtros
 * (2026-09-30). Esta dirección queda por enlaces viejos: lleva al filtro Contenido.
 *
 * Football First (Fase 1). Creado 2026-09-10 (Sesión 7); redirección 2026-09-30.
 */
import { redirect } from 'next/navigation';

export default function PaginaCalendarioGeneral() {
  redirect('/calendario?f=contenido');
}
