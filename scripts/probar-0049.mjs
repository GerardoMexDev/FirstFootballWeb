// Prueba la migración 0049 (suspender / reactivar jugadores) en prod SIN aplicarla: corre la
// migración y un ciclo completo con Rodrigo Aguirre dentro de una transacción que SIEMPRE termina
// en error → rollback. El resultado vuelve en el mensaje ("RESULTADO {...}"). Aguirre NO queda
// suspendido: eso lo hace Gerardo desde la página cuando la 0049 esté aplicada.
// Uso (Gerardo, desde WebFirst): node scripts/probar-0049.mjs  — necesita SUPABASE_ACCESS_TOKEN.
// Football First. Creado 2026-11-06.
import fs from 'node:fs';
process.loadEnvFile('.secretos/.env');
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];

async function q(query, read_only = false) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, read_only }),
  });
  return { status: r.status, body: await r.text() };
}

const cuerpo = fs.readFileSync('supabase/migrations/0049_suspender_jugadores.sql', 'utf8')
  .replace(/^begin;$/m, '').replace(/^commit;$/m, '');

const AGUIRRE = 'f507a3a4-a5fe-4779-8e1f-b611d72af6f8';

// Conteos de las vistas: totales y los de Aguirre (por id o, en las agendas, por nombre en el título).
const conteos = `jsonb_build_object(
  'agenda_anual', (select count(*) from agenda_anual),
  'agenda_contenido', (select count(*) from agenda_contenido),
  'proximos_partidos', (select count(*) from proximos_partidos),
  'proximos_partidos_contenido', (select count(*) from proximos_partidos_contenido),
  'aguirre_agenda_contenido', (select count(*) from agenda_contenido where titulo ilike '%Aguirre%'),
  'aguirre_partidos_contenido', (select count(*) from proximos_partidos_contenido where jugador_id = '${AGUIRRE}'),
  'aguirre_activo', (select activo from jugadores where id = '${AGUIRRE}'))`;

// Cambia a un usuario simulado (por login) dentro del DO.
const como = (login) => `
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub',
    (select id from auth.users where email = '${login}@footballfirst.uy'), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';`;

const intento = (clave, sql) => `
  begin ${sql}; r := r || '{"${clave}":"NO FALLÓ"}';
  exception when others then r := r || jsonb_build_object('${clave}', sqlstate || ' ' || sqlerrm); end;`;

const medirAntes = `create temp table _r as select jsonb_build_object('antes', ${conteos}) as datos;`;

const probar = `do $p$
declare r jsonb := (select _r.datos from _r);
begin
  -- 1) Diseñador y Prueba no suspenden; Prueba tampoco cambia "activo" directo (trigger).
  ${como('maxi')}
  ${intento('disenador_suspende', `perform jugador_suspender('${AGUIRRE}', 'x')`)}
  ${como('alexis')}
  ${intento('prueba_update_directo', `update jugadores set activo = false where id = '${AGUIRRE}'`)}
  -- Otras columnas siguen editables como antes (política 0001): no se rompe nada existente.
  begin update jugadores set instagram = instagram where id = '${AGUIRRE}'; r := r || '{"otra_columna":"OK"}';
  exception when others then r := r || jsonb_build_object('otra_columna', sqlstate || ' ' || sqlerrm); end;
  -- 2) CM: motivo vacío rebota; con motivo, suspende.
  ${como('pedro')}
  ${intento('motivo_vacio', `perform jugador_suspender('${AGUIRRE}', '   ')`)}
  perform jugador_suspender('${AGUIRRE}', 'Prueba 0049');
  ${intento('suspender_dos_veces', `perform jugador_suspender('${AGUIRRE}', 'otra vez')`)}
  execute 'reset role';
  r := r || jsonb_build_object('suspendido', ${conteos},
    'datos_suspension', (select jsonb_build_object('motivo', motivo_suspension, 'por', p.nombre_completo, 'en', suspendido_en is not null)
                         from jugadores j left join perfiles p on p.id = j.suspendido_por where j.id = '${AGUIRRE}'));
  -- 3) Admin reactiva: vuelve todo como antes y se limpian los datos de suspensión.
  ${como('felipe')}
  perform jugador_reactivar('${AGUIRRE}');
  execute 'reset role';
  r := r || jsonb_build_object('reactivado', ${conteos},
    'limpio', (select motivo_suspension is null and suspendido_en is null and suspendido_por is null from jugadores where id = '${AGUIRRE}'),
    'servicios_intactos', (select jsonb_build_object('match_day', servicio_match_day, 'contenido', servicio_contenido) from jugadores where id = '${AGUIRRE}'),
    'nandez', (select jsonb_build_object('activo', activo, 'motivo', motivo_suspension) from jugadores where id = 'ef0b1152-a08a-46ca-9f5c-72c455a6c0dd'));
  -- 4) anon no ejecuta.
  execute 'set local role anon';
  ${intento('anon', `perform jugador_reactivar('${AGUIRRE}')`)}
  execute 'reset role';
  raise exception 'RESULTADO %', r;
end $p$;`;

const res = await q('begin;\n' + medirAntes + '\n' + cuerpo + '\n' + probar);
console.log(res.status, res.body.replace(/\\"/g, '"'));
const despues = await q(`select (select count(*) from pg_proc where proname = 'jugador_suspender') as funcion_existe,
  (select activo from jugadores where id = '${AGUIRRE}') as aguirre_activo`, true);
console.log('Después (funcion_existe 0, aguirre_activo true):', despues.body);
