// Filtro de estaciones sin venta al público (RF-48): las que no tienen
// `tipoVenta === "P"` (cooperativas, flotas, u otro destino distinto del
// público general) se excluyen de la lista, la ficha y el mapa. Único punto
// donde se aplica, para que los tres no diverjan sobre qué estaciones
// "existen" en la zona.
//
// Sin interfaz para reactivarlas (RF-56, aplazado a v2): el servicio REST no
// devuelve hoy ningún código distinto de "P" en ninguna de las 11.519
// estaciones de España, porque la venta restringida es sobre todo un
// fenómeno del gasóleo B, que no está en la v1 (docs/04-fuente-datos.md). El
// filtro se mantiene igual: cuesta cero y protege el día que eso cambie.

import type { EstacionZona } from './zona.ts';
import type { ClavePrecio } from '../../scripts/lib/tipos.ts';

export function estacionesVisibles(estaciones: EstacionZona[]): EstacionZona[] {
  return estaciones.filter((estacion) => estacion.tipoVenta === 'P');
}

/** Estaciones que pueden representarse para el combustible activo. `null`
 * significa que no lo venden: no genera marcador ni entra en un racimo. */
export function estacionesQueVenden(estaciones: EstacionZona[], combustible: ClavePrecio): EstacionZona[] {
  return estaciones.filter((estacion) => estacion.precios[combustible] !== null);
}
