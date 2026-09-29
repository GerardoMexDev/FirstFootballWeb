/**
 * Links a las carpetas de Dropbox de cada jugador (botones "Fotografías" / "Match Day").
 * El dato es manual (Excel → `jugadores.dropbox_*_url`, migración 0023) y se muestra en la
 * ficha del jugador, el panel del partido, la tarjeta de la lista y el hero.
 *
 * Puro. `linkSeguro` es la defensa para el `href`: solo pasa `https://` — un valor mal cargado
 * (`javascript:…`, `http://…`, texto suelto) queda como "sin link" (botón deshabilitado).
 *
 * Football First. Creado 2026-09-28.
 */

export interface LinksDropbox {
  fotografias: string | null;
  matchday: string | null;
}

export const SIN_LINKS: LinksDropbox = { fotografias: null, matchday: null };

/** Devuelve la URL si es `https://` bien formada; si no, `null`. */
export function linkSeguro(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url.trim()).protocol === 'https:' ? url.trim() : null;
  } catch {
    return null;
  }
}

/** Fila mínima de `jugadores` con los dos links. */
export interface FilaLinksDropbox {
  id: string;
  dropbox_fotografias_url: string | null;
  dropbox_matchday_url: string | null;
}

/**
 * `{ jugadorId: LinksDropbox }` ya saneado. Objeto plano (no `Map`) para que viaje igual
 * como prop de Server → Client Component que como JSON de `/api/paneles/partido`.
 */
export function aMapaLinks(filas: FilaLinksDropbox[]): Record<string, LinksDropbox> {
  const mapa: Record<string, LinksDropbox> = {};
  for (const f of filas) {
    mapa[f.id] = {
      fotografias: linkSeguro(f.dropbox_fotografias_url),
      matchday: linkSeguro(f.dropbox_matchday_url),
    };
  }
  return mapa;
}
