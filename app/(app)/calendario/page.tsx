/**
 * Vista `calendario` — densidad anual (12 meses) + grilla del mes + leyenda.
 *
 * ANDAMIAJE: esqueleto con las clases de la demo. La densidad y los eventos salen de la
 * vista `agenda_anual` de Supabase; se conectan en una sesión siguiente.
 */
import { EstadoSinDatos } from '@/components/comunes/EstadoSinDatos';

export default function PaginaCalendario() {
  return (
    <section className="vista on" id="v-calendario" tabIndex={-1}>
      <div className="head">
        <h1 className="d1">
          Calendario
          <br />
          <em>anual</em>
        </h1>
        <p className="sub">
          Densidad por mes. Las fechas a más de 90 días son tentativas: el fixture se confirma por
          semestre y los horarios los mueve la TV.
        </p>
      </div>

      <div className="anio" id="anio" />

      <div className="cal__nav">
        <button className="btn btn--g btn--ico" id="mes-prev" aria-label="Mes anterior" disabled>
          <svg className="ico" viewBox="0 0 24 24">
            <path d="m15 6-6 6 6 6" />
          </svg>
        </button>
        <h3 className="d2" id="mes-t" />
        <button className="btn btn--g btn--ico" id="mes-next" aria-label="Mes siguiente" disabled>
          <svg className="ico" viewBox="0 0 24 24">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
      </div>

      <div className="cal__dias">
        <div>Lunes</div>
        <div>Martes</div>
        <div>Miércoles</div>
        <div>Jueves</div>
        <div>Viernes</div>
        <div>Sábado</div>
        <div>Domingo</div>
      </div>
      <div className="cal__grid" id="cal">
        <EstadoSinDatos>Pendiente conectar la vista <code>agenda_anual</code>.</EstadoSinDatos>
      </div>

      <div className="leyenda">
        <span>
          <i /> Confirmado
        </span>
        <span>
          <i className="t" /> Fecha tentativa
        </span>
        <span>
          <i className="a" /> Competición internacional
        </span>
      </div>
    </section>
  );
}
