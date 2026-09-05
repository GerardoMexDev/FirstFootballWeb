/**
 * "Fechas señaladas" — notas que avisan con 7-10 días de anticipación de cumpleaños,
 * aniversarios de club y aniversarios de debut en selección, para que los diseñadores
 * preparen el arte a tiempo. Se muestra en la vista `calendario` y en `partidos`.
 *
 * Si no hay ninguna en la ventana, no se renderiza nada (no es un "sin datos": simplemente
 * no hay fechas cerca). Mismo criterio y mismas clases de la demo que `SeccionHitos`
 * (`.sec` / `.hito` / `.hito--ya`), para que se lea como parte del mismo sistema.
 *
 * Football First (Fase 1). Creado 2026-09-05.
 */
import { etiquetaDiaUy } from '@/lib/fechas/zonas';
import { textoFuente, type NotaAgenda } from '@/lib/agenda/notas-proximas';

/** Número grande de la tarjeta: la cuenta regresiva ("Hoy" si es el día). */
function numeroCuenta(diasFalta: number): string {
  return diasFalta === 0 ? 'Hoy' : String(diasFalta);
}

/** Pie de la tarjeta: le da sentido al número ("Faltan 3 días", "Es hoy", "Es mañana"). */
function textoCuenta(diasFalta: number): string {
  if (diasFalta === 0) return 'Es hoy';
  if (diasFalta === 1) return 'Es mañana';
  return `Faltan ${diasFalta} días`;
}

export function NotasAgenda({ notas }: { notas: NotaAgenda[] }) {
  if (!notas.length) return null;

  return (
    <div className="sec" id="fechas-senaladas">
      <div className="sec__t">
        <h2 className="d3">
          Fechas <em>señaladas</em>
        </h2>
        <span className="meta">Para preparar el arte con tiempo</span>
      </div>
      <div className="hitos__l">
        {notas.map((nota, indice) => (
          <div
            key={`${nota.fuente}-${nota.diaUy}-${indice}`}
            className={`hito ${nota.urgente ? 'hito--ya' : ''}`}
          >
            <div className="hito__n">{numeroCuenta(nota.diasFalta)}</div>
            <div className="hito__q">{nota.titulo}</div>
            <div className="hito__c">
              {textoCuenta(nota.diasFalta)} · {etiquetaDiaUy(nota.diaUy)} · {textoFuente(nota.fuente)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
