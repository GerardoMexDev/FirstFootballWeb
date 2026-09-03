/**
 * Vista `partidos` — hero del partido del día, KPIs, "se vienen los hitos",
 * filtros y lista de partidos agrupada por día.
 *
 * ANDAMIAJE: emite el esqueleto con las clases y contenedores de la demo. Los datos
 * (hero, KPIs, hitos, lista) se conectan a la vista `proximos_partidos` de Supabase y
 * al motor de hitos en la sesión siguiente. Hasta entonces se muestra EstadoSinDatos.
 */
import { DateTime } from 'luxon';
import { EstadoSinDatos } from '@/components/comunes/EstadoSinDatos';
import { ZONA_AGENCIA } from '@/lib/fechas/zonas';

// Filtros de la barra — mismos `data-f` y textos que la demo.
const FILTROS = [
  { f: 'todos', etiqueta: 'Todos' },
  { f: 'hoy', etiqueta: 'Hoy' },
  { f: 'semana', etiqueta: 'Esta semana' },
  { f: 'int', etiqueta: 'Internacional' },
  { f: 'hito', etiqueta: 'Con hito' },
] as const;

export default function PaginaPartidos() {
  // Fecha de hoy en hora de Uruguay (lo que la demo pone en #fecha-hoy).
  const hoyUy = DateTime.now()
    .setZone(ZONA_AGENCIA)
    .setLocale('es')
    .toFormat("cccc d 'de' LLLL 'de' yyyy");
  const fechaHoy = hoyUy.charAt(0).toUpperCase() + hoyUy.slice(1);

  return (
    <section className="vista on" id="v-partidos" tabIndex={-1}>
      <div className="head">
        <h1 className="d1">
          Próximos
          <br />
          <em>partidos</em>
        </h1>
        <p className="sub" id="fecha-hoy">
          {fechaHoy}
        </p>
      </div>

      {/* Hero del partido del día — pendiente conectar a proximos_partidos */}
      <div id="hero" />

      {/* KPIs — pendiente */}
      <div className="kpis" id="kpis" />

      {/* "Se vienen los hitos" — pendiente motor de hitos */}
      <div className="sec" id="hitos" />

      <div className="barra" id="filtros">
        {FILTROS.map(({ f, etiqueta }, i) => (
          <button key={f} className={i === 0 ? 'chip on' : 'chip'} data-f={f} disabled>
            {etiqueta}
          </button>
        ))}
        <span className="cuenta" id="cuenta" />
      </div>

      <div id="lista">
        <EstadoSinDatos>
          Todavía no está conectada la base de datos. Acá va la lista de partidos agrupada por día
          (vista <code>proximos_partidos</code>), en hora de Uruguay.
        </EstadoSinDatos>
      </div>
    </section>
  );
}
