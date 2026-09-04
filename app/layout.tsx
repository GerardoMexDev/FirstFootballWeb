/**
 * Layout raíz de Football First.
 * - <html>/<body> con el mismo `lang` y `data-theme` de la demo.
 * - Carga los tokens y el CSS de la demo SIN modificar (styles/tokens.css, styles/demo.css).
 * - styles/app.css: solo componentes que la demo no tenía (p.ej. mostrar/ocultar contraseña),
 *   con los mismos tokens — nunca redefine una clase de demo.css.
 * - Fuentes Anton + Archivo por <link> a Google Fonts, idéntico a la demo (así tokens.css
 *   queda intacto: --display:'Anton' / --ui:'Archivo').
 * - Monta una sola vez el <symbol id="ff"> del logo, para <use href="#ff"/>.
 */
import type { Metadata, Viewport } from 'next';
import '@/styles/tokens.css';
import '@/styles/demo.css';
import '@/styles/app.css';

export const metadata: Metadata = {
  title: 'Football First — Fase 1',
  description:
    'Plataforma interna de la agencia: partidos, trayectorias y hitos de los jugadores representados, en hora de Uruguay.',
  robots: { index: false, follow: false }, // app interna, no se indexa
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/*
          Fuentes por <link>, idéntico a la demo, para no tocar los tokens
          (--display:'Anton' / --ui:'Archivo' en styles/tokens.css). En el App Router
          el <head> del layout raíz persiste entre vistas, así que la advertencia
          no-page-custom-font no aplica.
        */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Logo reutilizable — mismo path que la demo (monograma FF) */}
        <svg style={{ display: 'none' }} aria-hidden="true">
          <symbol id="ff" viewBox="0 0 188 192">
            <g transform="translate(0,192) scale(0.1,-0.1)">
              <path d="M640 1345 c-233 -233 -422 -427 -419 -429 40 -45 755 -756 759 -756 4 0 138 131 298 291 232 232 290 295 282 308 -5 9 -36 43 -69 76 -34 33 -61 64 -61 71 0 6 53 63 117 128 l117 117 -104 104 c-58 58 -108 104 -112 103 -5 -2 -59 -54 -122 -117 -63 -62 -121 -111 -128 -109 -37 12 -15 46 107 168 l125 124 -172 173 c-95 95 -177 173 -183 173 -6 0 -201 -191 -435 -425z" />
            </g>
          </symbol>
        </svg>

        {children}
      </body>
    </html>
  );
}
