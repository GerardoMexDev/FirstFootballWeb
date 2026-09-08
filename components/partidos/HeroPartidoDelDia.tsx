/**
 * Hero del partido del día: `renderHero()` de la demo. Candidatos = partidos entre hoy y
 * dentro de 3 días; gana el que tenga un hito encima (si hay), después el de mayor "peso"
 * (internacional pesa más), y a igualdad, el más cercano en el tiempo — mismo orden que la demo.
 *
 * Layout "Variante A" (pedido de la agencia, 2026-09-06): la demo apilaba todo abajo-izquierda
 * y dejaba el recuadro medio vacío. Acá se reparte: IZQUIERDA = identidad (competición, duelo,
 * jugador); DERECHA = logística (cuándo — las dos horas — y dónde). El CSS de esa grilla vive
 * en `styles/app.css` (`.hero--a` + `.heroA__*`); las clases de la demo (`.hero`, `.hero__*`)
 * no se tocan.
 *
 * Fondo: `.hero__bg` (clase que la demo ya estiliza en B&N y oscurecida). La imagen NO es del
 * partido real — es una foto ambiente elegida por tipo de competencia (`lib/partidos/hero-imagen.ts`).
 *
 * `'use client'`: el hero abre el panel de detalle de ese partido al hacer clic (Enter/Espacio).
 */
'use client';

import { Ico } from '@/components/comunes/Ico';
import { Escudo } from '@/components/comunes/Escudo';
import { CaraJugador } from '@/components/comunes/CaraJugador';
import { usePanel } from '@/lib/paneles/use-panel';
import {
  diasDesdeHoyUy,
  etiquetaDiaUy,
  horaCortaEnSede,
  horaCortaEnUruguay,
  marcadorCambioDeDia,
} from '@/lib/fechas/zonas';
import { mostrar } from '@/lib/formato/valores';
import { imagenHero } from '@/lib/partidos/hero-imagen';
import { pesoPartido, diaDePartido } from '@/lib/partidos/utilidades';
import type { Hito } from '@/lib/motor-hitos/tipos';
import type { PartidoProximo } from '@/lib/repositorios/tipos';

export function HeroPartidoDelDia({ partidos, hitos }: { partidos: PartidoProximo[]; hitos: Hito[] }) {
  const { abrir } = usePanel();
  const candidatos = partidos.filter((p) => {
    const dia = diaDePartido(p);
    return dia !== null && diasDesdeHoyUy(dia) >= 0 && diasDesdeHoyUy(dia) <= 3;
  });
  if (!candidatos.length) return null;

  const partidosConHito = new Set(hitos.filter((h) => h.partido).map((h) => h.partido!.partidoId));

  const p = [...candidatos].sort(
    (a, b) =>
      Number(partidosConHito.has(b.partidoId)) - Number(partidosConHito.has(a.partidoId)) ||
      pesoPartido(b) - pesoPartido(a) ||
      (a.inicioUtc ?? '').localeCompare(b.inicioUtc ?? ''),
  )[0];

  const hitoDelPartido = hitos.find((h) => h.partido?.partidoId === p.partidoId) ?? null;

  const dias = diasDesdeHoyUy(diaDePartido(p)!);
  const esHoy = dias === 0;
  const horaUy = p.inicioUtc ? horaCortaEnUruguay(p.inicioUtc) : null;
  const horaSede = p.inicioUtc && p.zonaHorariaEvento ? horaCortaEnSede(p.inicioUtc, p.zonaHorariaEvento) : null;
  const mismaHora = horaSede !== null && horaSede === horaUy;
  const cambioDia = marcadorCambioDeDia(p.diaLocalSede, p.diaUy);
  const fondo = imagenHero(p.competenciaTipo, p.partidoId);
  const tieneSede = Boolean(p.estadio || p.ciudad);

  return (
    <div
      className="hero hero--a"
      role="button"
      tabIndex={0}
      style={{ cursor: 'pointer' }}
      onClick={() => abrir('partido', p.partidoId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          abrir('partido', p.partidoId);
        }
      }}
    >
      <div className="hero__fb" />
      {fondo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="hero__bg" src={fondo} alt="" />
      )}
      <div className="hero__grad" />

      <div className="hero__top">
        <span className="hero__flag">
          <Ico nombre={hitoDelPartido ? 'medalla' : 'fuego'} clase="ico ico--sm" />
          {hitoDelPartido ? 'Partido del día · con hito' : 'Partido del día'}
        </span>
      </div>

      <div className="hero__b">
        {/* Identidad */}
        <div className="heroA__id">
          <div className="hero__c">
            <i>{mostrar(p.competenciaCodigo)}</i>
            <span>
              {mostrar(p.competenciaNombre)}
              {p.ronda ? ` · ${p.ronda}` : ''}
            </span>
          </div>
          <div className="hero__t heroA__duelo">
            <span className="heroA__eq">
              <Escudo nombre={p.clubNombre ?? '?'} url={p.clubEscudoUrl} clase="crest crest--lg" />
              {mostrar(p.clubNombre)}
            </span>
            <span className="heroA__eq">
              <em className="vs">vs</em>
              <Escudo nombre={p.rivalNombre ?? '?'} url={p.rivalEscudoUrl} clase="crest crest--lg" />
              {mostrar(p.rivalNombre)}
            </span>
          </div>
          <div className="hero__j">
            <div className="caras__pila">
              <CaraJugador nombre={p.jugadorNombre} fotoUrl={p.jugadorFotoUrl} />
            </div>
            <small>
              {p.jugadorApodo || p.jugadorNombre}
              {hitoDelPartido ? ` · ${hitoDelPartido.frase}` : ''}
            </small>
          </div>
        </div>

        {/* Logística: cuándo y dónde */}
        <div className="heroA__log">
          <span className="heroA__lbl">{esHoy ? 'Hoy' : etiquetaDiaUy(diaDePartido(p)!)}</span>
          {horaUy && (
            <div className="heroA__horas">
              <div>
                <b>
                  {horaUy}
                  {cambioDia && <sup className="hora__d">{cambioDia}</sup>}
                </b>
                <span>{cambioDia === '+1' ? 'Hora Uruguay (día siguiente)' : 'Hora Uruguay'}</span>
              </div>
              {horaSede && (
                <div>
                  <b>{horaSede}</b>
                  <span>{mismaHora ? 'Hora local · igual que Uruguay' : 'Hora local'}</span>
                </div>
              )}
            </div>
          )}
          <div className="heroA__sede">
            {tieneSede ? (
              <>
                <span>
                  <Ico nombre="pin" clase="ico ico--sm" />
                  {mostrar(p.estadio)}
                </span>
                <span>
                  <Ico nombre="globo" clase="ico ico--sm" />
                  {mostrar(p.ciudad)}
                </span>
              </>
            ) : (
              <span>
                <Ico nombre="pin" clase="ico ico--sm" />
                Sede a confirmar
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
