// Fracción de la vista del mapa que ocupa una provincia (ADR-0014, "el mapa
// manda"). Geometría deliberadamente grosera: rectángulos en grados de
// latitud/longitud, sin proyección ni corrección por latitud. Vale porque
// los rectángulos de provincias vecinas ya se solapan a propósito — no hace
// falta más precisión que esa para decidir qué entra en pantalla.

import type { Rectangulo } from '../../scripts/lib/tipos.ts';

function area(r: Rectangulo): number {
  return Math.max(0, r.maxLat - r.minLat) * Math.max(0, r.maxLon - r.minLon);
}

function interseccion(a: Rectangulo, b: Rectangulo): Rectangulo | null {
  const minLat = Math.max(a.minLat, b.minLat);
  const maxLat = Math.min(a.maxLat, b.maxLat);
  const minLon = Math.max(a.minLon, b.minLon);
  const maxLon = Math.min(a.maxLon, b.maxLon);
  if (minLat >= maxLat || minLon >= maxLon) return null;
  return { minLat, maxLat, minLon, maxLon };
}

/**
 * Fracción del área de `vista` que ocupa la intersección con `rectangulo`,
 * de 0 a 1. Es la fracción de PANTALLA, no la fracción de la provincia: una
 * provincia enorme que solo asoma una esquina en pantalla puede pesar poco
 * aquí aunque su propio rectángulo sea grande.
 */
export function fraccionVisible(rectangulo: Rectangulo, vista: Rectangulo): number {
  const areaVista = area(vista);
  if (areaVista <= 0) return 0;
  const inter = interseccion(rectangulo, vista);
  if (!inter) return 0;
  return area(inter) / areaVista;
}
