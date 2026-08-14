import type { AgregadoRotulo, MercadoFiscalRotulos } from './agregados.ts';
import type { ClavePrecio } from './tipos.ts';

export const UMBRAL_ESTACIONES_ROTULO = 100;
export const PROPORCION_ESTACIONES_MERCADO_FISCAL = 0.05;
export const UMBRAL_MINIMO_MERCADO_FISCAL = 2;

export interface SeleccionRotulos {
  incluidos: AgregadoRotulo[];
  estacionesTotales: number;
  estacionesFuera: number;
}

export interface MercadoFiscalSeleccionado extends MercadoFiscalRotulos {
  seleccion: SeleccionRotulos;
  umbral: number;
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
): MercadoFiscalSeleccionado[] {
  return mercados.map((mercado) => {
    const estacionesTotales = mercado.rotulos.reduce(
      (total, rotulo) => total + rotulo.estaciones,
      0,
    );
    const umbral = Math.min(
      UMBRAL_ESTACIONES_ROTULO,
      Math.max(
        UMBRAL_MINIMO_MERCADO_FISCAL,
        Math.ceil(estacionesTotales * PROPORCION_ESTACIONES_MERCADO_FISCAL),
      ),
    );
    const seleccion = seleccionarRotulos(mercado.rotulos, umbral);
    return { ...mercado, seleccion, umbral, conRanking: seleccion.incluidos.length > 0 };
  });
}
