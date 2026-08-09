import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ClavePrecio, DatosProvincia, Estacion, Indice, Zona } from './tipos.ts';

export const CLAVES_PRECIO: readonly ClavePrecio[] = [
  'gasolina95e5',
  'gasoleoA',
  'gasolina98e5',
  'gasoleoPremium',
];

const PROVINCIAS_AMBITO_FISCAL_APARTE = new Set(['35', '38', '51', '52']);

export interface MediaConN {
  media: number | null;
  n: number;
}

export interface ResumenCombustible extends MediaConN {
  minimo: number | null;
}

export interface AgregadoZona {
  id: string;
  nombre: string;
  tipo: Zona['tipo'];
  provincias: string[];
  combustibles: Record<ClavePrecio, ResumenCombustible>;
}

export interface AgregadoRotulo {
  rotulo: string;
  estaciones: number;
  combustibles: Record<ClavePrecio, MediaConN>;
}

export interface PorAmbito<T> {
  general: T[];
  canariasCeutaMelilla: T[];
}

export interface AgregadosEditoriales {
  actualizado: string;
  zonas: PorAmbito<AgregadoZona>;
  rotulos: PorAmbito<AgregadoRotulo>;
}

interface AcumuladorPrecio {
  suma: number;
  minimo: number | null;
  n: number;
}

function acumuladoresVacios(): Record<ClavePrecio, AcumuladorPrecio> {
  return Object.fromEntries(
    CLAVES_PRECIO.map((clave) => [clave, { suma: 0, minimo: null, n: 0 }]),
  ) as Record<ClavePrecio, AcumuladorPrecio>;
}

function acumularEstacion(
  acumuladores: Record<ClavePrecio, AcumuladorPrecio>,
  estacion: Estacion,
): void {
  for (const clave of CLAVES_PRECIO) {
    const precio = estacion.precios[clave];
    if (precio === null) continue;

    const acumulador = acumuladores[clave];
    acumulador.suma += precio;
    acumulador.n += 1;
    if (acumulador.minimo === null || precio < acumulador.minimo) {
      acumulador.minimo = precio;
    }
  }
}

export function resumirCombustibles(estaciones: readonly Estacion[]): Record<ClavePrecio, ResumenCombustible> {
  const acumuladores = acumuladoresVacios();
  for (const estacion of estaciones) acumularEstacion(acumuladores, estacion);

  return Object.fromEntries(
    CLAVES_PRECIO.map((clave) => {
      const { suma, minimo, n } = acumuladores[clave];
      return [clave, { media: n === 0 ? null : suma / n, minimo, n }];
    }),
  ) as Record<ClavePrecio, ResumenCombustible>;
}

function resumirRotulos(estaciones: readonly Estacion[]): AgregadoRotulo[] {
  const porRotulo = new Map<
    string,
    { estaciones: number; combustibles: Record<ClavePrecio, AcumuladorPrecio> }
  >();

  for (const estacion of estaciones) {
    const rotulo = estacion.rotulo.trim();
    const agregado = porRotulo.get(rotulo) ?? {
      estaciones: 0,
      combustibles: acumuladoresVacios(),
    };
    agregado.estaciones += 1;
    acumularEstacion(agregado.combustibles, estacion);
    porRotulo.set(rotulo, agregado);
  }

  return [...porRotulo.entries()].map(([rotulo, agregado]) => ({
    rotulo,
    estaciones: agregado.estaciones,
    combustibles: Object.fromEntries(
      CLAVES_PRECIO.map((clave) => {
        const { suma, n } = agregado.combustibles[clave];
        return [clave, { media: n === 0 ? null : suma / n, n }];
      }),
    ) as Record<ClavePrecio, MediaConN>,
  }));
}

function esAmbitoFiscalAparte(provincias: readonly string[]): boolean {
  return provincias.some((id) => PROVINCIAS_AMBITO_FISCAL_APARTE.has(id));
}

export function calcularAgregadosEditoriales(
  datosPorProvincia: readonly DatosProvincia[],
  zonas: readonly Zona[],
  actualizado: string,
): AgregadosEditoriales {
  const datosPorId = new Map(datosPorProvincia.map((datos) => [datos.provincia.id, datos]));
  const estacionesGenerales = datosPorProvincia
    .filter((datos) => !PROVINCIAS_AMBITO_FISCAL_APARTE.has(datos.provincia.id))
    .flatMap((datos) => datos.estaciones);
  const estacionesAmbitoFiscalAparte = datosPorProvincia
    .filter((datos) => PROVINCIAS_AMBITO_FISCAL_APARTE.has(datos.provincia.id))
    .flatMap((datos) => datos.estaciones);

  const agregadosZona = zonas.map((zona): AgregadoZona => {
    const estaciones = zona.provincias.flatMap((idProvincia) => {
      const datos = datosPorId.get(idProvincia);
      if (!datos) throw new Error(`No se encontraron datos para la provincia ${idProvincia} de ${zona.nombre}`);
      return datos.estaciones;
    });

    return {
      id: zona.id,
      nombre: zona.nombre,
      tipo: zona.tipo,
      provincias: [...zona.provincias],
      combustibles: resumirCombustibles(estaciones),
    };
  });

  return {
    actualizado,
    zonas: {
      general: agregadosZona.filter((zona) => !esAmbitoFiscalAparte(zona.provincias)),
      canariasCeutaMelilla: agregadosZona.filter((zona) => esAmbitoFiscalAparte(zona.provincias)),
    },
    rotulos: {
      general: resumirRotulos(estacionesGenerales),
      canariasCeutaMelilla: resumirRotulos(estacionesAmbitoFiscalAparte),
    },
  };
}

export async function leerAgregadosEditoriales(
  // Astro empaqueta los módulos de prerender en dist/.prerender/chunks antes
  // de ejecutarlos: import.meta.dirname apuntaría allí durante el build.
  // Los comandos del proyecto se ejecutan desde la raíz, así que cwd es el
  // mismo ancla estable que usan las páginas estáticas existentes.
  directorioDatos = join(process.cwd(), 'public', 'data'),
): Promise<AgregadosEditoriales> {
  const indice = JSON.parse(await readFile(join(directorioDatos, 'indice.json'), 'utf8')) as Indice;
  const datosPorProvincia = await Promise.all(
    indice.provincias.map(async ({ id }) =>
      JSON.parse(
        await readFile(join(directorioDatos, 'provincias', `${id}.json`), 'utf8'),
      ) as DatosProvincia,
    ),
  );

  return calcularAgregadosEditoriales(datosPorProvincia, indice.zonas, indice.actualizado);
}
