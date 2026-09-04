/**
 * Login interno. Emite el marcado `.login` de la demo (arte + formulario).
 * El formulario en sí (estado, submit, errores) vive en el Client Component
 * `FormularioLogin` — esta página se queda como Server Component para poder exportar
 * `metadata`.
 */
import { FormularioLogin } from '@/components/auth/FormularioLogin';

export const metadata = { title: 'Ingresar — Football First' };

export default function PaginaLogin() {
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
        <FormularioLogin />
      </div>
    </section>
  );
}
