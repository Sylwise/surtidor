// H10 (RF-60): un municipio por debajo del mínimo de estaciones no tiene
// página propia y tiene que redirigir a la de su provincia en vez de dar un
// 404.
//
// La primera versión de esto era un comodín en public/_redirects
// (`/{provincia}/*  /p-{id}/  301`). Verificado con `wrangler pages dev`
// contra un build real: Cloudflare Pages aplica los redirects ANTES de
// comprobar si existe un asset estático en esa misma ruta —los redirects
// siempre ganan, no al revés— así que el comodín se comía también las
// páginas de municipio reales (Vitoria-Gasteiz, con 39 estaciones,
// redirigía a /p-01/ en vez de servirse). Además el número real de
// municipios sin página (2178) supera el límite de 2000 reglas estáticas de
// `_redirects`, así que tampoco cabía una línea por municipio.
//
// La solución soportada por Cloudflare para este caso exacto: una Pages
// Function que primero intenta servir el asset estático de verdad
// (`env.ASSETS.fetch`, que no pasa por las reglas de `_redirects` ni vuelve
// a invocar esta función) y solo redirige si ese asset no existe. Rutas de
// dos segmentos («/algo/algo-mas/») son exactamente la forma de
// /{provincia}/{municipio}/, así que esta función no interfiere con
// /{zona}/ (un segmento) ni con la portada.
//
// datos-build/provincias-slugs.json lo escribe scripts/descargar-datos.ts
// (y scripts/datos-mock.ts) en el mismo paso que indice.json: mapea el slug
// de cada provincia a su id de dos dígitos, para poder construir el destino
// `/p-{id}/` sin repetir la lista de provincias a mano aquí.
import provincias from '../../datos-build/provincias-slugs.json';

const PROVINCIA_POR_SLUG = new Map(provincias.map((p) => [p.slug, p.id]));

export async function onRequest(context) {
  const respuestaAsset = await context.env.ASSETS.fetch(context.request);
  if (respuestaAsset.status !== 404) {
    return respuestaAsset;
  }

  const idProvincia = PROVINCIA_POR_SLUG.get(context.params.provincia);
  if (!idProvincia) {
    // No es un slug de provincia real: 404 tal cual, no hay a dónde redirigir.
    return respuestaAsset;
  }

  return Response.redirect(new URL(`/p-${idProvincia}/`, context.request.url), 301);
}
