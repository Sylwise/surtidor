// Ahorro en euros de repostar en una estación concreta frente a un precio de
// referencia, para el combustible y los litros indicados (RF-25, CU-5). Es la
// cifra que convierte una diferencia de céntimos en una decisión.

/** Media simple de los precios disponibles. Los valores ausentes se excluyen
 * antes de llamar a esta función y una muestra vacía no inventa un cero. */
export function calcularPrecioMedio(precios: readonly number[]): number | null {
  if (precios.length === 0) return null;
  return precios.reduce((suma, precio) => suma + precio, 0) / precios.length;
}

/** Ahorro en euros, redondeado a dos decimales y nunca negativo: si la
 *  estación está en el precio de referencia o por encima, el ahorro es 0. */
export function calcularAhorro(precioEstacion: number, precioReferencia: number, litros: number): number {
  const diferenciaPorLitro = Math.max(0, precioReferencia - precioEstacion);
  return Math.round(diferenciaPorLitro * litros * 100) / 100;
}
