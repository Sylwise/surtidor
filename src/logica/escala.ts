// Percentil del precio dentro de la zona y combustible activos → banda de
// color. Ver ADR-0003 y ADR-0025: el conjunto de cálculo no cambia con los
// filtros de visualización y las bandas solo se aplican con dos precios y una
// amplitud mínima. El color no es propiedad de la estación.

import type { ClavePrecio } from '../../scripts/lib/tipos.ts';
import type { EstacionZona } from './zona.ts';

export type Banda = 'p1' | 'p2' | 'p3' | 'p4' | 'p5';
export type BandaPrecio = Banda | 'barata' | 'no-comparable';
export type MotivoSupresionEscala = 'muestra' | 'dispersion' | null;

/** RF-118 / ADR-0025: constantes únicas para todos los consumidores. */
export const MINIMO_MUESTRA_ESCALA = 2;
export const AMPLITUD_MINIMA_ESCALA_MILESIMAS = 20;

export interface Escala {
  /** Banda 0-100 → p1..p5, según los cortes de ADR-0003. */
  banda(precio: number): Banda;
  /** true si el precio es el más barato del conjunto que sostiene la escala. */
  esMasBarata(precio: number): boolean;
  minimo: number | null;
  maximo: number | null;
  motivoSupresion: MotivoSupresionEscala;
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
  motivoSupresion: 'muestra',
  banda: () => 'p3',
  esMasBarata: () => false,
};

/** Construye la escala a partir de todas las estaciones públicas de la zona
 *  que venden el combustible activo, con independencia de filtros visuales. */
export function crearEscala(precios: number[]): Escala {
  if (precios.length === 0) return ESCALA_VACIA;

  const ordenados = [...precios].sort((a, b) => a - b);
  const n = ordenados.length;
  const minimo = ordenados[0];
  const maximo = ordenados[n - 1];
  const amplitudMilesimas = Math.round(maximo * 1000) - Math.round(minimo * 1000);
  const motivoSupresion: MotivoSupresionEscala = n < MINIMO_MUESTRA_ESCALA
    ? 'muestra'
    : amplitudMilesimas < AMPLITUD_MINIMA_ESCALA_MILESIMAS
      ? 'dispersion'
      : null;

  return {
    minimo,
    maximo,
    motivoSupresion,
    esMasBarata(precio: number): boolean {
      return n >= MINIMO_MUESTRA_ESCALA && precio === minimo;
    },
    banda(precio: number): Banda {
      if (motivoSupresion !== null) return 'p3';
      let indice = ordenados.findIndex((p) => p >= precio);
      if (indice === -1) indice = n - 1;
      const percentil = (indice / (n - 1)) * 100;
      return bandaDePercentil(percentil);
    },
  };
}

/** Explicación común de RF-118 para el HTML servido y las vistas reactivas. */
export function explicacionEscalaSuprimida(escala: Escala): string | null {
  if (escala.motivoSupresion === 'muestra') {
    return escala.minimo === null
      ? null
      : 'Solo hay un precio comparable: se muestra sin escala de color.';
  }
  if (escala.motivoSupresion === 'dispersion') {
    return 'Los precios varían menos de 2 céntimos: se usa color neutro y se mantiene destacada la más barata.';
  }
  return null;
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
