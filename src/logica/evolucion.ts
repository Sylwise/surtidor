import type { AgregadoHistorico, HistoricoProvincia, SerieHistoricaPublica } from '../../scripts/lib/artefactos-historicos.ts';
import type { ClavePrecio } from '../../scripts/lib/tipos.ts';

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

export function serieDeEstacion(
  historico: HistoricoProvincia,
  estacionId: string,
  combustible: ClavePrecio,
): PuntoEvolucion[] | null {
  const estacion = historico.estaciones.find((serie) => serie[0] === estacionId);
  if (!estacion) return null;
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

/** Compara extremos exactos. Para «90 días», una ventana de 90 cierres usa
 * su primera observación; nunca busca un punto cercano para ocultar huecos. */
export function cambioEnPeriodo(serie: PuntoEvolucion[], dias: 7 | 30 | 90): CambioEvolucion | null {
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
