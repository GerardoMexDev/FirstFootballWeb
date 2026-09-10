/**
 * Ficha de jugador — /jugadores/[jugadorId].
 *
 * La demo abre la ficha en el panel lateral; acá se sirve como ruta propia con SSR (enlace
 * directo, back del navegador, buena para el buscador ⌘K más adelante). Con el panel ya
 * cableado, esta ruta es sobre todo el "respaldo": clic en una tarjeta abre el panel
 * (`?panel=jugador&id=…`), pero esta URL sigue mostrando el mismo contenido.
 *
 * `[jugadorId]` es el UUID de `jugadores.id`. El armado del bundle (datos + temporada +
 * hitos + próximos) lo comparte con `/api/paneles/jugador` vía `cargarFichaJugador`.
 */
import { notFound } from 'next/navigation';
import { FichaContenido } from '@/components/jugadores/FichaContenido';
import { FichaJugador } from '@/components/jugadores/FichaJugador';
import { cargarFichaContenido } from '@/lib/jugadores/cargar-ficha-contenido';
import { cargarFichaJugador } from '@/lib/jugadores/cargar-ficha';
import { crearClienteServidor } from '@/lib/supabase/cliente-servidor';

export default async function FichaJugadorPage({ params }: { params: { jugadorId: string } }) {
  const cliente = crearClienteServidor();

  // Jugador del servicio Contenido → ficha slim (cargarFichaContenido devuelve null si no lo es).
  const contenido = await cargarFichaContenido(cliente, params.jugadorId);
  if (contenido) {
    return (
      <section className="vista on" tabIndex={-1}>
        <div className="head">
          <h1 className="d1">
            Ficha del
            <br />
            <em>jugador</em>
          </h1>
          <p className="sub">{contenido.jugador.apodo ?? contenido.jugador.nombre}</p>
        </div>
        <FichaContenido jugador={contenido.jugador} proximas={contenido.proximas} hoyUy={contenido.hoyUy} />
      </section>
    );
  }

  const bundle = await cargarFichaJugador(cliente, params.jugadorId);
  if (!bundle) notFound();

  return (
    <section className="vista on" tabIndex={-1}>
      <div className="head">
        <h1 className="d1">
          Ficha del
          <br />
          <em>jugador</em>
        </h1>
        <p className="sub">{bundle.jugador.apodo ?? bundle.jugador.nombre}</p>
      </div>

      <FichaJugador
        jugador={bundle.jugador}
        temporada={bundle.temporada}
        hitos={bundle.hitos}
        proximos={bundle.proximos}
        hoyUy={bundle.hoyUy}
      />
    </section>
  );
}
