// Ahorro en euros de repostar en una estación concreta en vez de en la más
// cara de la zona, para el combustible y el tamaño de depósito indicados
// (RF-25, CU-5). Es la cifra que convierte una diferencia de céntimos en una
// decisión.

/** Ahorro en euros, redondeado a dos decimales y nunca negativo: si la
 *  estación indicada es ella misma la más cara, el ahorro es 0. */
export function calcularAhorro(precioEstacion: number, precioMasCaro: number, litros: number): number {
  const diferenciaPorLitro = Math.max(0, precioMasCaro - precioEstacion);
  return Math.round(diferenciaPorLitro * litros * 100) / 100;
}
