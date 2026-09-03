/**
 * Raíz del sitio. La app entra siempre por la vista `partidos`.
 * (Cuando exista auth, el middleware mandará a /login si no hay sesión.)
 */
import { redirect } from 'next/navigation';

export default function Inicio() {
  redirect('/partidos');
}
