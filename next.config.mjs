/**
 * Configuración de Next.js — Football First.
 * Las fotos de jugadores y escudos se sirven desde Supabase Storage vía next/image
 * (la CDN de Vercel cachea y no cuenta egress de Supabase — ver contexto.md §8).
 * Reemplazar <PROJECT_REF> por el ref real del proyecto Supabase al crearlo.
 */
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
