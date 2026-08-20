import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cambioEnPeriodo, serieMedia } from '../../src/logica/evolucion.ts';
import { ETIQUETA } from '../../src/logica/combustibles.ts';
import { mensajeAquiNoHay, mensajeHistoricoInsuficiente, mensajeMuestraInsuficienteRanking } from '../../src/logica/mensajesAusencia.ts';
import { formatearEuros, formatearPrecio, nombreVisible } from '../../src/logica/formato.ts';
import { calcularAgregadosEditoriales, type AgregadoZona, type AgregadosEditoriales, type MediaConN } from './agregados.ts';
import { calcularAgregadosCapitales, type AgregadosCapitales } from './capitales.ts';
import { calcularCostePorNoComparar, LITROS_DEPOSITO_EDITORIAL } from './cuanto-te-juegas.ts';
import { calcularAgregadosMinimos, type AgregadosMinimos } from './minimos.ts';
import { ordenarRanking } from './ranking.ts';
import { rotulosQueVenden, seleccionarRotulos } from './rotulos.ts';
import type { HistoricoProvincia } from './artefactos-historicos.ts';
import type { ClavePrecio, ClavePrecioHistorico, DatosProvincia, Indice, IndiceMunicipios } from './tipos.ts';

export const COMBUSTIBLE_RESUMEN_HOY: ClavePrecioHistorico = 'gasolina95e5';
export const PERIODO_RESUMEN_HOY = 30 as const;

export type SlugResumenHoy =
  | 'provincias-mas-baratas'
  | 'cuanto-te-juegas'
  | 'marcas-mas-baratas'
  | 'capitales-de-provincia'
  | 'la-mas-barata-de-espana'
  | 'canarias-ceuta-melilla'
  | 'evolucion';

export interface ResumenPrecioHoy {
  tipo: 'precio';
  entidad: string;
  combustible: ClavePrecio;
  valor: number;
}

export interface ResumenAhorroHoy {
  tipo: 'ahorro';
  entidad: string;
  combustible: ClavePrecio;
  valor: number;
  litros: typeof LITROS_DEPOSITO_EDITORIAL;
  referencia: 'media provincial';
}

export interface ResumenEvolucionHoy {
  tipo: 'evolucion';
  combustible: ClavePrecio;
  diferenciaMilesimas: number;
  dias: typeof PERIODO_RESUMEN_HOY;
}

export interface ResumenSinDatosHoy {
  tipo: 'sin-datos';
  texto: string;
}

export type ResumenHoy = ResumenPrecioHoy | ResumenAhorroHoy | ResumenEvolucionHoy | ResumenSinDatosHoy;

export interface ResumenesPanelHoy {
  actualizado: string;
  items: Record<SlugResumenHoy, ResumenHoy>;
}

export interface FuentesResumenesHoy {
  agregados: AgregadosEditoriales;
  capitales: AgregadosCapitales;
  minimos: AgregadosMinimos;
  historico?: HistoricoProvincia | null;
}

export function menorMedia<T extends { combustibles: Record<string, MediaConN> }>(
  elementos: readonly T[],
  combustible: ClavePrecio,
  nombre: (elemento: T) => string,
): { valor: number | null; origen: string } {
  const primero = ordenarRanking(
    elementos,
    (elemento) => elemento.combustibles[combustible].media,
    nombre,
  ).find(({ elemento }) => elemento.combustibles[combustible].media !== null)?.elemento;
  return primero
    ? { valor: primero.combustibles[combustible].media, origen: nombre(primero) }
    : { valor: null, origen: 'Sin origen disponible' };
}

export function mayorCoste(
  zonas: readonly AgregadoZona[],
  combustible: ClavePrecio,
): { valor: number | null; origen: string } {
  const primera = ordenarRanking(
    zonas,
    (zona) => calcularCostePorNoComparar(zona.combustibles[combustible]),
    (zona) => zona.nombre,
    'descendente',
  ).find(({ elemento }) => calcularCostePorNoComparar(elemento.combustibles[combustible]) !== null)?.elemento;
  return primera
    ? {
        valor: calcularCostePorNoComparar(primera.combustibles[combustible]),
        origen: nombreVisible(primera.nombre, 'provincia'),
      }
    : { valor: null, origen: 'Sin origen disponible' };
}

function precioOAusencia(
  resultado: { valor: number | null; origen: string },
  fallback: string,
): ResumenPrecioHoy | ResumenSinDatosHoy {
  return resultado.valor === null
    ? { tipo: 'sin-datos', texto: fallback }
    : {
        tipo: 'precio',
        entidad: resultado.origen,
        combustible: COMBUSTIBLE_RESUMEN_HOY,
        valor: resultado.valor,
      };
}

export function calcularResumenesPanelHoy(fuentes: FuentesResumenesHoy): ResumenesPanelHoy {
  const combustible = COMBUSTIBLE_RESUMEN_HOY;
  const provincias = fuentes.agregados.zonas.general.filter((zona) => zona.tipo === 'provincia');
  const fiscales = fuentes.agregados.zonas.canariasCeutaMelilla.filter((zona) => zona.tipo === 'provincia');
  const rotulos = seleccionarRotulos(fuentes.agregados.rotulos.general).incluidos;
  const provincia = menorMedia(provincias, combustible, (zona) => nombreVisible(zona.nombre, 'provincia'));
  const ahorro = mayorCoste(provincias, combustible);
  const rotulo = menorMedia(rotulosQueVenden(rotulos, combustible), combustible, (entrada) => entrada.rotulo);
  const capital = menorMedia(fuentes.capitales.general, combustible, (entrada) => nombreVisible(entrada.nombre, 'municipio'));
  const minimo = fuentes.minimos.nacional[combustible];
  const origenMinimo = minimo.origenes[0];
  const fiscal = menorMedia(fiscales, combustible, (zona) => nombreVisible(zona.nombre, 'provincia'));
  const historico = fuentes.historico ?? null;
  const cambio = historico
    ? cambioEnPeriodo(serieMedia(historico.provincia, historico.fechas, combustible), PERIODO_RESUMEN_HOY)
    : null;

  return {
    actualizado: fuentes.agregados.actualizado,
    items: {
      'provincias-mas-baratas': precioOAusencia(provincia, mensajeAquiNoHay(combustible)),
      'cuanto-te-juegas': ahorro.valor === null
        ? { tipo: 'sin-datos', texto: mensajeAquiNoHay(combustible) }
        : {
            tipo: 'ahorro',
            entidad: ahorro.origen,
            combustible,
            valor: ahorro.valor,
            litros: LITROS_DEPOSITO_EDITORIAL,
            referencia: 'media provincial',
          },
      'marcas-mas-baratas': precioOAusencia(rotulo, mensajeMuestraInsuficienteRanking()),
      'capitales-de-provincia': precioOAusencia(capital, mensajeAquiNoHay(combustible)),
      'la-mas-barata-de-espana': minimo.minimo === null || !origenMinimo
        ? { tipo: 'sin-datos', texto: mensajeAquiNoHay(combustible) }
        : {
            tipo: 'precio',
            entidad: nombreVisible(origenMinimo.municipio, 'municipio'),
            combustible,
            valor: minimo.minimo,
          },
      'canarias-ceuta-melilla': precioOAusencia(fiscal, mensajeAquiNoHay(combustible)),
      evolucion: cambio
        ? {
            tipo: 'evolucion',
            combustible,
            diferenciaMilesimas: cambio.diferenciaMilesimas,
            dias: PERIODO_RESUMEN_HOY,
          }
        : {
            tipo: 'sin-datos',
            texto: historico
              ? mensajeHistoricoInsuficiente(PERIODO_RESUMEN_HOY)
              : 'Elige una provincia · comparación de 30 días',
          },
    },
  };
}

export function formatearResumenHoy(resumen: ResumenHoy): string {
  if (resumen.tipo === 'sin-datos') return resumen.texto;
  if (resumen.tipo === 'precio') {
    return `${resumen.entidad} · ${ETIQUETA[resumen.combustible]} · ${formatearPrecio(resumen.valor)} €/L`;
  }
  if (resumen.tipo === 'ahorro') {
    return `${resumen.entidad} · ${ETIQUETA[resumen.combustible]} · ${formatearEuros(resumen.valor)} menos que la media · ${resumen.litros} L`;
  }
  const signo = resumen.diferenciaMilesimas < 0 ? '−' : resumen.diferenciaMilesimas > 0 ? '+' : '';
  const centimos = (Math.abs(resumen.diferenciaMilesimas) / 10).toLocaleString('es-ES', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${ETIQUETA[resumen.combustible]} · ${signo}${centimos} cts/L · ${resumen.dias} días`;
}

interface FuentesBase extends Omit<FuentesResumenesHoy, 'historico'> {
  indice: Indice;
}

let fuentesBase: Promise<FuentesBase> | null = null;
const historicos = new Map<string, Promise<HistoricoProvincia | null>>();
const resumenes = new Map<string, Promise<ResumenesPanelHoy>>();

async function leerFuentesBase(
  directorioDatos: string,
  rutaMunicipios: string,
): Promise<FuentesBase> {
  const indice = JSON.parse(await readFile(join(directorioDatos, 'indice.json'), 'utf8')) as Indice;
  const indiceMunicipios = JSON.parse(await readFile(rutaMunicipios, 'utf8')) as IndiceMunicipios;
  const datos = await Promise.all(
    indice.provincias.map(async ({ id }) =>
      JSON.parse(await readFile(join(directorioDatos, 'provincias', `${id}.json`), 'utf8')) as DatosProvincia,
    ),
  );
  return {
    indice,
    agregados: calcularAgregadosEditoriales(datos, indice.zonas, indice.actualizado),
    capitales: calcularAgregadosCapitales(datos, indiceMunicipios, indice.actualizado),
    minimos: calcularAgregadosMinimos(datos, indice.zonas, indiceMunicipios, indice.actualizado),
  };
}

export function leerResumenesPanelHoy(
  provinciaId?: string | null,
  directorioDatos = join(process.cwd(), 'public', 'data'),
  rutaMunicipios = join(process.cwd(), 'datos-build', 'municipios.json'),
): Promise<ResumenesPanelHoy> {
  const clave = provinciaId ?? 'sin-provincia';
  const existente = resumenes.get(clave);
  if (existente) return existente;
  const promesa = (async () => {
    fuentesBase ??= leerFuentesBase(directorioDatos, rutaMunicipios);
    const base = await fuentesBase;
    let historico: HistoricoProvincia | null = null;
    if (provinciaId) {
      let lectura = historicos.get(provinciaId);
      if (!lectura) {
        lectura = readFile(join(directorioDatos, 'historico', 'provincias', `${provinciaId}.json`), 'utf8')
          .then((contenido) => JSON.parse(contenido) as HistoricoProvincia)
          .catch(() => null);
        historicos.set(provinciaId, lectura);
      }
      historico = await lectura;
    }
    return calcularResumenesPanelHoy({ ...base, historico });
  })();
  resumenes.set(clave, promesa);
  return promesa;
}
