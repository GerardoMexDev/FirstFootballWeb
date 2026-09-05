/**
 * "Se vienen los hitos": `renderHitos()` de la demo, sobre hitos calculados de verdad
 * (lib/motor-hitos). Si no hay ninguno no se renderiza nada — igual que la demo, que vacía
 * el contenedor en vez de mostrar un estado vacío (esto no es un "sin datos": simplemente no
 * hay ningún hito lo bastante cerca todavía).
 *
 * Los `.hito` de la demo eran `<button data-jugh>` para abrir la ficha del jugador — acá no
 * llevan esa semántica hasta que exista el panel (sesión de paneles), mismo criterio que
 * `TarjetaPartido`. Y el contexto se arma con JSX, no con `dangerouslySetInnerHTML`: club y
 * rival vienen de la API, son datos externos (checklist de seguridad — nada de HTML crudo con
 * datos que no son nuestros).
 */
import { diasDesdeHoyUy, etiquetaDiaUy, horaCortaEnUruguay } from '@/lib/fechas/zonas';
import { mostrar } from '@/lib/formato/valores';
import type { Hito } from '@/lib/motor-hitos/tipos';

const MAXIMO_VISIBLE = 8;

function esInminente(hito: Hito): boolean {
  if (hito.partido?.diaUy) return diasDesdeHoyUy(hito.partido.diaUy) <= 7;
  return hito.falta <= 10;
}

function ContextoHito({ hito }: { hito: Hito }) {
  if (hito.partido) {
    const dia = hito.partido.diaUy ? etiquetaDiaUy(hito.partido.diaUy) : mostrar(null);
    const hora = hito.partido.inicioUtc ? `${horaCortaEnUruguay(hito.partido.inicioUtc)} UY` : '';
    return (
      <>
        Sería en{' '}
        <b>
          {mostrar(hito.partido.clubNombre)} vs {mostrar(hito.partido.rivalNombre)}
        </b>
        <br />
        {dia}
        {hora ? ` · ${hora}` : ''}
      </>
    );
  }
  return (
    <>
      Le faltan <b>{hito.falta}</b> — sin fecha definida
    </>
  );
}

export function SeccionHitos({ hitos }: { hitos: Hito[] }) {
  if (!hitos.length) return null;

  return (
    <div className="sec" id="hitos">
      <div className="sec__t">
        <h2 className="d3">
          Se vienen los <em>hitos</em>
        </h2>
        <span className="meta">Contenido para anticipar, no para enterarse después</span>
      </div>
      <div className="hitos__l">
        {hitos.slice(0, MAXIMO_VISIBLE).map((hito, indice) => (
          <div
            key={`${hito.jugadorId}-${hito.metrica}-${hito.base}-${indice}`}
            className={`hito ${esInminente(hito) ? 'hito--ya' : ''}`}
          >
            <div className="hito__n">{hito.objetivo}</div>
            <div className="hito__q">
              {hito.jugadorApodo ?? hito.jugadorNombre} — {hito.frase}
            </div>
            <div className="hito__c">
              <ContextoHito hito={hito} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
