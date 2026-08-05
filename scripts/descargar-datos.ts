// H5 · Generación de datos. Recorre las provincias del MITECO, normaliza y
// escribe public/data/provincias/NN.json más public/data/indice.json.
//
// Regla dura (RF-05, docs/02-requisitos.md): si algo falla, no se escribe
// nada. Todo el trabajo se acumula en memoria y los ficheros solo se escriben
// al final, cuando las 52 provincias se han descargado y normalizado sin
// error. Así el despliegue anterior se mantiene intacto ante cualquier fallo.

import { join } from 'node:path';
import {
  obtenerEstacionesPorProvincia,
  obtenerProvincias,
  obtenerComunidadesAutonomas,
  type ProvinciaCatalogo,
} from './lib/miteco.ts';
import { normalizarEstaciones, type EstacionCruda } from './lib/normalizar.ts';
import { escribirJsonAtomico } from './lib/escritura.ts';
import { ZONAS_A_MEDIDA } from './zonas-a-medida.ts';
import type { ClavePrecio, DatosProvincia, Indice, ResumenProvincia, Zona } from './lib/tipos.ts';

const CLAVES_PRECIO: ClavePrecio[] = ['gasolina95e5', 'gasoleoA', 'gasolina98e5', 'gasoleoPremium'];

const DIRECTORIO_DATOS = join(import.meta.dirname, '..', 'public', 'data');

/** Ejecuta `tarea` sobre `items` con un máximo de `limite` en vuelo a la vez. */
async function mapConLimite<T, R>(
  items: T[],
  limite: number,
  tarea: (item: T, indice: number) => Promise<R>,
): Promise<R[]> {
  const resultados: R[] = new Array(items.length);
  let siguiente = 0;

  async function trabajador(): Promise<void> {
    while (true) {
      const indice = siguiente++;
      if (indice >= items.length) return;
      resultados[indice] = await tarea(items[indice] as T, indice);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, trabajador));
  return resultados;
}

function calcularMinimos(datos: DatosProvincia): Partial<Record<ClavePrecio, number>> {
  const minimos: Partial<Record<ClavePrecio, number>> = {};
  for (const clave of CLAVES_PRECIO) {
    let minimo: number | null = null;
    for (const estacion of datos.estaciones) {
      const precio = estacion.precios[clave];
      if (precio === null) continue;
      if (minimo === null || precio < minimo) minimo = precio;
    }
    if (minimo !== null) minimos[clave] = minimo;
  }
  return minimos;
}

function construirZonasCcaa(
  provinciasCatalogo: ProvinciaCatalogo[],
  ccaaCatalogo: { IDCCAA: string; CCAA: string }[],
): Zona[] {
  const nombrePorIdCcaa = new Map(ccaaCatalogo.map((c) => [c.IDCCAA, c.CCAA]));
  const provinciasPorCcaa = new Map<string, string[]>();

  for (const provincia of provinciasCatalogo) {
    const lista = provinciasPorCcaa.get(provincia.IDCCAA) ?? [];
    lista.push(provincia.IDPovincia);
    provinciasPorCcaa.set(provincia.IDCCAA, lista);
  }

  return Array.from(provinciasPorCcaa.entries()).map(([idCcaa, provincias]) => ({
    id: `ccaa-${idCcaa}`,
    nombre: nombrePorIdCcaa.get(idCcaa) ?? `CCAA ${idCcaa}`,
    tipo: 'ccaa' as const,
    provincias: provincias.sort(),
  }));
}

async function main(): Promise<void> {
  const actualizado = new Date().toISOString();

  console.log('Descargando catálogo de provincias y comunidades autónomas…');
  const [provinciasCatalogo, ccaaCatalogo] = await Promise.all([
    obtenerProvincias(),
    obtenerComunidadesAutonomas(),
  ]);
  console.log(`  ${provinciasCatalogo.length} provincias, ${ccaaCatalogo.length} comunidades autónomas.`);

  let totalEstaciones = 0;
  let totalDescartadas = 0;

  console.log('Descargando estaciones por provincia (hasta 5 en paralelo)…');
  const datosPorProvincia = await mapConLimite(provinciasCatalogo, 5, async (provincia) => {
    const respuesta = await obtenerEstacionesPorProvincia(provincia.IDPovincia);
    // El esquema zod de miteco.ts usa .passthrough(), así que TypeScript tipa
    // los campos no declarados como `unknown`; normalizar.ts espera el tipo
    // más simple `Record<string, string | undefined>` con el que se escribió
    // (hito H3, en paralelo con H2). En tiempo de ejecución son cadenas de
    // verdad: zod ya validó los campos que sí usamos.
    const estacionesCrudas = respuesta.ListaEESSPrecio as unknown as EstacionCruda[];
    const { estaciones, descartadas } = normalizarEstaciones(estacionesCrudas);

    totalEstaciones += estaciones.length;
    totalDescartadas += descartadas;

    console.log(
      `  ${provincia.IDPovincia} ${provincia.Provincia}: ${estaciones.length} estaciones` +
        (descartadas > 0 ? ` (${descartadas} descartadas sin coordenadas)` : ''),
    );

    const datos: DatosProvincia = {
      provincia: { id: provincia.IDPovincia, nombre: provincia.Provincia },
      actualizado,
      fechaMiteco: respuesta.Fecha,
      estaciones,
    };
    return datos;
  });

  // Todo ha ido bien: a partir de aquí se escribe. Ni una escritura antes.
  const resumenProvincias: ResumenProvincia[] = datosPorProvincia.map((datos) => ({
    id: datos.provincia.id,
    nombre: datos.provincia.nombre,
    estaciones: datos.estaciones.length,
    minimos: calcularMinimos(datos),
  }));

  const zonasProvincia: Zona[] = datosPorProvincia.map((datos) => ({
    id: `p-${datos.provincia.id}`,
    nombre: datos.provincia.nombre,
    tipo: 'provincia' as const,
    provincias: [datos.provincia.id],
  }));

  const zonasCcaa = construirZonasCcaa(provinciasCatalogo, ccaaCatalogo);

  const indice: Indice = {
    actualizado,
    provincias: resumenProvincias,
    zonas: [...zonasProvincia, ...zonasCcaa, ...ZONAS_A_MEDIDA],
  };

  console.log('Escribiendo ficheros…');
  await Promise.all(
    datosPorProvincia.map((datos) =>
      escribirJsonAtomico(join(DIRECTORIO_DATOS, 'provincias', `${datos.provincia.id}.json`), datos),
    ),
  );
  await escribirJsonAtomico(join(DIRECTORIO_DATOS, 'indice.json'), indice);

  console.log(
    `Hecho: ${datosPorProvincia.length} provincias, ${totalEstaciones} estaciones` +
      (totalDescartadas > 0 ? `, ${totalDescartadas} descartadas en total` : '') +
      '.',
  );
}

main().catch((error: unknown) => {
  console.error('La generación de datos ha fallado. No se ha escrito ni modificado ningún fichero.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
