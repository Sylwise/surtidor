// Nombres de dominio de los combustibles, en la voz del conductor
// (docs/05-diseno.md): "gasolina 95", no "producto 1".

import type { ClavePrecio } from '../../scripts/lib/tipos.ts';

/** Orden fijo en el que se muestran los combustibles en pestañas y en la ficha. */
export const ORDEN_COMBUSTIBLES: ClavePrecio[] = [
  'gasolina95e5',
  'gasoleoA',
  'gasolina98e5',
  'gasoleoPremium',
  'gasoleoB',
  'glp',
];

/** Combustibles que pueden aparecer en comparaciones, editoriales e
 * imágenes. El GLP queda fuera porque su consumo por volumen no permite
 * comparar el precio por litro con el resto (ADR-0027/RF-122). */
export const ORDEN_COMBUSTIBLES_COMPARABLES: ClavePrecio[] = ORDEN_COMBUSTIBLES.filter(
  (clave) => clave !== 'glp',
);

export function combustibleEsComparable(clave: ClavePrecio): boolean {
  return clave !== 'glp';
}

/** Nombre dentro de una frase: conserva GLP como sigla y baja el resto. */
export function etiquetaCombustibleEnFrase(clave: ClavePrecio): string {
  return clave === 'glp' ? 'GLP' : ETIQUETA[clave].toLocaleLowerCase('es');
}

/** Etiqueta larga, para la ficha y los mensajes. */
export const ETIQUETA: Record<ClavePrecio, string> = {
  gasolina95e5: 'Gasolina 95',
  gasoleoA: 'Diésel',
  gasolina98e5: 'Gasolina 98',
  gasoleoPremium: 'Diésel premium',
  gasoleoB: 'Gasóleo B',
  glp: 'GLP',
};

/** Etiqueta corta, para las pestañas donde el sitio manda. */
export const ETIQUETA_CORTA: Record<ClavePrecio, string> = {
  gasolina95e5: '95',
  gasoleoA: 'Diésel',
  gasolina98e5: '98',
  gasoleoPremium: 'Diésel +',
  gasoleoB: 'Gasóleo B',
  glp: 'GLP',
};

/** Dos niveles del botón cerrado de la variante B del boceto definitivo. */
export const ETIQUETA_SELECTOR: Record<ClavePrecio, { principal: string; detalle: string }> = {
  gasolina95e5: { principal: '95', detalle: 'Gasolina' },
  gasoleoA: { principal: 'Diésel', detalle: 'Gasóleo A' },
  gasolina98e5: { principal: '98', detalle: 'Gasolina' },
  gasoleoPremium: { principal: 'Diésel +', detalle: 'Premium' },
  gasoleoB: { principal: 'Gasóleo B', detalle: 'Alternativo' },
  glp: { principal: 'GLP', detalle: 'Alternativo' },
};
