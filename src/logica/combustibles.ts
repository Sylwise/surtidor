// Nombres de dominio de los combustibles, en la voz del conductor
// (docs/05-diseno.md): "gasolina 95", no "producto 1".

import type { ClavePrecio, ClavePrecioHistorico } from '../../scripts/lib/tipos.ts';

/** Conjuntos declarados por sección (ADR-0028). Ningún consumidor de interfaz
 * mantiene su propia lista: las diferencias son decisiones de producto y de
 * disponibilidad de datos, no coincidencias entre arrays repetidos. */
export const COMBUSTIBLES_PRECIOS = [
  'gasolina95e5',
  'gasoleoA',
  'gasolina98e5',
  'gasoleoPremium',
  'gasoleoB',
  'glp',
] as const satisfies readonly ClavePrecio[];

export const COMBUSTIBLES_EDITORIALES = [
  'gasolina95e5',
  'gasoleoA',
  'gasolina98e5',
  'gasoleoPremium',
  'gasoleoB',
] as const satisfies readonly ClavePrecio[];

export const COMBUSTIBLES_EVOLUCION = [
  'gasolina95e5',
  'gasoleoA',
  'gasolina98e5',
  'gasoleoPremium',
] as const satisfies readonly ClavePrecioHistorico[];

export const COMBUSTIBLES_COMPARTIR = [
  'gasolina95e5',
  'gasoleoA',
] as const satisfies readonly ClavePrecio[];

/** Alias de dominio conservados para los consumidores generales. */
export const ORDEN_COMBUSTIBLES = COMBUSTIBLES_PRECIOS;
export const ORDEN_COMBUSTIBLES_COMPARABLES = COMBUSTIBLES_EDITORIALES;

export function esClavePrecio(valor: unknown): valor is ClavePrecio {
  return typeof valor === 'string' && COMBUSTIBLES_PRECIOS.some((clave) => clave === valor);
}

export function combustibleDisponibleEnEvolucion(clave: ClavePrecio): clave is ClavePrecioHistorico {
  return COMBUSTIBLES_EVOLUCION.some((candidata) => candidata === clave);
}

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
