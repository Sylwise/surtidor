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
  obtenerMunicipios,
  type ProvinciaCatalogo,
} from './lib/miteco.ts';
import { normalizarEstaciones, type EstacionCruda } from './lib/normalizar.ts';
import { escribirJsonAtomico } from './lib/escritura.ts';
import { construirMunicipios } from './lib/municipios.ts';
import { comprobarSlugsUnicos } from './lib/slug.ts';
import { MINIMO_ESTACIONES_MUNICIPIO, type ClavePrecio, type DatosProvincia, type Indice, type IndiceMunicipios, type ResumenProvincia, type Zona } from './lib/tipos.ts';

const CLAVES_PRECIO: ClavePrecio[] = ['gasolina95e5', 'gasoleoA', 'gasolina98e5', 'gasoleoPremium'];

const DIRECTORIO_PUBLIC = join(import.meta.dirname, '..', 'public');
const DIRECTORIO_DATOS = join(DIRECTORIO_PUBLIC, 'data');
// Deliberadamente fuera de public/: nada de aquí se despliega ni lo pide
// nunca el navegador, solo lo lee el propio build (getStaticPaths de las
// páginas de municipio y sitemap.xml.ts). Ver el comentario de
// IndiceMunicipios en scripts/lib/tipos.ts.
const DIRECTORIO_BUILD = join(import.meta.dirname, '..', 'datos-build');

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

/** Centro de la provincia (RF-37): media de las coordenadas de sus
 *  estaciones, descartando (0, 0) — "Null Island", nunca un punto real de
 *  España — con el mismo criterio que Mapa.ts usa para no pintar marcadores
 *  ahí. No es un límite administrativo, solo una forma de encontrar la
 *  provincia más cercana a una posición. */
function calcularCentro(datos: DatosProvincia): { lat: number; lon: number } {
  const conCoordenadas = datos.estaciones.filter((e) => !(e.lat === 0 && e.lon === 0));
  if (conCoordenadas.length === 0) return { lat: 0, lon: 0 };
  const lat = conCoordenadas.reduce((suma, e) => suma + e.lat, 0) / conCoordenadas.length;
  const lon = conCoordenadas.reduce((suma, e) => suma + e.lon, 0) / conCoordenadas.length;
  return { lat, lon };
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

  console.log('Descargando catálogo de provincias, comunidades autónomas y municipios…');
  const [provinciasCatalogo, ccaaCatalogo, municipiosCatalogo] = await Promise.all([
    obtenerProvincias(),
    obtenerComunidadesAutonomas(),
    obtenerMunicipios(),
  ]);
  console.log(
    `  ${provinciasCatalogo.length} provincias, ${ccaaCatalogo.length} comunidades autónomas, ` +
      `${municipiosCatalogo.length} municipios.`,
  );

  let totalEstaciones = 0;
  let totalSinCoordenadas = 0;
  let totalFueraDeEspana = 0;
  let totalTipoVentaInesperados = 0;
  let totalMargenInesperados = 0;

  console.log('Descargando estaciones por provincia (hasta 5 en paralelo)…');
  const datosPorProvincia = await mapConLimite(provinciasCatalogo, 5, async (provincia) => {
    const respuesta = await obtenerEstacionesPorProvincia(provincia.IDPovincia);
    // El esquema zod de miteco.ts usa .passthrough(), así que TypeScript tipa
    // los campos no declarados como `unknown`; normalizar.ts espera el tipo
    // más simple `Record<string, string | undefined>` con el que se escribió
    // (hito H3, en paralelo con H2). En tiempo de ejecución son cadenas de
    // verdad: zod ya validó los campos que sí usamos.
    const estacionesCrudas = respuesta.ListaEESSPrecio as unknown as EstacionCruda[];
    const { estaciones, sinCoordenadas, fueraDeEspana, tipoVentaInesperados, margenInesperados } =
      normalizarEstaciones(estacionesCrudas);

    totalEstaciones += estaciones.length;
    totalSinCoordenadas += sinCoordenadas;
    totalFueraDeEspana += fueraDeEspana;
    totalTipoVentaInesperados += tipoVentaInesperados;
    totalMargenInesperados += margenInesperados;

    const avisos = [
      sinCoordenadas > 0 ? `${sinCoordenadas} sin coordenadas utilizables` : null,
      fueraDeEspana > 0 ? `${fueraDeEspana} con coordenadas fuera de España` : null,
      tipoVentaInesperados > 0 ? `${tipoVentaInesperados} con Tipo Venta inesperado` : null,
      margenInesperados > 0 ? `${margenInesperados} con Margen inesperado` : null,
    ].filter((aviso): aviso is string => aviso !== null);

    console.log(
      `  ${provincia.IDPovincia} ${provincia.Provincia}: ${estaciones.length} estaciones` +
        (avisos.length > 0 ? ` (${avisos.join(', ')})` : ''),
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
    centro: calcularCentro(datos),
  }));

  const zonasProvincia: Zona[] = datosPorProvincia.map((datos) => ({
    id: `p-${datos.provincia.id}`,
    nombre: datos.provincia.nombre,
    tipo: 'provincia' as const,
    provincias: [datos.provincia.id],
  }));

  const zonasCcaa = construirZonasCcaa(provinciasCatalogo, ccaaCatalogo);

  const { municipios, sinCatalogar } = construirMunicipios(datosPorProvincia, municipiosCatalogo);
  if (sinCatalogar > 0) {
    console.log(
      `  Aviso: ${sinCatalogar} estaciones con un municipio que no aparece en Listados/Municipios ` +
        'para su provincia (se cuentan igual, con el nombre tal como lo declara la estación).',
    );
  }

  // Guarda contra colisión de URL (docs/06-roadmap.md#H10): dos provincias o
  // dos municipios de la misma provincia que generasen el mismo slug se
  // pisarían la página. Antes de escribir nada, no después.
  comprobarSlugsUnicos(resumenProvincias, (p) => p.nombre, () => 'global', 'Provincias');
  comprobarSlugsUnicos(municipios, (m) => m.nombre, (m) => m.provinciaId, 'Municipios');

  const indice: Indice = {
    actualizado,
    provincias: resumenProvincias,
    zonas: [...zonasProvincia, ...zonasCcaa],
  };
  const indiceMunicipios: IndiceMunicipios = { actualizado, municipios };

  console.log('Escribiendo ficheros…');
  await Promise.all(
    datosPorProvincia.map((datos) =>
      escribirJsonAtomico(join(DIRECTORIO_DATOS, 'provincias', `${datos.provincia.id}.json`), datos),
    ),
  );
  await escribirJsonAtomico(join(DIRECTORIO_DATOS, 'indice.json'), indice);
  await escribirJsonAtomico(join(DIRECTORIO_BUILD, 'municipios.json'), indiceMunicipios);

  const avisosFinales = [
    totalSinCoordenadas > 0 ? `${totalSinCoordenadas} sin coordenadas utilizables en total` : null,
    totalFueraDeEspana > 0 ? `${totalFueraDeEspana} con coordenadas fuera de España en total` : null,
    totalTipoVentaInesperados > 0 ? `${totalTipoVentaInesperados} con Tipo Venta inesperado` : null,
    totalMargenInesperados > 0 ? `${totalMargenInesperados} con Margen inesperado` : null,
  ].filter((aviso): aviso is string => aviso !== null);

  const municipiosConPagina = municipios.filter((m) => m.estaciones >= MINIMO_ESTACIONES_MUNICIPIO).length;
  console.log(
    `Hecho: ${datosPorProvincia.length} provincias, ${totalEstaciones} estaciones, ` +
      `${municipios.length} municipios con estaciones (${municipiosConPagina} con página propia)` +
      (avisosFinales.length > 0 ? `, ${avisosFinales.join(', ')}` : '') +
      '.',
  );
}

main().catch((error: unknown) => {
  console.error('La generación de datos ha fallado. No se ha escrito ni modificado ningún fichero.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
