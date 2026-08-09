export interface FilaRanking<T> {
  elemento: T;
  posicion: number | null;
}

function aTresDecimales(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 1000) / 1000;
}

/**
 * Ordena de menor a mayor comparando los tres decimales del ministerio
 * (RF-103). Los empates comparten posición y se ordenan alfabéticamente.
 * Los elementos sin valor siguen visibles al final, sin posición.
 */
export function ordenarRanking<T>(
  elementos: readonly T[],
  valorDe: (elemento: T) => number | null,
  nombreDe: (elemento: T) => string,
): FilaRanking<T>[] {
  const ordenados = [...elementos].sort((a, b) => {
    const valorA = valorDe(a);
    const valorB = valorDe(b);
    if (valorA === null && valorB === null) return nombreDe(a).localeCompare(nombreDe(b), 'es');
    if (valorA === null) return 1;
    if (valorB === null) return -1;

    const diferencia = aTresDecimales(valorA) - aTresDecimales(valorB);
    return diferencia || nombreDe(a).localeCompare(nombreDe(b), 'es');
  });

  let valorAnterior: number | null = null;
  let posicionAnterior: number | null = null;

  return ordenados.map((elemento, indice) => {
    const valor = valorDe(elemento);
    if (valor === null) return { elemento, posicion: null };

    const valorComparable = aTresDecimales(valor);
    const posicion = valorAnterior === valorComparable ? posicionAnterior : indice + 1;
    valorAnterior = valorComparable;
    posicionAnterior = posicion;
    return { elemento, posicion };
  });
}
