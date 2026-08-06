// Traduce la respuesta cruda del MITECO al contrato de `Estacion` definido en
// scripts/lib/tipos.ts (ver docs/03-arquitectura.md y docs/04-fuente-datos.md).
//
// El acoplamiento a los nombres de campo del ministerio (espacios, acentos,
// paréntesis, y su variante escapada `_x0020_`/`_x0028_`/`_x0029_` del
// endpoint histórico) se queda encerrado en este fichero.

import type { ClavePrecio, Estacion, Margen, Precios, TipoVenta } from './tipos.ts';

/**
 * Estación tal y como la devuelve la API del MITECO: todo son cadenas (o
 * ausente), con coma decimal en los números y claves con espacios y acentos.
 * Se acepta también la forma escapada del endpoint histórico.
 */
export type EstacionCruda = Record<string, string | undefined>;

// Cada clave de precio que nos interesa, con las dos formas en las que puede
// llegar el nombre de campo: la normal y la escapada del histórico.
const CAMPOS_PRECIO: Record<ClavePrecio, [normal: string, escapada: string]> = {
  gasolina95e5: ['Precio Gasolina 95 E5', 'Precio_x0020_Gasolina_x0020_95_x0020_E5'],
  gasoleoA: ['Precio Gasoleo A', 'Precio_x0020_Gasoleo_x0020_A'],
  gasolina98e5: ['Precio Gasolina 98 E5', 'Precio_x0020_Gasolina_x0020_98_x0020_E5'],
  gasoleoPremium: ['Precio Gasoleo Premium', 'Precio_x0020_Gasoleo_x0020_Premium'],
};

const CAMPO_LATITUD: [string, string] = ['Latitud', 'Latitud'];
const CAMPO_LONGITUD: [string, string] = [
  'Longitud (WGS84)',
  'Longitud_x0020__x0028_WGS84_x0029_',
];
const CAMPO_TIPO_VENTA: [string, string] = ['Tipo Venta', 'Tipo_x0020_Venta'];
const CAMPO_MARGEN: [string, string] = ['Margen', 'Margen'];

const VALORES_TIPO_VENTA = new Set<string>(['P', 'R', 'A']);
const VALORES_MARGEN = new Set<string>(['D', 'I', 'N']);

/** Lee la primera clave presente en `estacion`, probando la forma normal y la escapada. */
function leerCampo(estacion: EstacionCruda, [normal, escapada]: [string, string]): string | undefined {
  if (estacion[normal] !== undefined) return estacion[normal];
  return estacion[escapada];
}

/**
 * Convierte una cadena numérica del MITECO (coma decimal, o cadena vacía) en
 * número. Cadena vacía o ausente da `null`, nunca `0`.
 */
function aNumeroONulo(valor: string | undefined): number | null {
  if (valor === undefined || valor.trim() === '') return null;
  const numero = Number.parseFloat(valor.replace(',', '.'));
  return Number.isFinite(numero) ? numero : null;
}

/** Igual que `aNumeroONulo`, pero para coordenadas: no hay valor válido "ausente", es descarte. */
function aCoordenada(valor: string | undefined): number | null {
  return aNumeroONulo(valor);
}

/**
 * `Tipo Venta` tiene tres valores válidos según el anexo de la Orden
 * ITC/2308/2007 (docs/04-fuente-datos.md): `P` (público), `R` (restringido a
 * asociados o cooperativistas) y `A` (productos distintos al público general
 * y a sus asociados). Cualquier otra cosa —incluida cadena vacía o ausente—
 * es inesperada: cae a `P` y se marca para que el log del build lo cuente.
 */
function aTipoVenta(valor: string | undefined): { valor: TipoVenta; inesperado: boolean } {
  if (valor !== undefined && VALORES_TIPO_VENTA.has(valor)) {
    return { valor: valor as TipoVenta, inesperado: false };
  }
  return { valor: 'P', inesperado: true };
}

/**
 * `Margen` tiene tres valores documentados: `D`, `I`, `N`. Vacío o ausente es
 * el caso normal de "sin margen declarado" y da `null` en silencio. Cualquier
 * otro valor es inesperado: también cae a `null`, pero se cuenta.
 */
function aMargen(valor: string | undefined): { valor: Margen; inesperado: boolean } {
  if (valor !== undefined && VALORES_MARGEN.has(valor)) {
    return { valor: valor as Margen, inesperado: false };
  }
  if (valor === undefined || valor.trim() === '') {
    return { valor: null, inesperado: false };
  }
  return { valor: null, inesperado: true };
}

function normalizarPrecios(estacion: EstacionCruda): Precios {
  const precios = {} as Precios;
  for (const clave of Object.keys(CAMPOS_PRECIO) as ClavePrecio[]) {
    precios[clave] = aNumeroONulo(leerCampo(estacion, CAMPOS_PRECIO[clave]));
  }
  return precios;
}

interface DiagnosticoNormalizacion {
  estacion: Estacion | null;
  tipoVentaInesperado: boolean;
  margenInesperado: boolean;
}

/**
 * Normaliza una única estación cruda junto con los avisos de campos con
 * valores inesperados, para que `normalizarEstaciones` pueda acumularlos.
 * `estacion` es `null` si no tiene coordenadas válidas (se descarta, RF-06).
 */
function normalizarEstacionConDiagnostico(estacion: EstacionCruda): DiagnosticoNormalizacion {
  const lat = aCoordenada(leerCampo(estacion, CAMPO_LATITUD));
  const lon = aCoordenada(leerCampo(estacion, CAMPO_LONGITUD));
  if (lat === null || lon === null) {
    return { estacion: null, tipoVentaInesperado: false, margenInesperado: false };
  }

  const tipoVenta = aTipoVenta(leerCampo(estacion, CAMPO_TIPO_VENTA));
  const margen = aMargen(leerCampo(estacion, CAMPO_MARGEN));

  return {
    estacion: {
      id: estacion['IDEESS'] ?? '',
      rotulo: estacion['Rótulo'] ?? '',
      direccion: estacion['Dirección'] ?? '',
      municipio: estacion['Municipio'] ?? '',
      cp: estacion['C.P.'] ?? '',
      lat,
      lon,
      horario: estacion['Horario'] ?? '',
      tipoVenta: tipoVenta.valor,
      margen: margen.valor,
      precios: normalizarPrecios(estacion),
    },
    tipoVentaInesperado: tipoVenta.inesperado,
    margenInesperado: margen.inesperado,
  };
}

/**
 * Normaliza una única estación cruda. Devuelve `null` si no tiene
 * coordenadas válidas (se descarta, RF-06).
 */
export function normalizarEstacion(estacion: EstacionCruda): Estacion | null {
  return normalizarEstacionConDiagnostico(estacion).estacion;
}

export interface ResultadoNormalizacion {
  estaciones: Estacion[];
  descartadas: number;
  tipoVentaInesperados: number;
  margenInesperados: number;
}

/**
 * Normaliza una lista de estaciones crudas. Las que no tienen coordenadas
 * válidas se descartan y se cuentan, para que H5 pueda loguearlo (RF-06). Las
 * que tienen `Tipo Venta` o `Margen` con un valor que no encaja también se
 * cuentan, aunque la estación se conserve con el valor de reserva.
 */
export function normalizarEstaciones(estacionesCrudas: EstacionCruda[]): ResultadoNormalizacion {
  const estaciones: Estacion[] = [];
  let descartadas = 0;
  let tipoVentaInesperados = 0;
  let margenInesperados = 0;

  for (const cruda of estacionesCrudas) {
    const diagnostico = normalizarEstacionConDiagnostico(cruda);
    if (diagnostico.estacion === null) {
      descartadas += 1;
      continue;
    }
    estaciones.push(diagnostico.estacion);
    if (diagnostico.tipoVentaInesperado) tipoVentaInesperados += 1;
    if (diagnostico.margenInesperado) margenInesperados += 1;
  }

  return { estaciones, descartadas, tipoVentaInesperados, margenInesperados };
}
