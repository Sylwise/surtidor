import type { ResumenCombustible } from './agregados.ts';

export const LITROS_DEPOSITO_EDITORIAL = 50;

export function calcularCostePorNoComparar(
  resumen: ResumenCombustible,
  litros = LITROS_DEPOSITO_EDITORIAL,
): number | null {
  if (resumen.media === null || resumen.minimo === null) return null;
  return (resumen.media - resumen.minimo) * litros;
}
