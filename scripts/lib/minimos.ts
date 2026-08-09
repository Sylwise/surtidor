import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generarSlug } from './slug.ts';
import {
  MINIMO_ESTACIONES_MUNICIPIO,
  type ClavePrecio,
  type DatosProvincia,
  type Estacion,
  type Indice,
  type IndiceMunicipios,
  type Zona,
} from './tipos.ts';
import { CLAVES_PRECIO } from './agregados.ts';

const PROVINCIAS_AMBITO_FISCAL_APARTE = new Set(['35', '38', '51', '52']);

export interface OrigenMinimo {
  municipio: string;
  provinciaId: string;
  provinciaNombre: string;
  href: string;
  destino: 'municipio' | 'provincia';
}

export interface MinimoConOrigen {
  minimo: number | null;
  n: number;
  origenes: OrigenMinimo[];
}

export interface MinimosZona {
  id: string;
  nombre: string;
  combustibles: Record<ClavePrecio, MinimoConOrigen>;
}

export interface AgregadosMinimos {
  actualizado: string;
  nacional: Record<ClavePrecio, MinimoConOrigen>;
  comunidades: MinimosZona[];
  canariasCeutaMelilla: MinimosZona[];
}

interface EstacionConProvincia {
  estacion: Estacion;
  provinciaId: string;
  provinciaNombre: string;
}

function resumirMinimo(
  estaciones: readonly EstacionConProvincia[],
  combustible: ClavePrecio,
  municipiosPorClave: ReadonlyMap<string, number>,
): MinimoConOrigen {
  const conPrecio = estaciones.filter(({ estacion }) => estacion.precios[combustible] !== null);
  if (conPrecio.length === 0) return { minimo: null, n: 0, origenes: [] };

  const minimo = Math.min(
    ...conPrecio.map(({ estacion }) => estacion.precios[combustible] as number),
  );
  const origenesPorClave = new Map<string, OrigenMinimo>();

  for (const { estacion, provinciaId, provinciaNombre } of conPrecio) {
    if (estacion.precios[combustible] !== minimo) continue;
    const municipio = estacion.municipio.trim();
    const clave = `${provinciaId}::${municipio}`;
    const numeroEstaciones = municipiosPorClave.get(clave);
    if (numeroEstaciones === undefined) {
      throw new Error(`No se encontró el municipio "${municipio}" en el catálogo para la provincia ${provinciaId}.`);
    }
    const tienePaginaMunicipal = numeroEstaciones >= MINIMO_ESTACIONES_MUNICIPIO;

    origenesPorClave.set(clave, {
      municipio,
      provinciaId,
      provinciaNombre,
      href: tienePaginaMunicipal
        ? `/${generarSlug(provinciaNombre)}/${generarSlug(municipio)}/`
        : `/${generarSlug(provinciaNombre)}/`,
      destino: tienePaginaMunicipal ? 'municipio' : 'provincia',
    });
  }

  return {
    minimo,
    n: conPrecio.length,
    origenes: [...origenesPorClave.values()].sort((a, b) =>
      a.municipio.localeCompare(b.municipio, 'es'),
    ),
  };
}

function resumirAmbito(
  estaciones: readonly EstacionConProvincia[],
  municipiosPorClave: ReadonlyMap<string, number>,
): Record<ClavePrecio, MinimoConOrigen> {
  return Object.fromEntries(
    CLAVES_PRECIO.map((combustible) => [
      combustible,
      resumirMinimo(estaciones, combustible, municipiosPorClave),
    ]),
  ) as Record<ClavePrecio, MinimoConOrigen>;
}

export function calcularAgregadosMinimos(
  datosPorProvincia: readonly DatosProvincia[],
  zonas: readonly Zona[],
  indiceMunicipios: IndiceMunicipios,
  actualizado: string,
): AgregadosMinimos {
  const datosPorId = new Map(datosPorProvincia.map((datos) => [datos.provincia.id, datos]));
  const municipiosPorClave = new Map(
    indiceMunicipios.municipios.map((municipio) => [
      `${municipio.provinciaId}::${municipio.nombre}`,
      municipio.estaciones,
    ]),
  );

  const estacionesDeProvincias = (ids: readonly string[]): EstacionConProvincia[] =>
    ids.flatMap((id) => {
      const datos = datosPorId.get(id);
      if (!datos) throw new Error(`No se encontraron datos para la provincia ${id}.`);
      return datos.estaciones
        .filter((estacion) => estacion.tipoVenta === 'P')
        .map((estacion) => ({
          estacion,
          provinciaId: id,
          provinciaNombre: datos.provincia.nombre,
        }));
    });

  const comunidades = zonas
    .filter((zona) => zona.tipo === 'ccaa')
    .map((zona): MinimosZona => ({
      id: zona.id,
      nombre: zona.nombre,
      combustibles: resumirAmbito(estacionesDeProvincias(zona.provincias), municipiosPorClave),
    }));
  const esFiscal = (zona: Zona | MinimosZona): boolean => {
    const original = zonas.find(({ id }) => id === zona.id);
    return original?.provincias.some((id) => PROVINCIAS_AMBITO_FISCAL_APARTE.has(id)) ?? false;
  };
  const provinciasGenerales = datosPorProvincia
    .map(({ provincia }) => provincia.id)
    .filter((id) => !PROVINCIAS_AMBITO_FISCAL_APARTE.has(id));

  return {
    actualizado,
    nacional: resumirAmbito(estacionesDeProvincias(provinciasGenerales), municipiosPorClave),
    comunidades: comunidades.filter((zona) => !esFiscal(zona)),
    canariasCeutaMelilla: comunidades.filter(esFiscal),
  };
}

export async function leerAgregadosMinimos(
  directorioDatos = join(process.cwd(), 'public', 'data'),
  rutaMunicipios = join(process.cwd(), 'datos-build', 'municipios.json'),
): Promise<AgregadosMinimos> {
  const indice = JSON.parse(await readFile(join(directorioDatos, 'indice.json'), 'utf8')) as Indice;
  const indiceMunicipios = JSON.parse(await readFile(rutaMunicipios, 'utf8')) as IndiceMunicipios;
  const datosPorProvincia = await Promise.all(
    indice.provincias.map(async ({ id }) =>
      JSON.parse(await readFile(join(directorioDatos, 'provincias', `${id}.json`), 'utf8')) as DatosProvincia,
    ),
  );

  return calcularAgregadosMinimos(
    datosPorProvincia,
    indice.zonas,
    indiceMunicipios,
    indice.actualizado,
  );
}
