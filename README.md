# Football First — Fase 1

Plataforma web interna de una agencia de representación de futbolistas: partidos, trayectorias
y hitos de los jugadores representados, siempre en hora de Uruguay.

## Stack

- **Next.js 14** (App Router) + TypeScript + React — deploy en Vercel.
- **Supabase** — Postgres + Auth + Storage + Edge Functions + `pg_cron` + `pg_net`.
- **Luxon** para zonas horarias (IANA, nunca offsets fijos).
- CSS de `planeacion/demo-fase1.html` **sin modificar** → `styles/tokens.css` + `styles/demo.css`.
- Datos deportivos: API-Football (primaria) con respaldo ESPN / TheSportsDB.

## Puesta en marcha

```bash
npm install
mkdir .secretos && cp .env.local.example .secretos/.env   # completar con las claves reales
npm run dev                                                # http://localhost:3000
```

La carpeta `.secretos/` está en `.gitignore`; la cargan `next.config.mjs` y los scripts con
`process.loadEnvFile`. Sin ese archivo la app igual levanta y muestra las tres vistas con el
marcado de la demo y `EstadoSinDatos` donde faltan los datos.

Scripts: `npm run migracion supabase/migrations/0001_esquema_inicial.sql` aplica una migración ·
`npm run tipos:db` regenera `lib/supabase/tipos-db.ts`.

## Deploy (Vercel)

Import del repo → framework Next.js (autodetectado), root `./`. En **Environment Variables**
cargar **solo estas 3** (las demás de `.env.local.example` son locales / Edge Functions):

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key (pública por diseño, la protege la RLS) |
| `NEXT_PUBLIC_DOMINIO_LOGIN` | `footballfirst.uy` (la app arma `usuario@<dominio>`) |

Son `NEXT_PUBLIC_*`: se compilan dentro del build, así que **cambiar una exige re-deploy**.
Apagar **Deployment Protection** (Settings → Deployment Protection → Vercel Authentication →
Off): la app ya tiene su propio login. El `service_role`, el DB password y la API key **no**
van a Vercel — la app solo habla con Supabase con la anon key + la cookie de sesión.

## Documentación del proyecto

Todo en `planeacion/`:

| Archivo | Qué es |
|---|---|
| `contexto.md` | Arquitectura completa de Fase 1 (fuente de verdad). |
| `avances.md` | Bitácora entre sesiones. Leer al empezar, actualizar al cerrar. |
| `sistema-diseno.md` | Sistema de diseño derivado 1:1 de la demo. |
| `alcance-funcionalidades.md` | Qué entra en Fase 1, qué en Fase 2, qué queda afuera. |
| `demo-fase1.html` | UI/UX cerrada. Fuente de todo el CSS. No se modifica. |
| `arquitectura-fase1.html` | Documento para la agencia. |

## Estructura

```
app/                      Rutas (App Router)
  (auth)/login/           Login interno
  (app)/                  Shell autenticado + vistas partidos / calendario / jugadores
components/               Componentes que emiten el marcado de la demo
lib/
  fechas/zonas.ts         ZONA_AGENCIA, aInstanteUtc, horaEnUruguay, …
  formato/valores.ts      mostrar(v) => v ?? 'Sin datos'
  supabase/               Clientes navegador y servidor (@supabase/ssr)
  repositorios/           Patrón repositorio (el frontend lee de Postgres, nunca de una API)
styles/                   tokens.css + demo.css (extraídos de la demo, intactos)
supabase/
  migrations/             0001_esquema_inicial.sql
  functions/              Edge Functions de sincronización (a implementar)
```

## Reglas que no se rompen

1. Zonas horarias con Luxon + IANA. Instante UTC + zona de la sede. Cero offsets fijos.
2. Ausencia de dato = "Sin datos". Nunca `0` por defecto.
3. El frontend siempre lee de Postgres, nunca de una API externa.
4. No se modifica el CSS, el marcado ni los tokens de la demo.
5. Verificado antes de entregar: probar internamente, nunca en producción.
