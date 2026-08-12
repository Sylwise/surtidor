// Nombres de dominio de los cuatro combustibles, en la voz del conductor
// (docs/05-diseno.md): "gasolina 95", no "producto 1".

import type { ClavePrecio } from '../../scripts/lib/tipos.ts';

/** Orden fijo en el que se muestran los combustibles en pestañas y en la ficha. */
export const ORDEN_COMBUSTIBLES: ClavePrecio[] = [
  'gasolina95e5',
  'gasoleoA',
  'gasolina98e5',
  'gasoleoPremium',
];

/** Etiqueta larga, para la ficha y los mensajes. */
export const ETIQUETA: Record<ClavePrecio, string> = {
  gasolina95e5: 'Gasolina 95',
  gasoleoA: 'Diésel',
  gasolina98e5: 'Gasolina 98',
  gasoleoPremium: 'Diésel premium',
};

/** Etiqueta corta, para las pestañas donde el sitio manda. */
export const ETIQUETA_CORTA: Record<ClavePrecio, string> = {
  gasolina95e5: '95',
  gasoleoA: 'Diésel',
  gasolina98e5: '98',
  gasoleoPremium: 'Diésel +',
};
