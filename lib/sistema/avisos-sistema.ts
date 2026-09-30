/**
 * Avisos del sistema para el cartel del Administrador (migración 0029, `avisos_sistema()`):
 * fuentes de datos caídas, traspasos detectados y jugadores a revisar. La función de la base
 * ya devuelve vacío a quien no es Administrador; acá solo se lee.
 *
 * Degradación elegante: si la lectura falla, sin cartel (la app sigue andando).
 *
 * Football First. Creado 2026-09-30.
 */
import type { crearClienteServidor } from '@/lib/supabase/cliente-servidor';

export interface AvisoSistema {
  clave: string;
  texto: string;
}

type FilaAviso = { clave: string; texto: string; desde: string | null };

export async function leerAvisosSistema(supabase: ReturnType<typeof crearClienteServidor>): Promise<AvisoSistema[]> {
  const { data, error } = await supabase.rpc('avisos_sistema');
  if (error) {
    console.error('avisos del sistema:', error.message);
    return [];
  }
  // El generador de tipos marca las funciones sin argumentos con `Args: never`, y eso deja
  // `data` como `never`: se tipa a mano con lo que devuelve la función (0029).
  const filas = (data ?? []) as unknown as FilaAviso[];
  return filas.map((a) => ({ clave: a.clave, texto: a.texto }));
}
