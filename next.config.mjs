/**
 * Configuración de Next.js — Football First.
 * Las fotos de jugadores y escudos se sirven desde Supabase Storage vía next/image
 * (la CDN de Vercel cachea y no cuenta egress de Supabase — ver contexto.md §8).
 */

// Carga las variables desde .secretos/.env (fuera del repo). En Vercel el archivo no existe
// y las variables vienen del panel: por eso el try/catch, para que el build no falle.
try {
  process.loadEnvFile('.secretos/.env');
} catch {
  /* sin archivo local: se usan las variables de entorno del sistema / Vercel */
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
