// public/_redirects (RF-60, docs/06-roadmap.md#H10 segunda mitad): un
// municipio por debajo del mínimo de estaciones no tiene página propia y
// tiene que mandar a la de su provincia en vez de dar un 404.
//
// Un comodín por provincia (52 líneas), no uno por municipio de los miles
// que no llegan al mínimo: Cloudflare Pages tiene un límite de reglas en
// `_redirects` que unos 7.000 municipios sin página superarían de sobra.
// El comodín funciona porque Cloudflare Pages sirve un fichero estático real
// antes de mirar las reglas de `_redirects` cuando los dos coinciden en la
// misma ruta: las páginas de municipio que SÍ existen (getStaticPaths las
// generó) se sirven directamente y nunca llegan a esta regla; las que no
// existen caen en el comodín de su provincia. Esto no se ha podido probar
// contra un despliegue real de Cloudflare Pages en este entorno — verificar
// tras el primer despliegue que una URL de municipio pequeño redirige de
// verdad y que una de municipio grande no lo hace.

import { generarSlug } from './slug.ts';
import type { ResumenProvincia } from './tipos.ts';

export function generarRedirecciones(provincias: ResumenProvincia[]): string {
  const cabecera = [
    '# Generado por scripts/descargar-datos.ts — no editar a mano.',
    '# RF-60: un municipio sin página propia (menos de 3 estaciones) manda a su',
    '# provincia. Ver scripts/lib/redirecciones.ts para el porqué del comodín.',
    '',
  ];
  const lineas = [...provincias]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((provincia) => `/${generarSlug(provincia.nombre)}/*  /p-${provincia.id}/  301`);

  return [...cabecera, ...lineas, ''].join('\n');
}
