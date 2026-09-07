/**
 * Formulario de login. El usuario escribe solo el nombre (`maxi`, `pedro`, `felipe`,
 * `alexis`); la app arma el correo agregando `@${NEXT_PUBLIC_DOMINIO_LOGIN}` y llama a
 * `signInWithPassword`. Registro público deshabilitado — no hay más entrada que esta.
 */
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Ico } from '@/components/comunes/Ico';
import { crearClienteNavegador } from '@/lib/supabase/cliente-navegador';

// El dominio es fijo e interno; la env var es solo para poder cambiarlo sin tocar código.
// El fallback evita que un deploy sin la variable arme `usuario@undefined` (falla silenciosa
// que se ve como "usuario o contraseña incorrectos").
const DOMINIO_LOGIN = process.env.NEXT_PUBLIC_DOMINIO_LOGIN || 'footballfirst.uy';

/** Traduce los mensajes de Supabase Auth a lenguaje humano (doc 19: content design). */
function mensajeError(mensajeOriginal: string): string {
  if (/invalid login credentials/i.test(mensajeOriginal)) {
    return 'Usuario o contraseña incorrectos.';
  }
  if (/email not confirmed/i.test(mensajeOriginal)) {
    return 'Esta cuenta todavía no está confirmada. Hablá con un administrador.';
  }
  return 'No pudimos iniciar sesión. Probá de nuevo en un momento.';
}

export function FormularioLogin() {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [claveVisible, setClaveVisible] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    const nombre = usuario.trim().toLowerCase();
    if (!nombre || !clave) return;

    setEnviando(true);
    const supabase = crearClienteNavegador();
    const { error: errorAuth } = await supabase.auth.signInWithPassword({
      email: `${nombre}@${DOMINIO_LOGIN}`,
      password: clave,
    });

    if (errorAuth) {
      setEnviando(false);
      setError(mensajeError(errorAuth.message));
      return;
    }

    router.push('/partidos');
    router.refresh(); // el middleware ya tiene la sesión; refresh fuerza a releerla server-side
  }

  return (
    <form className="form" id="form" onSubmit={alEnviar}>
      <h1>
        Panel de
        <br />
        producción
      </h1>
      <p>Ingresá para ver la cobertura de la semana.</p>
      <div className="campo">
        <label htmlFor="usuario">Usuario</label>
        <input
          type="text"
          id="usuario"
          name="usuario"
          autoComplete="username"
          required
          disabled={enviando}
          value={usuario}
          onChange={(evento) => setUsuario(evento.target.value)}
        />
      </div>
      <div className="campo">
        <label htmlFor="pass">Contraseña</label>
        <div className="campo__envoltorio">
          <input
            type={claveVisible ? 'text' : 'password'}
            id="pass"
            name="pass"
            autoComplete="current-password"
            required
            disabled={enviando}
            value={clave}
            onChange={(evento) => setClave(evento.target.value)}
          />
          <button
            type="button"
            className="campo__ojo"
            disabled={enviando}
            onClick={() => setClaveVisible((valor) => !valor)}
            aria-label={claveVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={claveVisible}
          >
            <Ico nombre={claveVisible ? 'ojoCerrado' : 'ojo'} clase="ico ico--sm" />
          </button>
        </div>
      </div>

      {error && (
        <div className="aviso" role="alert" aria-live="assertive" style={{ marginBottom: 20 }}>
          <Ico nombre="alerta" clase="ico ico--sm" />
          <span>{error}</span>
        </div>
      )}

      <button className="btn btn--a" type="submit" disabled={enviando}>
        {enviando ? 'Ingresando…' : 'Ingresar'}
      </button>
      <p className="form__pie">Acceso interno — agencia Football First.</p>
    </form>
  );
}
