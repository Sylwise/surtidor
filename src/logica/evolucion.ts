import type { AgregadoHistorico, HistoricoProvincia, SerieHistoricaPublica } from '../../scripts/lib/artefactos-historicos.ts';
import type { ClavePrecio } from '../../scripts/lib/tipos.ts';

export type PeriodoEvolucion = 1 | 7 | 30 | 90;

const INDICE_PRECIO: Record<ClavePrecio, 3 | 4 | 5 | 6> = {
  gasolina95e5: 3,
  gasoleoA: 4,
  gasolina98e5: 5,
  gasoleoPremium: 6,
};

export interface PuntoEvolucion {
  fecha: string;
  milesimas: number | null;
}

export interface CambioEvolucion {
  desde: PuntoEvolucion;
  hasta: PuntoEvolucion;
  diferenciaMilesimas: number;
  porcentaje: number;
}

export interface CambioEstacion extends CambioEvolucion {
  estacionId: string;
}

export interface EstabilidadObservada {
  dias: number;
  /** `true` cuando no se ha visto ningún precio distinto dentro de la ventana. */
  limitadaPorVentana: boolean;
}

export function serieDeEstacion(
  historico: HistoricoProvincia,
  estacionId: string,
  combustible: ClavePrecio,
): PuntoEvolucion[] | null {
  const estacion = historico.estaciones.find((serie) => serie[0] === estacionId);
  if (!estacion) return null;
  return puntosDeSerie(historico, estacion, combustible);
}

function puntosDeSerie(
  historico: HistoricoProvincia,
  estacion: SerieHistoricaPublica,
  combustible: ClavePrecio,
): PuntoEvolucion[] {
  const precios = estacion[INDICE_PRECIO[combustible]];
  return historico.fechas.map((fecha, indice) => ({
    fecha,
    milesimas: estacion[2][indice] === 1 ? (precios[indice] ?? null) : null,
  }));
}

export function serieMedia(agregado: AgregadoHistorico, fechas: string[], combustible: ClavePrecio): PuntoEvolucion[] {
  return fechas.map((fecha, indice) => {
    const [suma, n] = agregado[combustible][indice] ?? [0, 0, null];
    return { fecha, milesimas: n === 0 ? null : Math.round(suma / n) };
  });
}

export function serieMinimo(agregado: AgregadoHistorico, fechas: string[], combustible: ClavePrecio): PuntoEvolucion[] {
  return fechas.map((fecha, indice) => ({
    fecha,
    milesimas: agregado[combustible][indice]?.[2] ?? null,
  }));
}

/** Compara extremos exactos. Para «90 días», una ventana de 90 cierres usa
 * su primera observación; nunca busca un punto cercano para ocultar huecos. */
export function cambioEnPeriodo(serie: PuntoEvolucion[], dias: PeriodoEvolucion): CambioEvolucion | null {
  if (serie.length === 0) return null;
  const indiceFinal = serie.length - 1;
  const indiceInicial = dias === 90 ? 0 : indiceFinal - dias;
  if (indiceInicial < 0) return null;
  const desde = serie[indiceInicial]!;
  const hasta = serie[indiceFinal]!;
  if (desde.milesimas === null || hasta.milesimas === null || desde.milesimas === 0) return null;
  const diferenciaMilesimas = hasta.milesimas - desde.milesimas;
  return {
    desde,
    hasta,
    diferenciaMilesimas,
    porcentaje: (diferenciaMilesimas / desde.milesimas) * 100,
  };
}

/** Describe solo observaciones: los huecos no se rellenan ni se interpretan
 * como estabilidad. El inicio es la primera publicación del precio actual
 * después de la última publicación distinta que puede verse en la ventana. */
export function estabilidadObservada(serie: PuntoEvolucion[]): EstabilidadObservada | null {
  const indiceFinal = serie.length - 1;
  const precioActual = serie[indiceFinal]?.milesimas ?? null;
  if (precioActual === null) return null;

  const observados = serie
    .map((punto, indice) => ({ indice, precio: punto.milesimas }))
    .filter((punto): punto is { indice: number; precio: number } => punto.precio !== null);
  if (observados.length < 2) return null;

  let inicioActual = observados[0]!.indice;
  for (let indice = observados.length - 2; indice >= 0; indice -= 1) {
    if (observados[indice]!.precio !== precioActual) {
      inicioActual = observados[indice + 1]!.indice;
      return { dias: indiceFinal - inicioActual, limitadaPorVentana: false };
    }
  }
  return { dias: indiceFinal - inicioActual, limitadaPorVentana: true };
}

export function cambiosDeEstaciones(
  historico: HistoricoProvincia,
  combustible: ClavePrecio,
  dias: PeriodoEvolucion,
  municipioId?: string | null,
): CambioEstacion[] {
  return historico.estaciones
    .filter((serie) => municipioId == null || serie[1] === municipioId)
    .flatMap((serie) => {
      const cambio = cambioEnPeriodo(puntosDeSerie(historico, serie, combustible), dias);
      return cambio ? [{ estacionId: serie[0], ...cambio }] : [];
    })
    .sort((a, b) => a.diferenciaMilesimas - b.diferenciaMilesimas || a.estacionId.localeCompare(b.estacionId));
}

export function validarHistoricoPublico(valor: unknown, provinciaId: string): HistoricoProvincia {
  if (!valor || typeof valor !== 'object') throw new Error('El histórico no tiene un formato válido.');
  const h = valor as Partial<HistoricoProvincia>;
  if (h.version !== 1 || h.provinciaId !== provinciaId || !Array.isArray(h.fechas) || !Array.isArray(h.estaciones)) {
    throw new Error('El histórico no es compatible con esta vista.');
  }
  if (h.fechas.length !== 90 || !h.provincia || !h.municipios) {
    throw new Error('La ventana histórica está incompleta.');
  }
  for (const serie of h.estaciones as SerieHistoricaPublica[]) {
    if (!Array.isArray(serie) || serie.length !== 7 || (serie[1] !== null && typeof serie[1] !== 'string') || serie.slice(2).some((parte) => !Array.isArray(parte) || parte.length !== 90)) {
      throw new Error('Una serie histórica está incompleta.');
    }
  }
  return h as HistoricoProvincia;
}
