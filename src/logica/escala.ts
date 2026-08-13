// Percentil del precio dentro de la zona y combustible mostrados → banda de
// color. Ver ADR-0003: el color sale del percentil dentro del conjunto que se
// enseña, nunca de un umbral absoluto. El color no es propiedad de la
// estación: hay que recalcular la escala entera al cambiar de zona o de
// combustible, nunca guardarla junto a la estación.

import type { ClavePrecio } from '../../scripts/lib/tipos.ts';
import type { EstacionZona } from './zona.ts';

export type Banda = 'p1' | 'p2' | 'p3' | 'p4' | 'p5';
export type BandaPrecio = Banda | 'barata';

export interface Escala {
  /** Banda 0-100 → p1..p5, según los cortes de ADR-0003. */
  banda(precio: number): Banda;
  /** true si el precio es el más barato del conjunto que sostiene la escala. */
  esMasBarata(precio: number): boolean;
  minimo: number | null;
  maximo: number | null;
}

function bandaDePercentil(percentil: number): Banda {
  if (percentil <= 15) return 'p1';
  if (percentil <= 40) return 'p2';
  if (percentil <= 70) return 'p3';
  if (percentil <= 90) return 'p4';
  return 'p5';
}

/** Escala inerte para cuando no hay ningún precio (todo cae en la banda
 *  neutra y nada es "la más barata"). */
const ESCALA_VACIA: Escala = {
  minimo: null,
  maximo: null,
  banda: () => 'p3',
  esMasBarata: () => false,
};

/** Construye la escala a partir de los precios ya visibles (filtrados a los
 *  que venden el combustible activo, en toda la zona). */
export function crearEscala(precios: number[]): Escala {
  if (precios.length === 0) return ESCALA_VACIA;

  const ordenados = [...precios].sort((a, b) => a - b);
  const n = ordenados.length;
  const minimo = ordenados[0];
  const maximo = ordenados[n - 1];

  return {
    minimo,
    maximo,
    esMasBarata(precio: number): boolean {
      return precio === minimo;
    },
    banda(precio: number): Banda {
      if (n <= 1) return 'p1';
      let indice = ordenados.findIndex((p) => p >= precio);
      if (indice === -1) indice = n - 1;
      const percentil = (indice / (n - 1)) * 100;
      return bandaDePercentil(percentil);
    },
  };
}

/** Clasificación visual compartida por lista, mapa y comparaciones. La más
 * barata conserva su tratamiento específico; el resto usa la banda relativa. */
export function bandaPrecio(precio: number, escala: Escala): BandaPrecio {
  return escala.esMasBarata(precio) ? 'barata' : escala.banda(precio);
}

/** Precios no nulos de un combustible, tal como se necesitan para alimentar
 *  `crearEscala`. */
export function preciosDeCombustible(estaciones: EstacionZona[], combustible: ClavePrecio): number[] {
  const precios: number[] = [];
  for (const estacion of estaciones) {
    const precio = estacion.precios[combustible];
    if (precio !== null) precios.push(precio);
  }
  return precios;
}

/** Estaciones que venden el combustible, ordenadas de más barata a más cara.
 *  Es el orden de la lista (RF-20) y la base del "puesto" de la ficha (RF-24). */
export function ordenarPorPrecio(estaciones: EstacionZona[], combustible: ClavePrecio): EstacionZona[] {
  return estaciones
    .filter((e) => e.precios[combustible] !== null)
    .sort((a, b) => (a.precios[combustible] as number) - (b.precios[combustible] as number));
}
