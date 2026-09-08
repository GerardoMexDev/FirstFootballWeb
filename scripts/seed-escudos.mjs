/**
 * Llena `clubes.escudo_url` con la URL del escudo de cada club (camino 1 de la charla de la
 * Sesión 6: hotlink al CDN del proveedor, sin descargar ni subir a Storage).
 *
 * No hace falta ninguna API key: la URL del logo es un patrón fijo derivado del `id_externo`
 * que ya está en la fila del club.
 *   · proveedor_externo = 'api-football' → https://media.api-sports.io/football/teams/<id>.png
 *     (es exactamente el valor del campo `team.logo` de cualquier respuesta de /teams)
 *   · proveedor_externo = 'espn'         → https://a.espncdn.com/i/teamlogos/soccer/500/<id>.png
 *
 * Antes de guardar, se verifica que la URL responda 200 (HEAD, con fallback a GET porque
 * algún CDN rechaza HEAD). Si no resuelve, la fila queda como estaba — el componente
 * `Escudo` ya cae a las iniciales cuando no hay `escudo_url` (o cuando la imagen falla).
 * Nunca se pisa un `escudo_url` existente con NULL.
 *
 * Idempotente: si la fila ya tiene la URL deseada no se toca ni se re-verifica. Volver a
 * correrlo solo intenta las que siguen sin escudo.
 *
 * Uso: node scripts/seed-escudos.mjs   (o: npm run seed:escudos)
 *
 * Football First (Fase 1). Creado 2026-09-08 (Sesión 6).
 */
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('.secretos/.env');
const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY en .secretos/.env');
  process.exit(1);
}

const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** URL del escudo según el proveedor, o null si no sabemos construirla para ese club. */
function urlEscudo({ proveedor_externo, id_externo }) {
  if (!id_externo) return null;
  // Solo ids numéricos: los dos proveedores usan enteros; algo con otra forma no es un id de equipo.
  if (!/^\d+$/.test(id_externo)) return null;
  switch (proveedor_externo) {
    case 'api-football':
      return `https://media.api-sports.io/football/teams/${id_externo}.png`;
    case 'espn':
      return `https://a.espncdn.com/i/teamlogos/soccer/500/${id_externo}.png`;
    default:
      return null;
  }
}

/** ¿La URL de imagen responde 200? HEAD primero; si el CDN no lo soporta, se prueba GET. */
async function existe(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const ctrl = AbortSignal.timeout(8000);
      const r = await fetch(url, { method, signal: ctrl });
      if (r.ok) return true;
      // 405 (method not allowed) → probar el siguiente método; otro código → no existe.
      if (r.status !== 405) return false;
    } catch {
      // timeout / red caída → tratamos como "no verificable" y seguimos con el otro método.
    }
  }
  return false;
}

/** Corre `tarea` sobre `items` con como mucho `limite` en paralelo. */
async function enTandas(items, limite, tarea) {
  const resultados = [];
  for (let i = 0; i < items.length; i += limite) {
    const tanda = items.slice(i, i + limite);
    resultados.push(...(await Promise.all(tanda.map(tarea))));
  }
  return resultados;
}

const { data: clubes, error } = await admin
  .from('clubes')
  .select('id, nombre, proveedor_externo, id_externo, escudo_url')
  .order('nombre');
if (error) throw error;

const resumen = { actualizados: 0, yaEstaban: 0, sinPatron: 0, noResuelve: 0 };

await enTandas(clubes, 8, async (club) => {
  const deseada = urlEscudo(club);

  if (!deseada) {
    resumen.sinPatron++;
    console.log(`·  ${club.nombre.padEnd(28)} sin id externo utilizable (${club.proveedor_externo ?? 'sin proveedor'})`);
    return;
  }
  if (club.escudo_url === deseada) {
    resumen.yaEstaban++;
    return;
  }
  if (!(await existe(deseada))) {
    resumen.noResuelve++;
    console.log(`✗  ${club.nombre.padEnd(28)} el CDN no tiene el escudo → queda con iniciales`);
    return;
  }

  const { error: errUpd } = await admin.from('clubes').update({ escudo_url: deseada }).eq('id', club.id);
  if (errUpd) throw errUpd;
  resumen.actualizados++;
  console.log(`=  ${club.nombre.padEnd(28)} ${deseada}`);
});

console.log(
  `\n✅ ${clubes.length} clubes: ${resumen.actualizados} actualizados, ${resumen.yaEstaban} ya tenían escudo, ` +
    `${resumen.noResuelve} sin escudo en el CDN, ${resumen.sinPatron} sin id externo.`,
);
