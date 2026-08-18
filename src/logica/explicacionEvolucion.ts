import { cambioEnPeriodo, cambiosDeEstaciones, serieMedia, type CambioEvolucion, type PeriodoEvolucion } from './evolucion.ts';
import type { HistoricoProvincia } from '../../scripts/lib/artefactos-historicos.ts';
import type { ClavePrecio, Estacion } from '../../scripts/lib/tipos.ts';

export interface TramoIntenso {
  desde: string;
  hasta: string;
  diferenciaMilesimas: number;
  proporcionDelCambio: number | null;
}

export interface AmplitudCambio {
  comparables: number;
  subieron: number;
  bajaron: number;
  estables: number;
  alineadas: number;
  proporcionAlineada: number | null;
}

export interface ConcentracionMarca {
  rotulo: string;
  comparables: number;
  alineadas: number;
  proporcionAlineada: number;
  cambioMedianoMilesimas: number;
}

export interface ExplicacionEvolucion {
  cambio: CambioEvolucion | null;
  tramoIntenso: TramoIntenso | null;
  amplitud: AmplitudCambio;
  marcaMasAlineada: ConcentracionMarca | null;
  minimo90Milesimas: number | null;
  maximo90Milesimas: number | null;
  distanciaAlMinimoMilesimas: number | null;
  distanciaAlMaximoMilesimas: number | null;
}

function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const centro = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0
    ? Math.round((ordenados[centro - 1]! + ordenados[centro]!) / 2)
    : ordenados[centro]!;
}

function encontrarTramoIntenso(
  serie: ReturnType<typeof serieMedia>,
  cambio: CambioEvolucion | null,
  dias: PeriodoEvolucion,
): TramoIntenso | null {
  const inicio = dias === 90 ? 0 : serie.length - 1 - dias;
  const tramo = serie.slice(Math.max(0, inicio));
  if (tramo.length < 4) return null;
  let mejor: { inicio: number; fin: number; diferencia: number } | null = null;
  for (let fin = 3; fin < tramo.length; fin += 1) {
    const desde = tramo[fin - 3]!.milesimas;
    const hasta = tramo[fin]!.milesimas;
    if (desde === null || hasta === null) continue;
    const diferencia = hasta - desde;
    if (mejor === null || Math.abs(diferencia) > Math.abs(mejor.diferencia)) mejor = { inicio: fin - 3, fin, diferencia };
  }
  if (!mejor) return null;
  const total = cambio?.diferenciaMilesimas ?? 0;
  return {
    desde: tramo[mejor.inicio]!.fecha,
    hasta: tramo[mejor.fin]!.fecha,
    diferenciaMilesimas: mejor.diferencia,
    proporcionDelCambio: total === 0 || Math.sign(total) !== Math.sign(mejor.diferencia) ? null : Math.abs(mejor.diferencia / total),
  };
}

export function explicarEvolucion(
  historico: HistoricoProvincia,
  estacionesActuales: Estacion[],
  combustible: ClavePrecio,
  dias: PeriodoEvolucion,
  municipioId: string | null = null,
): ExplicacionEvolucion {
  const agregado = municipioId ? historico.municipios[municipioId] : historico.provincia;
  const media = serieMedia(agregado ?? historico.provincia, historico.fechas, combustible);
  const cambio = cambioEnPeriodo(media, dias);
  const cambios = cambiosDeEstaciones(historico, combustible, dias, municipioId);
  const idsActuales = new Set(estacionesActuales.map((estacion) => estacion.id));
  const comparables = cambios.filter((entrada) => idsActuales.has(entrada.estacionId));
  const subieron = comparables.filter((entrada) => entrada.diferenciaMilesimas > 0).length;
  const bajaron = comparables.filter((entrada) => entrada.diferenciaMilesimas < 0).length;
  const estables = comparables.length - subieron - bajaron;
  const direccion = Math.sign(cambio?.diferenciaMilesimas ?? 0);
  const alineadas = direccion > 0 ? subieron : direccion < 0 ? bajaron : estables;

  const estacionPorId = new Map(estacionesActuales.map((estacion) => [estacion.id, estacion]));
  const marcas = new Map<string, number[]>();
  for (const entrada of comparables) {
    const rotulo = estacionPorId.get(entrada.estacionId)?.rotulo;
    if (!rotulo) continue;
    const valores = marcas.get(rotulo) ?? [];
    valores.push(entrada.diferenciaMilesimas);
    marcas.set(rotulo, valores);
  }
  const candidatas = [...marcas.entries()].map(([rotulo, valores]) => {
    const movimientosAlineados = valores.filter((valor) => Math.sign(valor) === direccion);
    return {
      rotulo,
      comparables: valores.length,
      alineadas: movimientosAlineados.length,
      proporcionAlineada: valores.length === 0 ? 0 : movimientosAlineados.length / valores.length,
      cambioMedianoMilesimas: mediana(valores),
    };
  }).filter((marca) => marca.comparables >= 2 && marca.alineadas > 0)
    .sort((a, b) => b.alineadas - a.alineadas || b.proporcionAlineada - a.proporcionAlineada || a.rotulo.localeCompare(b.rotulo, 'es'));

  const valores90 = media.flatMap((punto) => punto.milesimas === null ? [] : [punto.milesimas]);
  const minimo90Milesimas = valores90.length ? Math.min(...valores90) : null;
  const maximo90Milesimas = valores90.length ? Math.max(...valores90) : null;
  const ultimo = media.at(-1)?.milesimas ?? null;
  return {
    cambio,
    tramoIntenso: encontrarTramoIntenso(media, cambio, dias),
    amplitud: {
      comparables: comparables.length,
      subieron,
      bajaron,
      estables,
      alineadas,
      proporcionAlineada: comparables.length ? alineadas / comparables.length : null,
    },
    marcaMasAlineada: candidatas[0] ?? null,
    minimo90Milesimas,
    maximo90Milesimas,
    distanciaAlMinimoMilesimas: ultimo === null || minimo90Milesimas === null ? null : ultimo - minimo90Milesimas,
    distanciaAlMaximoMilesimas: ultimo === null || maximo90Milesimas === null ? null : maximo90Milesimas - ultimo,
  };
}
