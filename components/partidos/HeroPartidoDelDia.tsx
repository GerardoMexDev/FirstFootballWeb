/**
 * Hero del partido del día: `renderHero()` de la demo. Candidatos = partidos entre hoy y
 * dentro de 3 días; gana el de mayor "peso" (internacional pesa más), y a igualdad, el más
 * cercano en el tiempo. La demo también priorizaba el que tuviera un hito encima — acá no,
 * hasta que exista el motor de hitos (sesión aparte).
 *
 * Sin foto de fondo real (la demo usaba una foto de stock genérica): no hay foto de portada
 * por partido en el esquema de Fase 1, y poner una imagen genérica sugeriría que es del
 * partido real. Queda el degradé `.hero__fb` solo.
 */
import { Ico } from '@/components/comunes/Ico';
import { CaraJugador } from '@/components/comunes/CaraJugador';
import { diasDesdeHoyUy, etiquetaDiaUy, horaCortaEnSede, horaCortaEnUruguay } from '@/lib/fechas/zonas';
import { mostrar } from '@/lib/formato/valores';
import { pesoPartido } from '@/lib/partidos/utilidades';
import type { PartidoProximo } from '@/lib/repositorios/tipos';

export function HeroPartidoDelDia({ partidos }: { partidos: PartidoProximo[] }) {
  const candidatos = partidos.filter(
    (p) => p.diaUy !== null && diasDesdeHoyUy(p.diaUy) >= 0 && diasDesdeHoyUy(p.diaUy) <= 3,
  );
  if (!candidatos.length) return null;

  const p = [...candidatos].sort(
    (a, b) => pesoPartido(b) - pesoPartido(a) || (a.inicioUtc ?? '').localeCompare(b.inicioUtc ?? ''),
  )[0];

  const dias = diasDesdeHoyUy(p.diaUy!);
  const esHoy = dias === 0;
  const horaUy = p.inicioUtc ? horaCortaEnUruguay(p.inicioUtc) : null;
  const horaSede = p.inicioUtc && p.zonaHorariaEvento ? horaCortaEnSede(p.inicioUtc, p.zonaHorariaEvento) : null;
  const mismaHora = horaSede !== null && horaSede === horaUy;

  return (
    <div className="hero">
      <div className="hero__fb" />
      <div className="hero__grad" />
      <div className="hero__top">
        <span className="hero__flag">
          <Ico nombre="fuego" clase="ico ico--sm" />
          Partido del día
        </span>
        <div className="hero__cd">
          <b>{esHoy ? 'Hoy' : `${dias} día${dias > 1 ? 's' : ''}`}</b>
          <span>{esHoy && horaUy ? `${horaUy} hora Uruguay` : etiquetaDiaUy(p.diaUy!)}</span>
        </div>
      </div>
      <div className="hero__b">
        <div className="hero__c">
          <i>{mostrar(p.competenciaCodigo)}</i>
          <span>
            {mostrar(p.competenciaNombre)}
            {p.ronda ? ` · ${p.ronda}` : ''}
          </span>
        </div>
        <div className="hero__t">
          {mostrar(p.clubNombre)} vs {mostrar(p.rivalNombre)}
        </div>
        <div className="hero__m">
          <span>
            <Ico nombre="pin" clase="ico ico--sm" />
            {p.estadio || p.ciudad ? `${mostrar(p.estadio)}, ${mostrar(p.ciudad)}` : 'Sin datos'}
          </span>
          {horaUy && (
            <span>
              <Ico nombre="reloj" clase="ico ico--sm" />
              {horaUy} UY{mismaHora ? '' : horaSede ? ` · ${horaSede} hora local` : ''}
            </span>
          )}
        </div>
        <div className="hero__j">
          <div className="caras__pila">
            <CaraJugador nombre={p.jugadorNombre} fotoUrl={p.jugadorFotoUrl} />
          </div>
          <small>{p.jugadorApodo || p.jugadorNombre}</small>
        </div>
      </div>
    </div>
  );
}
