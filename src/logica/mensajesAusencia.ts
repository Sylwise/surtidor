import type { ClavePrecio } from '../../scripts/lib/tipos.ts';
import { etiquetaCombustibleEnFrase, ETIQUETA } from './combustibles.ts';

/** Las ausencias de producto tienen semánticas distintas. Sus textos viven
 * aquí para que ningún componente vuelva a reinterpretarlas; la supresión
 * de escala conserva su función propia en escala.ts (ADR-0025). */
export function mensajeNoVende(): string {
  return 'no vende';
}

export function mensajeAquiNoHay(combustible: ClavePrecio): string {
  return `Aquí no hay ${etiquetaCombustibleEnFrase(combustible)}.`;
}

export function mensajeEnZonaNoHay(zona: string, combustible: ClavePrecio): string {
  return `En ${zona} no hay ${etiquetaCombustibleEnFrase(combustible)}.`;
}

export function mensajeSinDato(): string {
  return 'sin dato';
}

export function mensajeCombustibleNoDisponibleEnEvolucion(combustible: ClavePrecio): string {
  return `${ETIQUETA[combustible]} no está disponible en Evolución porque los datos históricos todavía no incluyen este combustible.`;
}

export function mensajeHistoricoInsuficiente(periodo: number): string {
  return `Aún no hay histórico suficiente para comparar ${periodo === 1 ? 'el último día' : `los últimos ${periodo} días`}.`;
}

export function mensajeMuestraInsuficienteRanking(): string {
  return 'No hay muestra suficiente para entrar en este ranking.';
}
