/**
 * Cuerpo de la ficha SLIM de un jugador del servicio "Contenido". Reusa el markup y las
 * clases de la demo del bloque "Datos para contenido" de `FichaJugador`; suma un bloque
 * "Fechas señaladas" con las próximas ocurrencias. Sin Hitos / Este año / Carrera /
 * Selección / Próximos partidos (ese jugador no tiene seguimiento de fixture).
 *
 * Render puro (Server Component).
 *
 * Football First (Fase 1). Creado 2026-09-10 (Sesión 7).
 */
import { Ico } from '@/components/comunes/Ico';
import { Escudo } from '@/components/comunes/Escudo';
import { EstadoSinDatos } from '@/components/comunes/EstadoSinDatos';
import { datosParaContenido } from '@/lib/jugadores/datos-contenido';
import { etiquetaDiaUy } from '@/lib/fechas/zonas';
import { mostrar } from '@/lib/formato/valores';
import type { ProximaFecha } from '@/lib/jugadores/cargar-ficha-contenido';
import type { JugadorFicha } from '@/lib/repositorios/tipos';

export function FichaContenido({
  jugador,
  proximas,
  hoyUy,
}: {
  jugador: JugadorFicha;
  proximas: ProximaFecha[];
  hoyUy: string;
}) {
  const datos = datosParaContenido(jugador, hoyUy);
  const clubEnMeses = datos.aniosEnClub !== null && datos.aniosEnClub < 1;
  const identidad = [
    jugador.clubPais,
    jugador.posicion,
    datos.edad !== null ? `${datos.edad} años` : null,
  ].filter(Boolean);

  return (
    <>
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

      {/* ── Datos para contenido ── (mismo markup que FichaJugador) */}
      <div className="bloque">
        <span className="label">Datos para contenido</span>
        <div className="datos">
          <div className="dato">
            <b>{datos.edad ?? '—'}</b>
            <span>Años</span>
          </div>
          <div className="dato">
            <b>{datos.aniosEnClub === null ? '—' : clubEnMeses ? datos.mesesEnClub : datos.aniosEnClub}</b>
            <span>{clubEnMeses ? (datos.mesesEnClub === 1 ? 'Mes en el club' : 'Meses en el club') : 'Años en el club'}</span>
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
          <span className="red">
            <Ico nombre="ig" clase="ico ico--sm" />
            {jugador.instagram ?? 'Sin datos'}
          </span>
        </div>
      </div>

      {/* ── Fechas señaladas ── */}
      <div className="bloque">
        <span className="label">Fechas señaladas</span>
        {proximas.length ? (
          <div className="lst">
            {proximas.map((f) => (
              <div className="pm" key={f.etiqueta}>
                <b>{f.etiqueta}</b>
                <span>{etiquetaDiaUy(f.proximaIso)}</span>
              </div>
            ))}
          </div>
        ) : (
          <EstadoSinDatos>
            Todavía sin fechas de contenido cargadas para este jugador.
          </EstadoSinDatos>
        )}
      </div>
    </>
  );
}
