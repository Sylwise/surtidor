import type { AgregadoRotulo, MercadoFiscalRotulos } from './agregados.ts';
import type { ClavePrecio } from './tipos.ts';

export const UMBRAL_ESTACIONES_ROTULO = 100;

export interface SeleccionRotulos {
  incluidos: AgregadoRotulo[];
  estacionesTotales: number;
  estacionesFuera: number;
}

export interface MercadoFiscalSeleccionado extends MercadoFiscalRotulos {
  seleccion: SeleccionRotulos;
  conRanking: boolean;
}

export function seleccionarRotulos(
  rotulos: readonly AgregadoRotulo[],
  umbral = UMBRAL_ESTACIONES_ROTULO,
): SeleccionRotulos {
  const incluidos = rotulos.filter((rotulo) => rotulo.estaciones >= umbral);
  const estacionesTotales = rotulos.reduce((total, rotulo) => total + rotulo.estaciones, 0);
  const estacionesIncluidas = incluidos.reduce(
    (total, rotulo) => total + rotulo.estaciones,
    0,
  );

  return {
    incluidos,
    estacionesTotales,
    estacionesFuera: estacionesTotales - estacionesIncluidas,
  };
}

export function rotulosQueVenden(
  rotulos: readonly AgregadoRotulo[],
  combustible: ClavePrecio,
): AgregadoRotulo[] {
  return rotulos.filter((rotulo) => rotulo.combustibles[combustible].media !== null);
}

export function seleccionarMercadosFiscales(
  mercados: readonly MercadoFiscalRotulos[],
  umbral = UMBRAL_ESTACIONES_ROTULO,
): MercadoFiscalSeleccionado[] {
  return mercados.map((mercado) => {
    const seleccion = seleccionarRotulos(mercado.rotulos, umbral);
    return { ...mercado, seleccion, conRanking: seleccion.incluidos.length > 0 };
  });
}
