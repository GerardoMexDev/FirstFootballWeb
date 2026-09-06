/**
 * Contenido de la ficha de jugador (`/jugadores/[jugadorId]`) — el cuerpo del panel
 * `abrirPanelJugador()` de la demo, sobre datos reales. Clases 1:1 con la demo
 * (`.bloque` / `.label` / `.datos` / `.dato` / `.filaht` / `.lst` / `.pm` / `.redes`).
 *
 * Render puro (Server Component): no hay interacción todavía — la lista de próximos partidos
 * NO es clicable hasta la sesión de paneles, mismo criterio que `TarjetaPartido` y los `.ev`
 * del calendario.
 *
 * Diferencias con la demo, todas por falta de dato en la base (contexto.md §10, cero
 * invenciones — se muestra "Sin datos", no se rellena):
 *  - "Carrera" no incluye minutos ni minutos por partido (`jugadores.*_base` solo guarda pj/g/a).
 *  - `debut`, `fichaje` e `instagram` hoy suelen venir `null` → esos campos dicen "Sin datos".
 *  - El bloque de temporada se rotula "Este año (AAAA)": es año calendario, no respeta el
 *    corte real de cada liga (pendiente en avances.md §5).
 *
 * Football First (Fase 1). Creado 2026-09-06.
 */
import { Ico } from '@/components/comunes/Ico';
import { Escudo } from '@/components/comunes/Escudo';
import { EstadoSinDatos } from '@/components/comunes/EstadoSinDatos';
import { datosParaContenido } from '@/lib/jugadores/datos-contenido';
import { diasDesdeHoyUy, etiquetaDiaUy } from '@/lib/fechas/zonas';
import { mostrar } from '@/lib/formato/valores';
import type { Hito } from '@/lib/motor-hitos/tipos';
import type { JugadorFicha, PartidoProximo, TemporadaActual } from '@/lib/repositorios/tipos';

/**
 * Valor de una celda `.dato`: el número tal cual (0 es válido) o un guion largo si no hay
 * dato. El "Sin datos" en letras chillonas se reserva para los bloques enteros vacíos
 * (`.sinDato`); en una celda numérica el "—" comunica lo mismo sin romper el ritmo visual.
 */
function celda(valor: number | null): string {
  return valor === null || valor === undefined ? '—' : String(valor);
}

/** Igual criterio que `SeccionHitos`: inminente si el partido está a ≤7 días o faltan ≤10 unidades. */
function esInminente(hito: Hito): boolean {
  if (hito.partido?.diaUy) return diasDesdeHoyUy(hito.partido.diaUy) <= 7;
  return hito.falta <= 10;
}

function contextoHito(hito: Hito): string {
  if (!hito.partido) return 'Sin fecha — depende del rendimiento';
  const rival = mostrar(hito.partido.rivalNombre);
  const dia = hito.partido.diaUy ? etiquetaDiaUy(hito.partido.diaUy) : 'sin fecha';
  return `${mostrar(hito.partido.clubNombre)} vs ${rival} · ${dia}`;
}

export function FichaJugador({
  jugador,
  temporada,
  hitos,
  proximos,
  hoyUy,
}: {
  jugador: JugadorFicha;
  temporada: TemporadaActual | null;
  /** Hitos de ESTE jugador, ya ordenados (lib/motor-hitos). */
  hitos: Hito[];
  /** Próximos partidos del jugador (ya recortados a los primeros que interesan). */
  proximos: PartidoProximo[];
  /** Día de hoy en Uruguay, YYYY-MM-DD. */
  hoyUy: string;
}) {
  const datos = datosParaContenido(jugador, hoyUy);
  const anio = hoyUy.slice(0, 4);
  const identidad = [
    jugador.clubPais,
    jugador.posicion,
    jugador.dorsal !== null ? `#${jugador.dorsal}` : null,
    datos.edad !== null ? `${datos.edad} años` : null,
  ].filter(Boolean);

  return (
    <>
      {/* Mismo layout inline que la cabecera del panel de la demo (`abrirPanelJugador`). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 15 }}>
        <Escudo nombre={jugador.clubNombre ?? '?'} url={jugador.clubEscudoUrl} clase="crest crest--lg" />
        <h2 className="d2" style={{ flex: 1 }}>
          {jugador.nombre}
        </h2>
      </div>
      <div className="linea" style={{ marginBottom: 32 }}>
        <span>
          <b>{jugador.clubNombre ?? 'Sin club'}</b>
        </span>
        {identidad.map((parte) => (
          <span key={parte}>{parte}</span>
        ))}
      </div>

      {/* ── Hitos por alcanzar ── */}
      <div className="bloque">
        <span className="label">Hitos por alcanzar</span>
        {hitos.length ? (
          <div className="filas">
            {hitos.map((hito, indice) => (
              <div
                key={`${hito.metrica}-${hito.base}-${indice}`}
                className={`filaht ${esInminente(hito) ? 'filaht--ya' : ''}`}
              >
                <div className="filaht__n">{hito.objetivo}</div>
                <div className="filaht__t">
                  <b>{hito.frase}</b>
                  <span>{contextoHito(hito)}</span>
                </div>
                <div className="filaht__d">faltan {hito.falta}</div>
              </div>
            ))}
          </div>
        ) : (
          <EstadoSinDatos>
            Sin hitos cerca. El próximo aparece solo cuando entre en el rango de aviso de su escala.
          </EstadoSinDatos>
        )}
      </div>

      {/* ── Este año ── */}
      <div className="bloque">
        <span className="label">Este año ({anio})</span>
        {temporada ? (
          <div className="datos">
            <div className="dato">
              <b>{celda(temporada.partidos)}</b>
              <span>Partidos</span>
            </div>
            <div className="dato">
              <b>{celda(temporada.minutos)}</b>
              <span>Minutos</span>
            </div>
            <div className="dato">
              <b>{celda(temporada.asistencias)}</b>
              <span>Asistencias</span>
            </div>
            <div className="dato">
              <b>{celda(temporada.goles)}</b>
              <span>Goles</span>
            </div>
            <div className="dato">
              <b>{celda(temporada.amarillas)}</b>
              <span>Amarillas</span>
            </div>
            <div className="dato">
              <b>{celda(temporada.valoracionPromedio)}</b>
              <span>Valoración media</span>
            </div>
          </div>
        ) : (
          <EstadoSinDatos icono="base">
            La temporada recién arranca — todavía sin partidos registrados este año. A medida que
            se juegan, <code>sync-estadisticas</code> los va sumando.
          </EstadoSinDatos>
        )}
      </div>

      {/* ── Carrera ── */}
      <div className="bloque">
        <span className="label">Carrera</span>
        <div className="datos">
          <div className="dato dato--a">
            <b>{celda(jugador.carreraPartidos)}</b>
            <span>Partidos</span>
          </div>
          <div className="dato">
            <b>{celda(jugador.carreraGoles)}</b>
            <span>Goles</span>
          </div>
          <div className="dato">
            <b>{celda(jugador.carreraAsistencias)}</b>
            <span>Asistencias</span>
          </div>
        </div>
      </div>

      {/* ── Selección ── (solo si tiene) */}
      {jugador.seleccion && (
        <div className="bloque">
          <span className="label">Selección de {jugador.seleccion}</span>
          <div className="datos">
            <div className="dato dato--a">
              <b>{celda(jugador.seleccionPartidos)}</b>
              <span>Partidos</span>
            </div>
            <div className="dato">
              <b>{celda(jugador.seleccionGoles)}</b>
              <span>Goles</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Datos para contenido ── */}
      <div className="bloque">
        <span className="label">Datos para contenido</span>
        <div className="datos">
          <div className="dato">
            <b>{datos.edad ?? '—'}</b>
            <span>Años</span>
          </div>
          <div className="dato">
            <b>{datos.aniosEnClub ?? '—'}</b>
            <span>Años en el club</span>
          </div>
          <div className="dato">
            <b>{datos.aniosDeCarrera ?? '—'}</b>
            <span>Años de carrera</span>
          </div>
        </div>
        <div className="linea" style={{ marginTop: 14 }}>
          <span>
            <Ico nombre="torta" clase="ico ico--sm" />
            Cumpleaños: <b>{datos.cumpleLegible ?? 'Sin datos'}</b>
          </span>
          <span>
            <Ico nombre="globo" clase="ico ico--sm" />
            {mostrar(jugador.nacionalidad)}
          </span>
        </div>
        <div className="redes" style={{ marginTop: 14 }}>
          {jugador.instagram ? (
            <span className="red">
              <Ico nombre="ig" clase="ico ico--sm" />
              {jugador.instagram}
            </span>
          ) : (
            <span className="red">
              <Ico nombre="ig" clase="ico ico--sm" />
              Sin datos
            </span>
          )}
        </div>
      </div>

      {/* ── Próximos partidos ── */}
      {proximos.length > 0 && (
        <div className="bloque">
          <span className="label">Próximos partidos</span>
          <div className="lst">
            {proximos.map((partido) => (
              <div className="pm" key={partido.partidoId}>
                <Escudo
                  nombre={partido.rivalNombre ?? '?'}
                  url={partido.rivalEscudoUrl}
                  clase="crest crest--sm"
                />
                <b>{mostrar(partido.rivalNombre)}</b>
                <span>
                  {[partido.competenciaCodigo, partido.diaUy ? etiquetaDiaUy(partido.diaUy) : null]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
