/**
 * Cuerpo del panel "Mi cuenta" (`abrirPerfil()` de la demo), con las 3 pestañas:
 *  - Datos: nombre (editable) + correo/rol (solo lectura — los cambia un admin).
 *  - Contraseña: nueva + repetir → `auth.updateUser`. Sin campo "actual": Supabase no lo
 *    verifica con la sesión activa, dejarlo implicaría un chequeo que no ocurre.
 *  - Notificaciones: 3 switches → `perfiles.avisos`. El ENVÍO es Fase 2; esto persiste la
 *    preferencia.
 * Sin bloque de foto (Fase 2, Storage).
 *
 * Escrituras desde el cliente: RLS permite la fila propia de `perfiles`, y `auth.updateUser`
 * usa la sesión. Feedback con `.aviso` (no hay sistema de toasts todavía).
 *
 * Football First (Fase 1). Creado 2026-09-06.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ico } from '@/components/comunes/Ico';
import { crearClienteNavegador } from '@/lib/supabase/cliente-navegador';
import { validarContrasena } from '@/lib/perfil/validar-contrasena';
import type { Database } from '@/lib/supabase/tipos-db';
import type { Avisos } from '@/lib/sesion/sesion-actual';

export interface PerfilBundle {
  usuarioId: string;
  nombreCompleto: string;
  email: string;
  cargo: string;
  avisos: Avisos;
}

type Pestana = 'datos' | 'clave' | 'avisos';
type Nota = { tipo: 'ok' | 'error'; texto: string } | null;

const PESTANAS: { k: Pestana; t: string }[] = [
  { k: 'datos', t: 'Datos' },
  { k: 'clave', t: 'Contraseña' },
  { k: 'avisos', t: 'Notificaciones' },
];

const AVISOS_META: { k: keyof Avisos; t: string; d: string }[] = [
  { k: 'hitos', t: 'Un jugador esté cerca de un hito', d: 'Con la anticipación de cada escala' },
  { k: 'partidos', t: 'Falten 24 horas para un partido', d: 'Con hora de Uruguay y hora local' },
  { k: 'resumen', t: 'Resumen semanal', d: 'Lunes 8:00, los partidos de los próximos siete días' },
];

/** Bloque `.aviso` de feedback (check si salió bien, alerta si no). */
function Aviso({ nota }: { nota: Nota }) {
  if (!nota) return null;
  return (
    <div className="aviso" style={{ marginTop: 14 }}>
      <Ico nombre={nota.tipo === 'ok' ? 'check' : 'alerta'} clase="ico ico--sm" />
      <span>{nota.texto}</span>
    </div>
  );
}

export function PanelPerfil({
  bundle,
  pestanaInicial = 'datos',
}: {
  bundle: PerfilBundle;
  pestanaInicial?: Pestana;
}) {
  const router = useRouter();
  const supabase = crearClienteNavegador();
  const [pestana, setPestana] = useState<Pestana>(pestanaInicial);

  // ── Datos ──
  const [nombre, setNombre] = useState(bundle.nombreCompleto);
  const [guardandoNombre, setGuardandoNombre] = useState(false);
  const [notaNombre, setNotaNombre] = useState<Nota>(null);

  async function guardarNombre() {
    const limpio = nombre.trim();
    if (!limpio) {
      setNotaNombre({ tipo: 'error', texto: 'El nombre no puede quedar vacío.' });
      return;
    }
    setGuardandoNombre(true);
    setNotaNombre(null);
    const cambio: Database['public']['Tables']['perfiles']['Update'] = { nombre_completo: limpio };
    const { error } = await supabase.from('perfiles').update(cambio as never).eq('id', bundle.usuarioId);
    setGuardandoNombre(false);
    if (error) {
      setNotaNombre({ tipo: 'error', texto: 'No se pudo guardar. Probá de nuevo.' });
      return;
    }
    setNotaNombre({ tipo: 'ok', texto: 'Nombre actualizado.' });
    router.refresh(); // la barra superior lo relee del perfil
  }

  // ── Contraseña ──
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [guardandoClave, setGuardandoClave] = useState(false);
  const [notaClave, setNotaClave] = useState<Nota>(null);

  async function guardarClave() {
    const v = validarContrasena(nueva, repetir);
    if (!v.ok) {
      setNotaClave({ tipo: 'error', texto: v.mensaje ?? 'Revisá la contraseña.' });
      return;
    }
    setGuardandoClave(true);
    setNotaClave(null);
    const { error } = await supabase.auth.updateUser({ password: nueva });
    setGuardandoClave(false);
    if (error) {
      setNotaClave({ tipo: 'error', texto: error.message || 'No se pudo actualizar la contraseña.' });
      return;
    }
    setNueva('');
    setRepetir('');
    setNotaClave({ tipo: 'ok', texto: 'Contraseña actualizada.' });
  }

  // ── Notificaciones ──
  const [avisos, setAvisos] = useState<Avisos>(bundle.avisos);
  const [notaAvisos, setNotaAvisos] = useState<Nota>(null);

  async function alternarAviso(k: keyof Avisos) {
    const previos = avisos;
    const nuevos = { ...avisos, [k]: !avisos[k] };
    setAvisos(nuevos); // optimista
    setNotaAvisos(null);
    const cambio: Database['public']['Tables']['perfiles']['Update'] = { avisos: nuevos };
    const { error } = await supabase.from('perfiles').update(cambio as never).eq('id', bundle.usuarioId);
    if (error) {
      setAvisos(previos); // revertir
      setNotaAvisos({ tipo: 'error', texto: 'No se pudo guardar la preferencia.' });
    }
  }

  return (
    <>
      <div className="barra" style={{ marginBottom: 28 }}>
        {PESTANAS.map(({ k, t }) => (
          <button
            key={k}
            type="button"
            className={`chip ${k === pestana ? 'on' : ''}`}
            onClick={() => setPestana(k)}
          >
            {t}
          </button>
        ))}
      </div>

      {pestana === 'datos' && (
        <div className="bloque">
          <span className="label">Datos</span>
          <div className="campo">
            <label htmlFor="p-nombre">Nombre</label>
            <input
              id="p-nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="p-correo">Correo</label>
            <input id="p-correo" type="email" value={bundle.email} disabled />
          </div>
          <div className="campo">
            <label htmlFor="p-rol">Rol</label>
            <input id="p-rol" type="text" value={bundle.cargo} disabled />
          </div>
          <div className="aviso">
            <Ico nombre="alerta" clase="ico ico--sm" />
            <span>
              El correo y el rol los cambia un administrador. Si cada quien pudiera editarse el
              rol, el sistema de permisos no valdría nada.
            </span>
          </div>
          <button
            type="button"
            className="btn btn--a"
            style={{ width: '100%', marginTop: 18 }}
            onClick={guardarNombre}
            disabled={guardandoNombre}
          >
            {guardandoNombre ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <Aviso nota={notaNombre} />
        </div>
      )}

      {pestana === 'clave' && (
        <div className="bloque">
          <span className="label">Cambiar contraseña</span>
          <div className="campo">
            <label htmlFor="p-nueva">Nueva contraseña</label>
            <input
              id="p-nueva"
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="p-rep">Repetir nueva</label>
            <input
              id="p-rep"
              type="password"
              placeholder="••••••••"
              value={repetir}
              onChange={(e) => setRepetir(e.target.value)}
            />
          </div>
          <div className="aviso">
            <Ico nombre="alerta" clase="ico ico--sm" />
            <span>Elegí una que no uses en otro lado. Después vas a entrar con la nueva.</span>
          </div>
          <button
            type="button"
            className="btn btn--a"
            style={{ width: '100%', marginTop: 18 }}
            onClick={guardarClave}
            disabled={guardandoClave}
          >
            {guardandoClave ? 'Actualizando…' : 'Actualizar contraseña'}
          </button>
          <Aviso nota={notaClave} />
        </div>
      )}

      {pestana === 'avisos' && (
        <div className="bloque">
          <span className="label">Avisarme cuando</span>
          <div className="switches">
            {AVISOS_META.map(({ k, t, d }) => (
              <div className="switch" key={k}>
                <div>
                  <b>{t}</b>
                  <span>{d}</span>
                </div>
                <button
                  type="button"
                  className={avisos[k] ? 'on' : ''}
                  data-sw={k}
                  aria-pressed={avisos[k]}
                  aria-label={t}
                  onClick={() => alternarAviso(k)}
                />
              </div>
            ))}
          </div>
          <div className="aviso" style={{ marginTop: 14 }}>
            <Ico nombre="campana" clase="ico ico--sm" />
            <span>El envío de notificaciones llega en la Fase 2. Tu elección queda guardada.</span>
          </div>
          <Aviso nota={notaAvisos} />
        </div>
      )}
    </>
  );
}
