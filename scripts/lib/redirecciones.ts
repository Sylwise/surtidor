// ADR-0018 · Genera el contenido de public/_redirects: una regla 301 EXACTA
// por zona, del identificador antiguo (`p-{id}`/`ccaa-{id}`) al nuevo basado
// en el nombre. Nunca un comodín: ADR-0012 ya verificó con datos reales que
// Cloudflare Pages aplica los redirects antes de comprobar si existe un
// asset estático en esa misma ruta, así que un comodín se comería páginas
// reales (una página de municipio, en aquel caso). Aquí son 71 reglas
// exactas, muy lejos del límite de 2.000 de Cloudflare — otra escala y otro
// mecanismo que el de aquel ADR.
//
// Quien llama construye los pares {idAntiguo, idNuevo} con los mismos datos
// con los que ya construye las zonas (scripts/descargar-datos.ts,
// scripts/datos-mock.ts): esta función no vuelve a calcular ningún id, solo
// da forma al fichero.

export interface ParRedirect {
  idAntiguo: string;
  idNuevo: string;
}

export function generarRedirects(pares: ParRedirect[]): string {
  return pares.map(({ idAntiguo, idNuevo }) => `/${idAntiguo}/ /${idNuevo}/ 301`).join('\n') + '\n';
}
