import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { resumirCombustibles, type ResumenCombustible } from './agregados.ts';
import { generarSlug } from './slug.ts';
import type { ClavePrecio, DatosProvincia, Indice, IndiceMunicipios } from './tipos.ts';

export const CAPITALES = [
  { provinciaId: '01', nombre: 'Vitoria-Gasteiz' },
  { provinciaId: '02', nombre: 'Albacete' },
  { provinciaId: '03', nombre: 'Alicante/Alacant' },
  { provinciaId: '04', nombre: 'Almería' },
  { provinciaId: '05', nombre: 'Ávila' },
  { provinciaId: '06', nombre: 'Badajoz' },
  { provinciaId: '07', nombre: 'Palma de Mallorca' },
  { provinciaId: '08', nombre: 'Barcelona' },
  { provinciaId: '09', nombre: 'Burgos' },
  { provinciaId: '10', nombre: 'Cáceres' },
  { provinciaId: '11', nombre: 'Cádiz' },
  { provinciaId: '12', nombre: 'Castellón de la Plana/Castelló de la Plana' },
  { provinciaId: '13', nombre: 'Ciudad Real' },
  { provinciaId: '14', nombre: 'Córdoba' },
  { provinciaId: '15', nombre: 'Coruña (A)' },
  { provinciaId: '16', nombre: 'Cuenca' },
  { provinciaId: '17', nombre: 'Girona' },
  { provinciaId: '18', nombre: 'Granada' },
  { provinciaId: '19', nombre: 'Guadalajara' },
  { provinciaId: '20', nombre: 'Donostia-San Sebastián' },
  { provinciaId: '21', nombre: 'Huelva' },
  { provinciaId: '22', nombre: 'Huesca' },
  { provinciaId: '23', nombre: 'Jaén' },
  { provinciaId: '24', nombre: 'León' },
  { provinciaId: '25', nombre: 'Lleida' },
  { provinciaId: '26', nombre: 'Logroño' },
  { provinciaId: '27', nombre: 'Lugo' },
  { provinciaId: '28', nombre: 'Madrid' },
  { provinciaId: '29', nombre: 'Málaga' },
  { provinciaId: '30', nombre: 'Murcia' },
  { provinciaId: '31', nombre: 'Pamplona/Iruña' },
  { provinciaId: '32', nombre: 'Ourense' },
  { provinciaId: '33', nombre: 'Oviedo' },
  { provinciaId: '34', nombre: 'Palencia' },
  { provinciaId: '35', nombre: 'Palmas de Gran Canaria (Las)' },
  { provinciaId: '36', nombre: 'Pontevedra' },
  { provinciaId: '37', nombre: 'Salamanca' },
  { provinciaId: '38', nombre: 'Santa Cruz de Tenerife' },
  { provinciaId: '39', nombre: 'Santander' },
  { provinciaId: '40', nombre: 'Segovia' },
  { provinciaId: '41', nombre: 'Sevilla' },
  { provinciaId: '42', nombre: 'Soria' },
  { provinciaId: '43', nombre: 'Tarragona' },
  { provinciaId: '44', nombre: 'Teruel' },
  { provinciaId: '45', nombre: 'Toledo' },
  { provinciaId: '46', nombre: 'Valencia' },
  { provinciaId: '47', nombre: 'Valladolid' },
  { provinciaId: '48', nombre: 'Bilbao' },
  { provinciaId: '49', nombre: 'Zamora' },
  { provinciaId: '50', nombre: 'Zaragoza' },
  { provinciaId: '51', nombre: 'Ceuta' },
  { provinciaId: '52', nombre: 'Melilla' },
] as const;

const PROVINCIAS_AMBITO_FISCAL_APARTE = new Set(['35', '38', '51', '52']);

export interface AgregadoCapital {
  nombre: string;
  provinciaId: string;
  provinciaNombre: string;
  href: string;
  combustibles: Record<ClavePrecio, ResumenCombustible>;
}

export interface AgregadosCapitales {
  actualizado: string;
  general: AgregadoCapital[];
  canariasCeutaMelilla: AgregadoCapital[];
}

export function calcularAgregadosCapitales(
  datosPorProvincia: readonly DatosProvincia[],
  indiceMunicipios: IndiceMunicipios,
  actualizado: string,
): AgregadosCapitales {
  const municipiosCatalogados = new Set(
    indiceMunicipios.municipios.map((municipio) => `${municipio.provinciaId}::${municipio.nombre}`),
  );
  const datosPorId = new Map(datosPorProvincia.map((datos) => [datos.provincia.id, datos]));

  const capitales = CAPITALES.map((capital): AgregadoCapital => {
    if (!municipiosCatalogados.has(`${capital.provinciaId}::${capital.nombre}`)) {
      throw new Error(
        `No se encontró la capital "${capital.nombre}" en el catálogo del ministerio para la provincia ${capital.provinciaId}.`,
      );
    }

    const datos = datosPorId.get(capital.provinciaId);
    if (!datos) {
      throw new Error(`No se encontraron datos para la provincia ${capital.provinciaId} de la capital "${capital.nombre}".`);
    }

    const estaciones = datos.estaciones.filter(
      (estacion) => estacion.tipoVenta === 'P' && estacion.municipio.trim() === capital.nombre,
    );

    return {
      ...capital,
      provinciaNombre: datos.provincia.nombre,
      href: `/${generarSlug(datos.provincia.nombre)}/${generarSlug(capital.nombre)}/`,
      combustibles: resumirCombustibles(estaciones),
    };
  });

  return {
    actualizado,
    general: capitales.filter((capital) => !PROVINCIAS_AMBITO_FISCAL_APARTE.has(capital.provinciaId)),
    canariasCeutaMelilla: capitales.filter((capital) => PROVINCIAS_AMBITO_FISCAL_APARTE.has(capital.provinciaId)),
  };
}

export async function leerAgregadosCapitales(
  directorioDatos = join(process.cwd(), 'public', 'data'),
  rutaMunicipios = join(process.cwd(), 'datos-build', 'municipios.json'),
): Promise<AgregadosCapitales> {
  const indice = JSON.parse(await readFile(join(directorioDatos, 'indice.json'), 'utf8')) as Indice;
  const indiceMunicipios = JSON.parse(await readFile(rutaMunicipios, 'utf8')) as IndiceMunicipios;
  const datosPorProvincia = await Promise.all(
    indice.provincias.map(async ({ id }) =>
      JSON.parse(await readFile(join(directorioDatos, 'provincias', `${id}.json`), 'utf8')) as DatosProvincia,
    ),
  );

  return calcularAgregadosCapitales(datosPorProvincia, indiceMunicipios, indice.actualizado);
}
