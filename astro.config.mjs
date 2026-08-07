import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  compressHTML: true,
  // Dominio propio ya activo (verificado: surtidor.app sirve byte a byte el
  // mismo despliegue que surtidor.pages.dev, como dominio personalizado de
  // Cloudflare Pages). `Astro.site` alimenta <link rel="canonical">
  // (H10, RF-65), sitemap.xml y las URLs absolutas de og:image (RF-66) —
  // antes apuntaban todas a *.pages.dev, que sigue funcionando pero ya no es
  // el dominio real.
  site: 'https://surtidor.app',
  // El icono flotante de depuración solo aparece en `npm run dev`, pero
  // tapaba la esquina de la interfaz mientras se probaba el rediseño móvil.
  devToolbar: { enabled: false },
});
