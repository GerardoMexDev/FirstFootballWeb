/**
 * Login interno. Emite el marcado `.login` de la demo (arte + formulario).
 *
 * ANDAMIAJE: el formulario todavía no autentica. En la sesión de auth:
 * - el usuario escribe su nombre (`maxi`, `pedro`, `felipe`, `alexis`) y la app le agrega
 *   `@${NEXT_PUBLIC_DOMINIO_LOGIN}` antes de llamar a Supabase Auth;
 * - `signInWithPassword` + redirección a /partidos;
 * - registro público deshabilitado en Supabase, sin confirmación de email.
 */
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
        <form className="form" id="form">
          <h1>
            Panel de
            <br />
            producción
          </h1>
          <p>Ingresá para ver la cobertura de la semana.</p>
          <div className="campo">
            <label htmlFor="usuario">Usuario</label>
            <input type="text" id="usuario" name="usuario" autoComplete="username" required disabled />
          </div>
          <div className="campo">
            <label htmlFor="pass">Contraseña</label>
            <input
              type="password"
              id="pass"
              name="pass"
              autoComplete="current-password"
              required
              disabled
            />
          </div>
          <button className="btn btn--a" type="submit" disabled>
            Ingresar
          </button>
          <p className="form__pie">Autenticación pendiente de cablear (sesión de auth).</p>
        </form>
      </div>
    </section>
  );
}
