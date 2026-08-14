import {
  DIAS_HISTORICO,
  desplazarFecha,
  type EstacionHistorica,
  type InstantaneaHistorica,
  type PrecioHistorico,
} from './historico.ts';
import { z } from 'zod';

export type CambioTerritorio = [
  indiceDia: number,
  provinciaId: string | null,
  municipioId: string | null,
];

export type SerieHistoricaEstacion = [
  id: string,
  territorios: CambioTerritorio[],
  gasolina95e5: PrecioHistorico[],
  gasoleoA: PrecioHistorico[],
  gasolina98e5: PrecioHistorico[],
  gasoleoPremium: PrecioHistorico[],
];

export interface EstadoHistorico {
  version: 1;
  fechas: string[];
  /** Verdadero si alguna instantánea que compone la ventana era de prueba
   *  (`InstantaneaHistorica.mock`). Contamina el estado: una vez presente,
   *  solo `--reconstruir` (siempre contra el MITECO real) lo limpia; el día
   *  de prueba puede salir de la ventana sin que la marca se borre sola. */
  mock?: true;
  estaciones: SerieHistoricaEstacion[];
}

export interface EstadoHistoricoProvincia {
  version: 1;
  provinciaId: string;
  fechas: string[];
  estaciones: SerieHistoricaEstacion[];
}

const PrecioHistoricoEsquema = z.number().int().min(0).max(10_000).nullable();
const CambioTerritorioEsquema = z.tuple([
  z.number().int().min(0),
  z.string().nullable(),
  z.string().nullable(),
]);
const SerieHistoricaEstacionEsquema = z.tuple([
  z.string().min(1),
  z.array(CambioTerritorioEsquema).min(1),
  z.array(PrecioHistoricoEsquema),
  z.array(PrecioHistoricoEsquema),
  z.array(PrecioHistoricoEsquema),
  z.array(PrecioHistoricoEsquema),
]);
const EstadoHistoricoEsquema = z.object({
  version: z.literal(1),
  fechas: z.array(z.string()).min(1).max(DIAS_HISTORICO),
  mock: z.literal(true).optional(),
  estaciones: z.array(SerieHistoricaEstacionEsquema),
});

type Territorio = [provinciaId: string, municipioId: string] | null;

function iguales(a: Territorio, b: Territorio): boolean {
  if (a === null || b === null) return a === b;
  return a[0] === b[0] && a[1] === b[1];
}

function compactarTerritorios(territorios: Territorio[]): CambioTerritorio[] {
  const cambios: CambioTerritorio[] = [];
  let anterior: Territorio | undefined;
  for (const [indice, territorio] of territorios.entries()) {
    if (anterior === undefined || !iguales(anterior, territorio)) {
      cambios.push([indice, territorio?.[0] ?? null, territorio?.[1] ?? null]);
      anterior = territorio;
    }
  }
  return cambios;
}

export function expandirTerritorios(cambios: CambioTerritorio[], dias: number): Territorio[] {
  if (cambios.length === 0 || cambios[0]?.[0] !== 0) {
    throw new Error('Una serie histórica debe declarar su territorio desde el índice 0.');
  }
  const resultado: Territorio[] = [];
  let indiceCambio = 0;
  for (let indice = 0; indice < dias; indice++) {
    if (cambios[indiceCambio + 1]?.[0] === indice) indiceCambio += 1;
    const [, provinciaId, municipioId] = cambios[indiceCambio]!;
    resultado.push(provinciaId === null || municipioId === null ? null : [provinciaId, municipioId]);
  }
  return resultado;
}

export function fechasSinPrecios(estado: EstadoHistorico): string[] {
  return estado.fechas.filter((_, indiceDia) =>
    !estado.estaciones.some((serie) =>
      ([2, 3, 4, 5] as const).some((indicePrecio) => serie[indicePrecio][indiceDia] !== null),
    ),
  );
}

export function reemplazarInstantaneaHistorica(
  estado: EstadoHistorico,
  instantanea: InstantaneaHistorica,
): EstadoHistorico {
  validarEstadoHistorico(estado);
  const indiceReemplazo = estado.fechas.indexOf(instantanea.fecha);
  if (indiceReemplazo < 0) {
    throw new Error(`La fecha ${instantanea.fecha} no pertenece a la ventana histórica.`);
  }

  const instantaneas: InstantaneaHistorica[] = estado.fechas.map((fecha) => ({
    version: 1,
    fecha,
    estaciones: [],
  }));
  for (const serie of estado.estaciones) {
    const territorios = expandirTerritorios(serie[1], estado.fechas.length);
    for (let indiceDia = 0; indiceDia < estado.fechas.length; indiceDia++) {
      const territorio = territorios[indiceDia];
      if (!territorio) continue;
      instantaneas[indiceDia]!.estaciones.push([
        serie[0],
        territorio[0],
        territorio[1],
        serie[2][indiceDia] ?? null,
        serie[3][indiceDia] ?? null,
        serie[4][indiceDia] ?? null,
        serie[5][indiceDia] ?? null,
      ]);
    }
  }
  instantaneas[indiceReemplazo] = instantanea;

  const reemplazado = construirEstadoHistorico(instantaneas);
  if (estado.mock) reemplazado.mock = true;
  validarEstadoHistorico(reemplazado);
  return reemplazado;
}

function comprobarFechasConsecutivas(fechas: string[]): void {
  for (let indice = 1; indice < fechas.length; indice++) {
    const esperada = desplazarFecha(fechas[indice - 1]!, 1);
    if (fechas[indice] !== esperada) {
      throw new Error(`La ventana histórica tiene un hueco: se esperaba ${esperada} y llegó ${fechas[indice]}.`);
    }
  }
}

export function validarEstadoHistorico(estado: EstadoHistorico): void {
  if (estado.version !== 1) throw new Error(`Versión histórica no soportada: ${estado.version}.`);
  if (estado.fechas.length < 1 || estado.fechas.length > DIAS_HISTORICO) {
    throw new Error(`La ventana histórica contiene ${estado.fechas.length} días.`);
  }
  comprobarFechasConsecutivas(estado.fechas);
  const ids = new Set<string>();
  for (const serie of estado.estaciones) {
    if (ids.has(serie[0])) throw new Error(`IDEESS duplicado en el estado histórico: ${serie[0]}.`);
    ids.add(serie[0]);
    if (serie[1].length === 0 || serie[1][0]?.[0] !== 0) {
      throw new Error(`La estación ${serie[0]} no declara territorio desde el primer día.`);
    }
    for (const cambios of serie[1]) {
      if (cambios[0] < 0 || cambios[0] >= estado.fechas.length) {
        throw new Error(`Cambio territorial fuera de la ventana en ${serie[0]}: ${cambios[0]}.`);
      }
    }
    for (const precios of serie.slice(2) as PrecioHistorico[][]) {
      if (precios.length !== estado.fechas.length) {
        throw new Error(`La estación ${serie[0]} no tiene ${estado.fechas.length} observaciones.`);
      }
    }
  }
}

/**
 * Exige que la ventana esté completa: exactamente `DIAS_HISTORICO` días.
 * Deliberadamente separada de `validarEstadoHistorico`, que acepta ventanas
 * de 1 a `DIAS_HISTORICO` días a propósito — la usan pruebas con ventanas
 * cortas y el propio contrato de esquema, que no distingue una ventana en
 * construcción de una lista para publicarse. Esta función sí distingue: se
 * llama en los puntos donde una ventana incompleta no debe poder avanzar
 * — al terminar `--reconstruir` y al empezar a materializar los artefactos
 * públicos —, no en la validación estructural general.
 */
export function comprobarVentanaCompleta(estado: EstadoHistorico): void {
  if (estado.fechas.length !== DIAS_HISTORICO) {
    throw new Error(
      `El estado histórico tiene ${estado.fechas.length} días; se esperaban ${DIAS_HISTORICO}.`,
    );
  }
}

export function parsearEstadoHistorico(valor: unknown): EstadoHistorico {
  const resultado = EstadoHistoricoEsquema.safeParse(valor);
  if (!resultado.success) {
    throw new Error(`El estado histórico no cumple el contrato: ${resultado.error.message}`);
  }
  const estado = resultado.data as EstadoHistorico;
  validarEstadoHistorico(estado);
  return estado;
}

export function partirEstadoPorProvincia(
  estado: EstadoHistorico,
): Map<string, EstadoHistoricoProvincia> {
  validarEstadoHistorico(estado);
  const porProvincia = new Map<string, SerieHistoricaEstacion[]>();
  for (const serie of estado.estaciones) {
    const provincias = new Set(
      serie[1]
        .map(([, provinciaId]) => provinciaId)
        .filter((provinciaId): provinciaId is string => provinciaId !== null),
    );
    for (const provinciaId of provincias) {
      const estaciones = porProvincia.get(provinciaId) ?? [];
      estaciones.push(serie);
      porProvincia.set(provinciaId, estaciones);
    }
  }
  return new Map(
    [...porProvincia.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([provinciaId, estaciones]) => [
      provinciaId,
      { version: 1, provinciaId, fechas: estado.fechas, estaciones },
    ]),
  );
}

export function construirEstadoHistorico(instantaneas: InstantaneaHistorica[]): EstadoHistorico {
  if (instantaneas.length < 1 || instantaneas.length > DIAS_HISTORICO) {
    throw new Error(`Se recibieron ${instantaneas.length} instantáneas; se esperaban entre 1 y ${DIAS_HISTORICO}.`);
  }
  const ordenadas = [...instantaneas].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const fechas = ordenadas.map(({ fecha }) => fecha);
  comprobarFechasConsecutivas(fechas);

  const filasPorDia = ordenadas.map(
    ({ estaciones }) => new Map(estaciones.map((fila) => [fila[0], fila] as const)),
  );
  const ids = [...new Set(ordenadas.flatMap(({ estaciones }) => estaciones.map((fila) => fila[0])))].sort(
    (a, b) => a.localeCompare(b, 'es'),
  );
  const estaciones: SerieHistoricaEstacion[] = ids.map((id) => {
    const filas = filasPorDia.map((dia) => dia.get(id));
    const territorios = filas.map<Territorio>((fila) => (fila ? [fila[1], fila[2]] : null));
    const precios = ([3, 4, 5, 6] as const).map((indice) =>
      filas.map((fila) => fila?.[indice] ?? null),
    ) as [PrecioHistorico[], PrecioHistorico[], PrecioHistorico[], PrecioHistorico[]];
    return [id, compactarTerritorios(territorios), ...precios];
  });

  const estado: EstadoHistorico = { version: 1, fechas, estaciones };
  if (instantaneas.some((instantanea) => instantanea.mock)) estado.mock = true;
  validarEstadoHistorico(estado);
  return estado;
}

export function avanzarEstadoHistorico(
  estado: EstadoHistorico,
  instantanea: InstantaneaHistorica,
): EstadoHistorico {
  validarEstadoHistorico(estado);
  const ultima = estado.fechas.at(-1)!;
  const esperada = desplazarFecha(ultima, 1);
  if (instantanea.fecha !== esperada) {
    throw new Error(`Para avanzar ${ultima} se esperaba ${esperada}, no ${instantanea.fecha}.`);
  }

  const descartarPrimero = estado.fechas.length === DIAS_HISTORICO;
  const fechas = [...(descartarPrimero ? estado.fechas.slice(1) : estado.fechas), instantanea.fecha];
  const nuevaPorId = new Map(instantanea.estaciones.map((fila) => [fila[0], fila] as const));
  const anteriores = new Map(estado.estaciones.map((serie) => [serie[0], serie] as const));
  const ids = [...new Set([...anteriores.keys(), ...nuevaPorId.keys()])].sort((a, b) =>
    a.localeCompare(b, 'es'),
  );

  const estaciones: SerieHistoricaEstacion[] = [];
  for (const id of ids) {
    const anterior = anteriores.get(id);
    const nueva = nuevaPorId.get(id);
    const territoriosAnteriores = anterior
      ? expandirTerritorios(anterior[1], estado.fechas.length)
      : Array<Territorio>(estado.fechas.length).fill(null);
    const territorios = [
      ...(descartarPrimero ? territoriosAnteriores.slice(1) : territoriosAnteriores),
      nueva ? ([nueva[1], nueva[2]] as Territorio) : null,
    ];
    const precios = ([3, 4, 5, 6] as const).map((indicePrecio, indiceSerie) => [
      ...(anterior
        ? descartarPrimero
          ? anterior[indiceSerie + 2]!.slice(1)
          : anterior[indiceSerie + 2]!
        : Array<PrecioHistorico>(estado.fechas.length - (descartarPrimero ? 1 : 0)).fill(null)),
      nueva?.[indicePrecio] ?? null,
    ]) as [PrecioHistorico[], PrecioHistorico[], PrecioHistorico[], PrecioHistorico[]];

    // Una estación que ya no aparece en ningún día de la ventana deja de formar parte del estado.
    if (territorios.every((territorio) => territorio === null)) continue;
    estaciones.push([id, compactarTerritorios(territorios), ...precios]);
  }

  const siguiente: EstadoHistorico = { version: 1, fechas, estaciones };
  if (estado.mock || instantanea.mock) siguiente.mock = true;
  validarEstadoHistorico(siguiente);
  return siguiente;
}
