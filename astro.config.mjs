import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  compressHTML: true,
  // El icono flotante de depuración solo aparece en `npm run dev`, pero
  // tapaba la esquina de la interfaz mientras se probaba el rediseño móvil.
  devToolbar: { enabled: false },
});
