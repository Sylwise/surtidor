import { z } from 'zod';

import {
  ErrorResultadoMiteco,
  pedirJsonMiteco,
  type OpcionesPeticionMiteco,
} from './miteco.ts';

export const DIAS_HISTORICO = 90;

export type PrecioHistorico = number | null;

/**
 * Fila compacta e inmutable. Los precios son milésimas de euro por litro:
 * `1,429 €/L` se guarda como `1429`, sin flotantes ni ceros finales en JSON.
 */
export type EstacionHistorica = [
  id: string,
  provinciaId: string,
  municipioId: string,
  gasolina95e5: PrecioHistorico,
  gasoleoA: PrecioHistorico,
  gasolina98e5: PrecioHistorico,
  gasoleoPremium: PrecioHistorico,
];

export interface InstantaneaHistorica {
  version: 1;
  fecha: string;
  /** RNF-43/RNF-44: marca una instantánea de prueba, igual que `DatosProvincia.mock`
   *  (`scripts/lib/tipos.ts`). Ausente o `true`, nunca `false`. */
  mock?: true;
  estaciones: EstacionHistorica[];
}

const PrecioCompactoEsquema = z.number().int().min(0).max(10_000).nullable();
const InstantaneaHistoricaEsquema = z.object({
  version: z.literal(1),
  fecha: z.string(),
  mock: z.literal(true).optional(),
  estaciones: z.array(
    z.tuple([
      z.string().min(1),
      z.string().min(1),
      z.string().min(1),
      PrecioCompactoEsquema,
      PrecioCompactoEsquema,
      PrecioCompactoEsquema,
      PrecioCompactoEsquema,
    ]),
  ),
});

type FilaCruda = Record<string, string>;

const RespuestaHistoricaEsquema = z.object({
  Fecha: z.string(),
  ResultadoConsulta: z.string(),
  ListaEESSPrecio: z.array(z.record(z.string())),
});

const CAMPOS_PRECIO = [
  'Precio Gasolina 95 E5',
  'Precio Gasoleo A',
  'Precio Gasolina 98 E5',
  'Precio Gasoleo Premium',
] as const;

/** Convierte `2026-08-09` al formato de ruta del Ministerio. */
export function fechaIsoAMiteco(fecha: string): string {
  const partes = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!partes) throw new Error(`Fecha histórica inválida: ${fecha}. Se esperaba AAAA-MM-DD.`);
  const [, anio, mes, dia] = partes;
  const fechaUtc = new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia)));
  if (
    fechaUtc.getUTCFullYear() !== Number(anio) ||
    fechaUtc.getUTCMonth() !== Number(mes) - 1 ||
    fechaUtc.getUTCDate() !== Number(dia)
  ) {
    throw new Error(`Fecha histórica inexistente: ${fecha}.`);
  }
  return `${dia}-${mes}-${anio}`;
}

/** Convierte la fecha textual de la respuesta del Ministerio a ISO. */
export function fechaMitecoAIso(fecha: string): string {
  const partes = fecha.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s|$)/);
  if (!partes) throw new Error(`Fecha inesperada en la respuesta histórica: ${fecha}.`);
  return `${partes[3]}-${partes[2]}-${partes[1]}`;
}

export function desplazarFecha(fecha: string, dias: number): string {
  fechaIsoAMiteco(fecha);
  const [anio, mes, dia] = fecha.split('-').map(Number) as [number, number, number];
  const resultado = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return resultado.toISOString().slice(0, 10);
}

export function fechasDeVentana(fechaFinal: string, dias = DIAS_HISTORICO): string[] {
  if (!Number.isInteger(dias) || dias < 1) throw new Error('La ventana debe tener al menos un día.');
  return Array.from({ length: dias }, (_, indice) => desplazarFecha(fechaFinal, indice - dias + 1));
}

/** Ayer civil en Europe/Madrid, independiente de la zona horaria del runner. */
export function ayerEnMadrid(ahora = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ahora);
  const valor = (tipo: Intl.DateTimeFormatPartTypes): number =>
    Number(partes.find((parte) => parte.type === tipo)?.value);
  const hoy = new Date(Date.UTC(valor('year'), valor('month') - 1, valor('day')));
  hoy.setUTCDate(hoy.getUTCDate() - 1);
  return hoy.toISOString().slice(0, 10);
}

function desescaparClave(clave: string): string {
  return clave.replace(/_x([0-9a-fA-F]{4})_/g, (_, hexadecimal: string) =>
    String.fromCharCode(Number.parseInt(hexadecimal, 16)),
  );
}

function normalizarClaves(fila: FilaCruda): FilaCruda {
  const resultado: FilaCruda = {};
  for (const [clave, valor] of Object.entries(fila)) {
    const normal = desescaparClave(clave);
    if (resultado[normal] !== undefined && resultado[normal] !== valor) {
      throw new Error(`La estación ${fila.IDEESS ?? '(sin IDEESS)'} repite el campo ${normal}.`);
    }
    resultado[normal] = valor;
  }
  return resultado;
}

function campoObligatorio(fila: FilaCruda, campo: string): string {
  const valor = fila[campo];
  if (valor === undefined) {
    throw new Error(`La estación ${fila.IDEESS ?? '(sin IDEESS)'} no contiene ${campo}.`);
  }
  return valor;
}

function precioAMilesimas(valor: string, campo: string, id: string): PrecioHistorico {
  if (valor.trim() === '') return null;
  if (!/^\d+(?:,\d{1,3})?$/.test(valor)) {
    throw new Error(`Precio histórico inválido en ${id}, ${campo}: ${JSON.stringify(valor)}.`);
  }
  const [euros, decimales = ''] = valor.split(',');
  return Number(euros) * 1000 + Number(decimales.padEnd(3, '0'));
}

export function normalizarRespuestaHistorica(
  respuesta: z.infer<typeof RespuestaHistoricaEsquema>,
  fechaEsperada: string,
): InstantaneaHistorica {
  if (respuesta.ResultadoConsulta !== 'OK') {
    throw new ErrorResultadoMiteco(
      `La API histórica devolvió ResultadoConsulta="${respuesta.ResultadoConsulta}" para ${fechaEsperada}.`,
    );
  }
  const fecha = fechaMitecoAIso(respuesta.Fecha);
  if (fecha !== fechaEsperada) {
    throw new Error(`La API histórica devolvió ${fecha}, pero se solicitó ${fechaEsperada}.`);
  }

  const ids = new Set<string>();
  const estaciones: EstacionHistorica[] = [];
  for (const cruda of respuesta.ListaEESSPrecio) {
    const fila = normalizarClaves(cruda);
    const id = campoObligatorio(fila, 'IDEESS');
    if (ids.has(id)) throw new Error(`IDEESS histórico duplicado en ${fecha}: ${id}.`);
    ids.add(id);

    const tipoVentaCrudo = campoObligatorio(fila, 'Tipo Venta');
    const tipoVenta = tipoVentaCrudo.toUpperCase();
    if (!['P', 'R', 'A'].includes(tipoVenta)) {
      throw new Error(`Tipo Venta histórico inesperado en ${id}: ${JSON.stringify(tipoVentaCrudo)}.`);
    }
    if (tipoVenta !== 'P') continue;

    const precios = CAMPOS_PRECIO.map((campo) =>
      precioAMilesimas(campoObligatorio(fila, campo), campo, id),
    ) as [PrecioHistorico, PrecioHistorico, PrecioHistorico, PrecioHistorico];
    estaciones.push([
      id,
      campoObligatorio(fila, 'IDProvincia'),
      campoObligatorio(fila, 'IDMunicipio'),
      ...precios,
    ]);
  }

  // La API puede responder OK y devolver la fecha solicitada antes de que el
  // volcado diario esté realmente disponible. Aceptar ese falso positivo
  // convertiría todas las estaciones del último día en ausentes y dejaría
  // sin comparación a toda la aplicación. En España una instantánea nacional
  // sin ninguna estación de venta pública nunca es un resultado válido.
  if (estaciones.length === 0) {
    throw new ErrorResultadoMiteco(
      `La API histórica no devolvió estaciones de venta pública para ${fechaEsperada}.`,
    );
  }

  estaciones.sort((a, b) => a[0].localeCompare(b[0], 'es'));
  return { version: 1, fecha, estaciones };
}

export function parsearInstantaneaHistorica(valor: unknown): InstantaneaHistorica {
  const resultado = InstantaneaHistoricaEsquema.safeParse(valor);
  if (!resultado.success) {
    throw new Error(`La instantánea histórica no cumple el contrato: ${resultado.error.message}`);
  }
  const instantanea = resultado.data as InstantaneaHistorica;
  fechaIsoAMiteco(instantanea.fecha);
  const ids = new Set<string>();
  for (const [id] of instantanea.estaciones) {
    if (ids.has(id)) throw new Error(`IDEESS duplicado en la instantánea ${instantanea.fecha}: ${id}.`);
    ids.add(id);
  }
  return instantanea;
}

export async function obtenerInstantaneaHistorica(
  fecha: string,
  opciones: OpcionesPeticionMiteco = {},
): Promise<InstantaneaHistorica> {
  const ruta = `EstacionesTerrestresHist/${fechaIsoAMiteco(fecha)}`;
  const respuesta = await pedirJsonMiteco(ruta, RespuestaHistoricaEsquema, opciones);
  return normalizarRespuestaHistorica(respuesta, fecha);
}
