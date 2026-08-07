// Cliente HTTP para la API pública de precios de carburantes del MITECO.
// Ver docs/04-fuente-datos.md para las diez trampas conocidas del servicio.
//
// Este módulo SOLO pide datos y comprueba que tengan la forma esperada. No
// convierte comas en puntos, ni cadenas vacías en null, ni nada parecido a
// eso: esa normalización vive en scripts/lib/normalizar.ts (hito H3), un
// fichero distinto.
//
// Los nombres de campo del ministerio (con espacios, acentos y paréntesis)
// no deben salir de este fichero, según la trampa 5 de docs/04-fuente-datos.md.

import { z } from 'zod';

/** URL base del servicio REST del MITECO. Con barra final, a propósito. */
const URL_BASE =
  'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/';

/** Timeout por intento de petición (trampa 9 de docs/04-fuente-datos.md). */
const TIMEOUT_MS_DEFECTO = 30_000;

/**
 * Esperas, en milisegundos, antes de cada reintento tras un fallo: 2 s, 4 s,
 * 8 s (trampa 9 de docs/04-fuente-datos.md). Su longitud fija el número de
 * reintentos: tres esperas son tres reintentos, es decir, hasta cuatro
 * intentos en total.
 */
const ESPERAS_REINTENTO_MS_DEFECTO = [2_000, 4_000, 8_000] as const;

/** Firma mínima de `fetch`, para poder inyectar un doble de pruebas. */
type FuncionFetch = typeof fetch;

export interface OpcionesPeticionMiteco {
  /** Implementación de `fetch` a usar. Por defecto, la global del entorno. */
  fetch?: FuncionFetch;
  /** URL base alternativa (para pruebas, o para el espejo del ministerio). */
  urlBase?: string;
  /** Timeout por intento, en milisegundos. Por defecto 30 000 (30 s). */
  timeoutMs?: number;
  /** Esperas entre reintentos, en milisegundos. Por defecto [2000, 4000, 8000]. */
  esperasReintentoMs?: readonly number[];
}

/**
 * La respuesta llegó y es JSON válido, pero su forma no coincide con lo
 * esperado: probable cambio de nombres de campo en la API del ministerio.
 * Se lanza de inmediato, sin reintentar y sin silenciar nada (RNF-41):
 * quien llame debe enterarse de forma ruidosa.
 */
export class ErrorValidacionMiteco extends Error {
  constructor(mensaje: string, opciones?: ErrorOptions) {
    super(mensaje, opciones);
    this.name = 'ErrorValidacionMiteco';
  }
}

/**
 * Fallaron todos los intentos de red: timeout, caída puntual del servicio,
 * respuesta HTTP no satisfactoria, etc. Ver trampa 9 de docs/04-fuente-datos.md.
 */
export class ErrorPeticionMiteco extends Error {
  constructor(mensaje: string, opciones?: ErrorOptions) {
    super(mensaje, opciones);
    this.name = 'ErrorPeticionMiteco';
  }
}

/**
 * La respuesta tiene forma válida pero `ResultadoConsulta` no vale `"OK"`.
 * No es un problema de red ni de esquema: es la propia API diciendo que la
 * consulta no salió bien.
 */
export class ErrorResultadoMiteco extends Error {
  constructor(mensaje: string, opciones?: ErrorOptions) {
    super(mensaje, opciones);
    this.name = 'ErrorResultadoMiteco';
  }
}

function dormir(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

function describirError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError') return 'se agotó el tiempo de espera';
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

/**
 * Helper genérico de petición al MITECO: cabecera `Accept: application/json`
 * obligatoria (trampa 2), timeout por intento con `AbortController`,
 * reintentos con espera creciente (trampa 9), y validación de la forma de
 * la respuesta con el esquema zod recibido.
 *
 * Pensado para reutilizarse con cualquier endpoint del servicio — hoy solo
 * lo usa `obtenerEstacionesPorProvincia` (`EstacionesTerrestres/FiltroProvincia`),
 * pero el mismo helper sirve mañana para `Listados/Provincias` o
 * `Listados/ComunidadesAutonomas` sin cambiar nada de esta función.
 *
 * Un fallo de validación zod (forma inesperada) se relanza de inmediato,
 * envuelto en `ErrorValidacionMiteco`, sin consumir reintentos: reintentar
 * la misma petición no arregla un cambio de esquema en el origen.
 */
export async function pedirJsonMiteco<T>(
  ruta: string,
  esquema: z.ZodType<T>,
  opciones: OpcionesPeticionMiteco = {},
): Promise<T> {
  const fetchImpl = opciones.fetch ?? fetch;
  const urlBase = opciones.urlBase ?? URL_BASE;
  const timeoutMs = opciones.timeoutMs ?? TIMEOUT_MS_DEFECTO;
  const esperasReintentoMs = opciones.esperasReintentoMs ?? ESPERAS_REINTENTO_MS_DEFECTO;

  const url = new URL(ruta, urlBase).toString();
  const intentosTotales = esperasReintentoMs.length + 1;

  for (let intento = 1; intento <= intentosTotales; intento++) {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), timeoutMs);

    try {
      const respuesta = await fetchImpl(url, {
        headers: { Accept: 'application/json' },
        signal: controlador.signal,
      });

      if (!respuesta.ok) {
        throw new ErrorPeticionMiteco(
          `La API del MITECO respondió ${respuesta.status} ${respuesta.statusText} en ${url}`,
        );
      }

      const cuerpo: unknown = await respuesta.json();

      const resultado = esquema.safeParse(cuerpo);
      if (!resultado.success) {
        throw new ErrorValidacionMiteco(
          `La respuesta de ${url} no tiene la forma esperada. Es probable que ` +
            'el MITECO haya cambiado nombres de campo (ver docs/04-fuente-datos.md, ' +
            `trampa 5). Detalle de zod: ${resultado.error.message}`,
          { cause: resultado.error },
        );
      }

      return resultado.data;
    } catch (error) {
      // Un fallo de validación es definitivo: no se reintenta, se relanza tal cual.
      if (error instanceof ErrorValidacionMiteco) {
        throw error;
      }

      const esUltimoIntento = intento === intentosTotales;
      if (esUltimoIntento) {
        throw new ErrorPeticionMiteco(
          `Fallaron los ${intentosTotales} intentos contra ${url}: ${describirError(error)}`,
          { cause: error },
        );
      }

      await dormir(esperasReintentoMs[intento - 1]);
    } finally {
      clearTimeout(temporizador);
    }
  }

  // Inalcanzable: el bucle de arriba siempre devuelve o lanza.
  throw new ErrorPeticionMiteco(`No se pudo completar la petición a ${url}`);
}

/**
 * Forma cruda de una estación tal como la declara el MITECO: nombres de
 * campo con espacios, acentos y paréntesis, y todos los valores en texto
 * (incluidos los números, con coma decimal). No se convierte nada aquí —
 * eso es el hito H3 (`scripts/lib/normalizar.ts`).
 *
 * Solo se declaran como obligatorios los campos que de verdad necesitamos:
 * si el ministerio renombra cualquiera de ellos, `safeParse` falla y
 * `pedirJsonMiteco` lo convierte en un `ErrorValidacionMiteco` ruidoso
 * (RNF-41), en vez de dejar pasar `undefined` en silencio.
 *
 * `.passthrough()` conserva cualquier otro campo de combustible que no
 * declaremos (biodiésel, adblue, hidrógeno…) tal cual llega, sin que su
 * presencia o ausencia rompa la validación — el documento de referencia es
 * explícito en que hay muchos más campos fuera de la v1 y no deben tumbar
 * nada.
 */
export const EstacionCrudaEsquema = z
  .object({
    IDEESS: z.string(),
    Rótulo: z.string(),
    Dirección: z.string(),
    Municipio: z.string(),
    Provincia: z.string(),
    Localidad: z.string(),
    'C.P.': z.string(),
    Latitud: z.string(),
    'Longitud (WGS84)': z.string(),
    Margen: z.string(),
    Horario: z.string(),
    'Tipo Venta': z.string(),
    'Precio Gasolina 95 E5': z.string(),
    'Precio Gasoleo A': z.string(),
    'Precio Gasolina 98 E5': z.string(),
    'Precio Gasoleo Premium': z.string(),
  })
  .passthrough();

export type EstacionCruda = z.infer<typeof EstacionCrudaEsquema>;

/** Forma cruda de la respuesta de los endpoints `EstacionesTerrestres*`. */
export const RespuestaEstacionesEsquema = z.object({
  Fecha: z.string(),
  ResultadoConsulta: z.string(),
  ListaEESSPrecio: z.array(EstacionCrudaEsquema),
});

export type RespuestaEstaciones = z.infer<typeof RespuestaEstacionesEsquema>;

/**
 * Descarga las estaciones de una provincia mediante
 * `EstacionesTerrestres/FiltroProvincia/{idProvincia}`.
 *
 * `idProvincia` es el código INE de dos dígitos (`"01"` Álava, `"28"`
 * Madrid, `"08"` Barcelona…), como cadena para conservar el cero inicial.
 *
 * Lanza `ErrorResultadoMiteco` si la respuesta tiene forma válida pero
 * `ResultadoConsulta` no vale `"OK"`. No se reintenta este caso: no es un
 * fallo de red, es la propia API respondiendo que la consulta no fue bien.
 */
export async function obtenerEstacionesPorProvincia(
  idProvincia: string,
  opciones: OpcionesPeticionMiteco = {},
): Promise<RespuestaEstaciones> {
  const ruta = `EstacionesTerrestres/FiltroProvincia/${idProvincia}`;
  const respuesta = await pedirJsonMiteco(ruta, RespuestaEstacionesEsquema, opciones);

  if (respuesta.ResultadoConsulta !== 'OK') {
    throw new ErrorResultadoMiteco(
      `La API del MITECO devolvió ResultadoConsulta="${respuesta.ResultadoConsulta}" ` +
        `para la provincia ${idProvincia} (se esperaba "OK").`,
    );
  }

  return respuesta;
}

/**
 * Forma cruda de un elemento de `Listados/Provincias`. La clave `IDPovincia`
 * está mal escrita (sin la "r") en la propia API — trampa 8 de
 * docs/04-fuente-datos.md. No es un error de transcripción de este fichero:
 * si se escribe bien, la validación no encaja con la respuesta real.
 */
export const ProvinciaCatalogoEsquema = z
  .object({
    IDPovincia: z.string(),
    IDCCAA: z.string(),
    Provincia: z.string(),
    CCAA: z.string(),
  })
  .passthrough();

export type ProvinciaCatalogo = z.infer<typeof ProvinciaCatalogoEsquema>;

export const ComunidadAutonomaEsquema = z
  .object({
    IDCCAA: z.string(),
    CCAA: z.string(),
  })
  .passthrough();

export type ComunidadAutonoma = z.infer<typeof ComunidadAutonomaEsquema>;

/**
 * Catálogo de provincias con su comunidad autónoma, vía `Listados/Provincias`.
 * Es la fuente para agrupar zonas de tipo `ccaa` (ADR-0005): los
 * identificadores de comunidad autónoma nunca se escriben a mano.
 */
export async function obtenerProvincias(
  opciones: OpcionesPeticionMiteco = {},
): Promise<ProvinciaCatalogo[]> {
  return pedirJsonMiteco('Listados/Provincias/', z.array(ProvinciaCatalogoEsquema), opciones);
}

/** Catálogo de comunidades autónomas, vía `Listados/ComunidadesAutonomas`. */
export async function obtenerComunidadesAutonomas(
  opciones: OpcionesPeticionMiteco = {},
): Promise<ComunidadAutonoma[]> {
  return pedirJsonMiteco(
    'Listados/ComunidadesAutonomas/',
    z.array(ComunidadAutonomaEsquema),
    opciones,
  );
}

/**
 * Forma cruda de un elemento de `Listados/Municipios`. `Municipio` llega en
 * caja de título de verdad ("Vitoria-Gasteiz", no "VITORIA-GASTEIZ"), y
 * coincide —comprobado contra datos reales— con el campo `Municipio` que
 * devuelve `EstacionesTerrestres/FiltroProvincia`, una vez recortado el
 * espacio sobrante: alguna entrada del catálogo trae un espacio final que la
 * estación no lleva (docs/06-roadmap.md#H10, segunda mitad).
 */
export const MunicipioCatalogoEsquema = z
  .object({
    IDMunicipio: z.string(),
    IDProvincia: z.string(),
    IDCCAA: z.string(),
    Municipio: z.string(),
    Provincia: z.string(),
    CCAA: z.string(),
  })
  .passthrough();

export type MunicipioCatalogo = z.infer<typeof MunicipioCatalogoEsquema>;

/**
 * Catálogo completo de municipios de España (unos 8.100), vía
 * `Listados/Municipios`. Es la fuente oficial para las páginas por
 * municipio (RF-60): no se inventa ningún nombre ni agrupación (RF-76,
 * ADR-0005), se cruza con las estaciones reales de cada provincia para saber
 * cuántas tiene cada uno.
 */
export async function obtenerMunicipios(
  opciones: OpcionesPeticionMiteco = {},
): Promise<MunicipioCatalogo[]> {
  return pedirJsonMiteco('Listados/Municipios/', z.array(MunicipioCatalogoEsquema), opciones);
}
