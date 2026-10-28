// Prueba la migración 0048 (perfiles_publicos sin SECURITY DEFINER) en prod SIN aplicarla:
// corre la migración y las pruebas dentro de una transacción que SIEMPRE termina en error →
// rollback, y el resultado vuelve en el mensaje ("RESULTADO {...}"). Compara antes/después.
// Uso (Gerardo, desde WebFirst): node scripts/probar-0048.mjs  — necesita SUPABASE_ACCESS_TOKEN.
// Football First. Creado 2026-10-28.
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

const cuerpo = fs.readFileSync('supabase/migrations/0048_perfiles_publicos_invoker.sql', 'utf8')
  .replace(/^begin;$/m, '').replace(/^commit;$/m, '');

// Lo que ve un usuario logueado (Maxi), antes o después según dónde se corra.
const comoMaxi = (clave) => `
  perform set_config('request.jwt.claims', json_build_object('sub', maxi, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  r := r || jsonb_build_object('${clave}', jsonb_build_object(
    'perfiles', (select count(*) from perfiles_publicos),
    'nombres', (select string_agg(nombre_completo || '/' || cargo, ', ' order by nombre_completo) from perfiles_publicos),
    'tickets_con_autor', (select count(*) from tickets_vista where creado_por_nombre is not null),
    'tickets', (select count(*) from tickets_vista)));
  execute 'reset role';`;

// La migración no puede ir dentro de un DO (tiene $$): medir antes → migración → medir después,
// todo en una sola transacción; el "después" termina con raise → rollback de todo.
const medirAntes = `create temp table _r as select '{}'::jsonb as datos;
do $a$ declare maxi uuid := (select id from auth.users where email = 'maxi@footballfirst.uy'); r jsonb := '{}'::jsonb;
begin ${comoMaxi('antes')} update _r set datos = _r.datos || r; end $a$;`;

const medirDespues = `do $d$ declare maxi uuid := (select id from auth.users where email = 'maxi@footballfirst.uy'); r jsonb := (select _r.datos from _r);
begin
  ${comoMaxi('despues')}
  -- anon no lee
  execute 'set local role anon';
  begin perform count(*) from perfiles_publicos; r := r || '{"anon":"NO FALLÓ"}';
  exception when others then r := r || jsonb_build_object('anon', sqlstate); end;
  execute 'reset role';
  -- authenticated no escribe a través de la vista
  perform set_config('request.jwt.claims', json_build_object('sub', maxi, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin update perfiles_publicos set cargo = 'Administrador' where id = maxi; r := r || '{"escribir":"NO FALLÓ"}';
  exception when others then r := r || jsonb_build_object('escribir', sqlstate); end;
  execute 'reset role';
  r := r || jsonb_build_object('opciones_vista', (select reloptions from pg_class where relname = 'perfiles_publicos'));
  raise exception 'RESULTADO %', r;
end $d$;`;

const res = await q('begin;\n' + medirAntes + '\n' + cuerpo + '\n' + medirDespues);
console.log(res.status, res.body.replace(/\\"/g, '"'));
const despues = await q(`select count(*) as funcion_existe from pg_proc where proname = 'perfiles_publicos_filas'`, true);
console.log('Después (debe ser 0):', despues.body);
