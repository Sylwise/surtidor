import { estacionesQueVenden } from './visibilidad.ts';
import type { ClavePrecio } from '../../scripts/lib/tipos.ts';
import type { EstacionZona } from './zona.ts';

export interface AmbitoCombustible {
  estaciones: EstacionZona[];
  ampliado: boolean;
}

/** RF-123: conserva el municipio si vende el combustible; solo cae a la
 * provincia cuando el conjunto municipal no tiene ninguna vendedora. */
export function resolverAmbitoCombustible(
  estacionesMunicipio: EstacionZona[],
  estacionesProvincia: EstacionZona[],
  combustible: ClavePrecio,
): AmbitoCombustible {
  if (estacionesQueVenden(estacionesMunicipio, combustible).length > 0) {
    return { estaciones: estacionesMunicipio, ampliado: false };
  }
  if (estacionesQueVenden(estacionesProvincia, combustible).length > 0) {
    return { estaciones: estacionesProvincia, ampliado: true };
  }
  return { estaciones: estacionesMunicipio, ampliado: false };
}
