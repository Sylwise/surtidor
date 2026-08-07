// La dirección /?zonas=NN,NN (ADR-0014, H12): estado personalizado sin
// página propia. Aquí solo el análisis de la URL, sin red — la validación
// contra el catálogo real necesita el índice, que se carga aparte.

import type { ResumenProvincia } from '../../scripts/lib/tipos.ts';

/** Códigos tal como llegan en `?zonas=NN,NN`, sin validar todavía contra el
 *  catálogo. `[]` si no hay parámetro `zonas` o viene vacío. */
export function parsearZonasUrl(search: string): string[] {
  const crudo = new URLSearchParams(search).get('zonas');
  if (!crudo) return [];
  return crudo
    .split(',')
    .map((codigo) => codigo.trim())
    .filter((codigo) => codigo !== '');
}

/** Filtra códigos contra el catálogo real de provincias: uno desconocido o
 *  mal escrito se ignora (ADR-0014: "códigos inválidos o desconocidos se
 *  ignoran"), no rompe la reconstrucción de los demás. Sin duplicados. */
export function validarCodigosProvincia(codigos: string[], provincias: ResumenProvincia[]): string[] {
  const idsValidos = new Set(provincias.map((p) => p.id));
  return [...new Set(codigos)].filter((codigo) => idsValidos.has(codigo));
}

/** `/?zonas=NN,NN`, con los códigos ordenados y sin repetir (ADR-0014). */
export function construirUrlZonas(idsProvincia: string[]): string {
  const ordenados = [...new Set(idsProvincia)].sort();
  return `/?zonas=${ordenados.join(',')}`;
}
