// Cálculo de la lista de estaciones ordenada por combustible: puesto, precio
// y banda de color. Fuente única para el HTML servido en el build —los
// seis combustibles a la vez, RF-89/RF-120, ver AppInteractiva.astro— y para la
// lista reactiva del cliente (src/componentes/Lista.ts), para que las dos
// vías no diverjan. Mismo patrón que src/logica/municipios.ts.

import { estacionesVisibles } from './visibilidad.ts';
import { bandaPrecio, crearEscala, ordenarPorPrecio, preciosDeCombustible } from './escala.ts';
import { combustibleEsComparable, ORDEN_COMBUSTIBLES } from './combustibles.ts';
import type { BandaPrecio } from './escala.ts';
import type { ClavePrecio } from '../../scripts/lib/tipos.ts';
import type { EstacionZona } from './zona.ts';

export interface FilaLista {
  estacion: EstacionZona;
  /** Puesto dentro del combustible, 1 = más barata. */
  puesto: number;
  precio: number;
  banda: BandaPrecio;
}

/** Estaciones visibles (RF-48) ordenadas por `combustible`, de más barata a
 *  más cara, con puesto y banda de color ya resueltos. */
export function calcularListaCombustible(estaciones: EstacionZona[], combustible: ClavePrecio): FilaLista[] {
  const visibles = estacionesVisibles(estaciones);
  const ordenadas = ordenarPorPrecio(visibles, combustible);
  const escala = crearEscala(preciosDeCombustible(visibles, combustible));

  return ordenadas.map((estacion, indice) => {
    const precio = estacion.precios[combustible] as number;
    return {
      estacion,
      puesto: indice + 1,
      precio,
      banda: combustibleEsComparable(combustible) ? bandaPrecio(precio, escala) : 'no-comparable',
    };
  });
}

/** Una lista por cada uno de los seis combustibles (RF-89/RF-120): el HTML del
 *  build las contiene todas, y las pastillas de combustible del cliente
 *  eligen cuál se muestra; las otras tres siguen en el documento. */
export function calcularListasPorCombustible(estaciones: EstacionZona[]): Record<ClavePrecio, FilaLista[]> {
  return Object.fromEntries(
    ORDEN_COMBUSTIBLES.map((clave) => [clave, calcularListaCombustible(estaciones, clave)]),
  ) as Record<ClavePrecio, FilaLista[]>;
}
