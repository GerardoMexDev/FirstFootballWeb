/**
 * Login interno. Emite el marcado `.login` de la demo (arte + formulario).
 * El formulario en sí (estado, submit, errores) vive en el Client Component
 * `FormularioLogin` — esta página se queda como Server Component para poder exportar
 * `metadata`.
 */
import { FormularioLogin } from '@/components/auth/FormularioLogin';
import { HORAS_INACTIVIDAD } from '@/lib/sesion/inactividad';

export const metadata = { title: 'Ingresar — Football First' };

export default function PaginaLogin({ searchParams }: { searchParams: { motivo?: string } }) {
  // El middleware manda acá con ?motivo=inactividad cuando cerró la sesión (2026-10-05).
  const aviso =
    searchParams.motivo === 'inactividad'
      ? `Por seguridad, cerramos tu sesión después de ${HORAS_INACTIVIDAD} horas sin uso. Volvé a ingresar.`
      : null;
  return (
    <section className="login" id="login">
      <div className="login__art">
        <div className="login__fb" />
        <div className="login__mark">
          <span>
            <svg className="logo">
              <use href="#ff" />
            </svg>
          </span>
          <b>Football First</b>
        </div>
        <div className="login__claim">
          <p>
            Vos jugá,
            <br />
            <em>nosotros</em>
            <br />
            creamos.
          </p>
          <small>
            Seis jugadores, seis ligas, cuatro zonas horarias. Un solo lugar para saber qué se
            viene.
          </small>
        </div>
      </div>

      <div className="login__form">
        <FormularioLogin aviso={aviso} />
      </div>
    </section>
  );
}
