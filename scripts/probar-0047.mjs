// Prueba la migración 0047 (tickets generales) en prod SIN aplicarla: corre la migración y las
// pruebas dentro de una transacción que SIEMPRE termina en error → rollback, y el resultado
// vuelve en el mensaje del error ("RESULTADO {...}"). Al final confirma que no quedó nada.
// Uso (Gerardo, desde WebFirst): node scripts/probar-0047.mjs  — necesita SUPABASE_ACCESS_TOKEN.
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

const cuerpo = fs.readFileSync('supabase/migrations/0047_tickets_generales.sql', 'utf8')
  .replace(/^begin;$/m, '').replace(/^commit;$/m, '');

const prueba = `
do $prueba$
declare
  maxi uuid := (select id from auth.users where email = 'maxi@footballfirst.uy');
  alexis uuid := (select id from auth.users where email = 'alexis@footballfirst.uy');
  felipe uuid := (select id from auth.users where email = 'felipe@footballfirst.uy');
  hoy date := (now() at time zone 'America/Montevideo')::date;
  r jsonb := '{}'::jsonb;
  v_id uuid;
  v jsonb;
begin
  -- 1) Diseñador crea un general
  perform set_config('request.jwt.claims', json_build_object('sub', maxi, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_id := ticket_crear_general(hoy + 3, '  Flyer sponsors  ', 'Pieza para IG');
  select to_jsonb(x) into v from (select titulo, motivo, jugador_id, jugador_nombre, fecha_evento, fecha_limite, es_general,
    jugador_solo_contenido, partido_eliminado, estado from tickets_vista where id = v_id) x;
  r := r || jsonb_build_object('vista', v);
  -- 2) errores
  begin perform ticket_crear_general(hoy - 1, 'x', 'y'); r := r || '{"fecha_pasada":"NO FALLÓ"}';
  exception when others then r := r || jsonb_build_object('fecha_pasada', sqlerrm); end;
  begin perform ticket_crear_general(hoy, '   ', 'y'); r := r || '{"asunto_vacio":"NO FALLÓ"}';
  exception when others then r := r || jsonb_build_object('asunto_vacio', sqlerrm); end;
  begin perform ticket_crear_general(hoy, 'x', ' '); r := r || '{"nota_vacia":"NO FALLÓ"}';
  exception when others then r := r || jsonb_build_object('nota_vacia', sqlerrm); end;
  -- 3) completar y contar
  perform ticket_completar(v_id, null);
  select to_jsonb(c) into v from conteo_disenos(hoy, hoy) c where c.titulo = 'General — Flyer sponsors';
  r := r || jsonb_build_object('conteo', v);
  -- 4) Prueba no crea
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', alexis, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform ticket_crear_general(hoy, 'x', 'y'); r := r || '{"prueba":"NO FALLÓ"}';
  exception when others then r := r || jsonb_build_object('prueba', sqlstate || ' ' || sqlerrm); end;
  -- 5) anon no ejecuta
  execute 'reset role';
  execute 'set local role anon';
  begin perform ticket_crear_general(hoy, 'x', 'y'); r := r || '{"anon":"NO FALLÓ"}';
  exception when others then r := r || jsonb_build_object('anon', sqlstate); end;
  -- 6) check de tabla: sin jugador y con partido o sin fecha
  execute 'reset role';
  begin insert into tickets (jugador_id, titulo, nota, creado_por) values (null, 't', 'n', felipe);
    r := r || '{"check_sin_fecha":"NO FALLÓ"}';
  exception when others then r := r || jsonb_build_object('check_sin_fecha', sqlstate); end;
  -- 7) los tickets existentes siguen en la vista
  r := r || jsonb_build_object('total_tickets', (select count(*) from tickets), 'total_vista', (select count(*) from tickets_vista));
  raise exception 'RESULTADO %', r;
end
$prueba$;`;

const res = await q('begin;\n' + cuerpo + '\n' + prueba);
console.log(res.status, res.body.replace(/\\"/g, '"'));
const despues = await q(`select count(*) as funcion_existe from pg_proc where proname = 'ticket_crear_general'`, true);
console.log('Después (debe ser 0):', despues.body);
