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

/**
 * Headers de seguridad para todas las rutas (Vercel ya agrega HSTS):
 * - X-Frame-Options / frame-ancestors: nadie puede embeber la app en un iframe (clickjacking
 *   sobre el login).
 * - nosniff, Referrer-Policy: no filtrar URLs internas a sitios externos.
 * - Permissions-Policy: la app no usa cámara, micrófono ni ubicación.
 */
const HEADERS_SEGURIDAD = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: HEADERS_SEGURIDAD }];
  },
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
