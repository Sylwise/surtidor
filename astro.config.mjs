import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  compressHTML: true,
  // Dominio provisional: no hay uno decidido todavía (docs/03-arquitectura.md,
  // "Lo que hay que decidir cuando toque"), pero `Astro.site` hace falta ya
  // para los <link rel="canonical"> (H10, RF-65) y para las URLs absolutas
  // de sitemap.xml. `surtidor` es el nombre del proyecto de Cloudflare Pages
  // (.github/workflows/datos.yml), así que este es el dominio real hasta que
  // se compre uno propio. Cambiar aquí el día que eso pase; no hace falta
  // tocar nada más.
  site: 'https://surtidor.pages.dev',
  // El icono flotante de depuración solo aparece en `npm run dev`, pero
  // tapaba la esquina de la interfaz mientras se probaba el rediseño móvil.
  devToolbar: { enabled: false },
});
