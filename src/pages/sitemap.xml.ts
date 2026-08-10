// RF-64: sitemap.xml con lastmod, regenerado en cada despliegue. Escrito a
// mano en vez de con el paquete @astrojs/sitemap: es una plantilla XML de
// unas pocas líneas por URL (docs/03-arquitectura.md, "sin dependencias que
// no ganen su sitio" — CLAUDE.md), y ya hay que leer indice.json del disco
// igual que src/pages/[zona]/index.astro y
// src/pages/[provincia]/[municipio]/index.astro.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { APIRoute } from 'astro';
import { generarSlug } from '../../scripts/lib/slug.ts';
import { MINIMO_ESTACIONES_MUNICIPIO, type Indice, type IndiceMunicipios } from '../../scripts/lib/tipos.ts';

// RF-105: las editoriales se dan de alta a mano. Solo entran cuando existe
// su página; no se anuncian rutas futuras que todavía devolverían 404.
const RUTAS_EDITORIALES = [
  '/hoy/evolucion/',
  '/hoy/provincias-mas-baratas/',
  '/hoy/cuanto-te-juegas/',
  '/hoy/marcas-mas-baratas/',
  '/hoy/capitales-de-provincia/',
  '/hoy/la-mas-barata-de-espana/',
  '/hoy/canarias-ceuta-melilla/',
];

function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = ({ site }) => {
  const indice = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'indice.json'), 'utf-8')) as Indice;
  // Catálogo de municipios en datos-build/, no en public/data/: ver
  // IndiceMunicipios en scripts/lib/tipos.ts. El sitemap es build-time puro
  // (endpoint prerenderizado), así que leerlo de ahí no es distinto a
  // leerlo de public/.
  const indiceMunicipios = JSON.parse(
    readFileSync(join(process.cwd(), 'datos-build', 'municipios.json'), 'utf-8'),
  ) as IndiceMunicipios;

  const base = site ?? new URL('https://surtidor.pages.dev');
  const provinciasPorId = new Map(indice.provincias.map((p) => [p.id, p]));

  // Todas las provincias/municipios de esta misma ejecución comparten el
  // mismo `actualizado` (scripts/descargar-datos.ts lo calcula una vez al
  // principio y lo reutiliza en cada fichero), así que un único lastmod vale
  // para las 1000 y pico URLs sin tener que leer cada JSON de provincia.
  const lastmod = indice.actualizado;

  const rutas: string[] = [
    '/',
    ...RUTAS_EDITORIALES,
    ...indice.provincias.map((provincia) => `/hoy/evolucion/${provincia.id}/`),
    ...indice.zonas.map((zona) => `/${zona.id}/`),
  ];

  for (const municipio of indiceMunicipios.municipios) {
    if (municipio.estaciones < MINIMO_ESTACIONES_MUNICIPIO) continue;
    const provincia = provinciasPorId.get(municipio.provinciaId);
    if (!provincia) continue; // mismo caso imposible que getStaticPaths; el sitemap no es el sitio para reventar el build por esto.
    rutas.push(`/${generarSlug(provincia.nombre)}/${generarSlug(municipio.nombre)}/`);
  }

  const urls = rutas
    .map(
      (ruta) =>
        `  <url>\n    <loc>${escaparXml(new URL(ruta, base).toString())}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
