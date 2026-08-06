// H5 · Datos falsos para desarrollar sin salida a internet (ver CLAUDE.md,
// sección "Comandos"). Misma forma que los datos reales, marcados `mock:
// true` para que la interfaz lo enseñe. No llama a ningún servicio: el
// catálogo de provincias y comunidades autónomas está embebido a mano abajo,
// capturado una vez de `Listados/Provincias` y `Listados/ComunidadesAutonomas`
// (docs/04-fuente-datos.md), precisamente para no depender de red.

import { join } from 'node:path';
import { escribirJsonAtomico } from './lib/escritura.ts';
import type { ClavePrecio, DatosProvincia, Estacion, Indice, Precios, ResumenProvincia, Zona } from './lib/tipos.ts';

interface ProvinciaEstatica {
  id: string;
  nombre: string;
  idCcaa: string;
  ccaa: string;
  /** Centroide aproximado, solo para dispersar estaciones de mentira. */
  lat: number;
  lon: number;
}

const DIRECTORIO_DATOS = join(import.meta.dirname, '..', 'public', 'data');

const CLAVES_PRECIO: ClavePrecio[] = ['gasolina95e5', 'gasoleoA', 'gasolina98e5', 'gasoleoPremium'];

// prettier-ignore
const PROVINCIAS: ProvinciaEstatica[] = [
  { id: '02', nombre: 'ALBACETE', idCcaa: '07', ccaa: 'Castilla la Mancha', lat: 38.9943, lon: -1.8585 },
  { id: '03', nombre: 'ALICANTE', idCcaa: '10', ccaa: 'Comunidad Valenciana', lat: 38.3452, lon: -0.4810 },
  { id: '04', nombre: 'ALMERÍA', idCcaa: '01', ccaa: 'Andalucia', lat: 36.8381, lon: -2.4597 },
  { id: '01', nombre: 'ARABA/ÁLAVA', idCcaa: '16', ccaa: 'País Vasco', lat: 42.8500, lon: -2.6700 },
  { id: '33', nombre: 'ASTURIAS', idCcaa: '03', ccaa: 'Asturias', lat: 43.3603, lon: -5.8448 },
  { id: '05', nombre: 'ÁVILA', idCcaa: '08', ccaa: 'Castilla y León', lat: 40.6566, lon: -4.6818 },
  { id: '06', nombre: 'BADAJOZ', idCcaa: '11', ccaa: 'Extremadura', lat: 38.8794, lon: -6.9707 },
  { id: '07', nombre: 'BALEARS (ILLES)', idCcaa: '04', ccaa: 'Baleares', lat: 39.5696, lon: 2.6502 },
  { id: '08', nombre: 'BARCELONA', idCcaa: '09', ccaa: 'Cataluña', lat: 41.3851, lon: 2.1734 },
  { id: '48', nombre: 'BIZKAIA', idCcaa: '16', ccaa: 'País Vasco', lat: 43.2630, lon: -2.9350 },
  { id: '09', nombre: 'BURGOS', idCcaa: '08', ccaa: 'Castilla y León', lat: 42.3439, lon: -3.6969 },
  { id: '10', nombre: 'CÁCERES', idCcaa: '11', ccaa: 'Extremadura', lat: 39.4753, lon: -6.3724 },
  { id: '11', nombre: 'CÁDIZ', idCcaa: '01', ccaa: 'Andalucia', lat: 36.5271, lon: -6.2886 },
  { id: '39', nombre: 'CANTABRIA', idCcaa: '06', ccaa: 'Cantabria', lat: 43.4623, lon: -3.8099 },
  { id: '12', nombre: 'CASTELLÓN / CASTELLÓ', idCcaa: '10', ccaa: 'Comunidad Valenciana', lat: 39.9864, lon: -0.0513 },
  { id: '51', nombre: 'CEUTA', idCcaa: '18', ccaa: 'Ceuta', lat: 35.8894, lon: -5.3213 },
  { id: '13', nombre: 'CIUDAD REAL', idCcaa: '07', ccaa: 'Castilla la Mancha', lat: 38.9848, lon: -3.9274 },
  { id: '14', nombre: 'CÓRDOBA', idCcaa: '01', ccaa: 'Andalucia', lat: 37.8882, lon: -4.7794 },
  { id: '15', nombre: 'CORUÑA (A)', idCcaa: '12', ccaa: 'Galicia', lat: 43.3623, lon: -8.4115 },
  { id: '16', nombre: 'CUENCA', idCcaa: '07', ccaa: 'Castilla la Mancha', lat: 40.0704, lon: -2.1374 },
  { id: '20', nombre: 'GIPUZKOA', idCcaa: '16', ccaa: 'País Vasco', lat: 43.3183, lon: -1.9812 },
  { id: '17', nombre: 'GIRONA', idCcaa: '09', ccaa: 'Cataluña', lat: 41.9794, lon: 2.8214 },
  { id: '18', nombre: 'GRANADA', idCcaa: '01', ccaa: 'Andalucia', lat: 37.1773, lon: -3.5986 },
  { id: '19', nombre: 'GUADALAJARA', idCcaa: '07', ccaa: 'Castilla la Mancha', lat: 40.6333, lon: -3.1669 },
  { id: '21', nombre: 'HUELVA', idCcaa: '01', ccaa: 'Andalucia', lat: 37.2614, lon: -6.9447 },
  { id: '22', nombre: 'HUESCA', idCcaa: '02', ccaa: 'Aragón', lat: 42.1401, lon: -0.4089 },
  { id: '23', nombre: 'JAÉN', idCcaa: '01', ccaa: 'Andalucia', lat: 37.7796, lon: -3.7849 },
  { id: '24', nombre: 'LEÓN', idCcaa: '08', ccaa: 'Castilla y León', lat: 42.5987, lon: -5.5671 },
  { id: '25', nombre: 'LLEIDA', idCcaa: '09', ccaa: 'Cataluña', lat: 41.6176, lon: 0.6200 },
  { id: '27', nombre: 'LUGO', idCcaa: '12', ccaa: 'Galicia', lat: 43.0121, lon: -7.5559 },
  { id: '28', nombre: 'MADRID', idCcaa: '13', ccaa: 'Madrid', lat: 40.4168, lon: -3.7038 },
  { id: '29', nombre: 'MÁLAGA', idCcaa: '01', ccaa: 'Andalucia', lat: 36.7213, lon: -4.4214 },
  { id: '52', nombre: 'MELILLA', idCcaa: '19', ccaa: 'Melilla', lat: 35.2923, lon: -2.9381 },
  { id: '30', nombre: 'MURCIA', idCcaa: '14', ccaa: 'Murcia', lat: 37.9922, lon: -1.1307 },
  { id: '31', nombre: 'NAVARRA', idCcaa: '15', ccaa: 'Navarra', lat: 42.8167, lon: -1.6432 },
  { id: '32', nombre: 'OURENSE', idCcaa: '12', ccaa: 'Galicia', lat: 42.3399, lon: -7.8639 },
  { id: '34', nombre: 'PALENCIA', idCcaa: '08', ccaa: 'Castilla y León', lat: 42.0096, lon: -4.5288 },
  { id: '35', nombre: 'PALMAS (LAS)', idCcaa: '05', ccaa: 'Canarias', lat: 28.1235, lon: -15.4363 },
  { id: '36', nombre: 'PONTEVEDRA', idCcaa: '12', ccaa: 'Galicia', lat: 42.4310, lon: -8.6444 },
  { id: '26', nombre: 'RIOJA (LA)', idCcaa: '17', ccaa: 'Rioja (La)', lat: 42.4627, lon: -2.4449 },
  { id: '37', nombre: 'SALAMANCA', idCcaa: '08', ccaa: 'Castilla y León', lat: 40.9701, lon: -5.6635 },
  { id: '38', nombre: 'SANTA CRUZ DE TENERIFE', idCcaa: '05', ccaa: 'Canarias', lat: 28.4636, lon: -16.2518 },
  { id: '40', nombre: 'SEGOVIA', idCcaa: '08', ccaa: 'Castilla y León', lat: 40.9429, lon: -4.1088 },
  { id: '41', nombre: 'SEVILLA', idCcaa: '01', ccaa: 'Andalucia', lat: 37.3891, lon: -5.9845 },
  { id: '42', nombre: 'SORIA', idCcaa: '08', ccaa: 'Castilla y León', lat: 41.7636, lon: -2.4649 },
  { id: '43', nombre: 'TARRAGONA', idCcaa: '09', ccaa: 'Cataluña', lat: 41.1189, lon: 1.2445 },
  { id: '44', nombre: 'TERUEL', idCcaa: '02', ccaa: 'Aragón', lat: 40.3456, lon: -1.1065 },
  { id: '45', nombre: 'TOLEDO', idCcaa: '07', ccaa: 'Castilla la Mancha', lat: 39.8628, lon: -4.0273 },
  { id: '46', nombre: 'VALENCIA / VALÈNCIA', idCcaa: '10', ccaa: 'Comunidad Valenciana', lat: 39.4699, lon: -0.3763 },
  { id: '47', nombre: 'VALLADOLID', idCcaa: '08', ccaa: 'Castilla y León', lat: 41.6523, lon: -4.7245 },
  { id: '49', nombre: 'ZAMORA', idCcaa: '08', ccaa: 'Castilla y León', lat: 41.5033, lon: -5.7446 },
  { id: '50', nombre: 'ZARAGOZA', idCcaa: '02', ccaa: 'Aragón', lat: 41.6488, lon: -0.8891 },
];

const NOMBRE_CCAA: Record<string, string> = {
  '01': 'Andalucia', '02': 'Aragón', '03': 'Asturias', '04': 'Baleares',
  '05': 'Canarias', '06': 'Cantabria', '07': 'Castilla la Mancha',
  '08': 'Castilla y León', '09': 'Cataluña', '10': 'Comunidad Valenciana',
  '11': 'Extremadura', '12': 'Galicia', '13': 'Madrid', '14': 'Murcia',
  '15': 'Navarra', '16': 'País Vasco', '17': 'Rioja (La)', '18': 'Ceuta',
  '19': 'Melilla',
};

const ROTULOS = ['REPSOL', 'CEPSA', 'BP', 'SHELL', 'GALP', 'BALLENOIL', 'PLENOIL', 'PETRONOR'];
const HORARIOS = ['L-D: 24H', 'L-V: 06:00-22:00; S: 08:00-14:00', 'L-S: 07:00-22:00', ''];

let semilla = 42;
/** Generador determinista, para que `data:mock` dé siempre el mismo resultado. */
function aleatorio(): number {
  semilla = (semilla * 1103515245 + 12345) & 0x7fffffff;
  return semilla / 0x7fffffff;
}

function elegir<T>(lista: T[]): T {
  return lista[Math.floor(aleatorio() * lista.length)] as T;
}

function precioAleatorio(base: number): number {
  return Math.round((base + (aleatorio() - 0.5) * 0.2) * 1000) / 1000;
}

function precioOAusente(base: number, probabilidadAusente: number): number | null {
  return aleatorio() < probabilidadAusente ? null : precioAleatorio(base);
}

function generarEstaciones(provincia: ProvinciaEstatica): Estacion[] {
  // Canarias parte de precios más bajos, régimen fiscal distinto (ADR-0003).
  const base = provincia.idCcaa === '05' ? 1.28 : 1.45;
  const numero = 3 + Math.floor(aleatorio() * 6); // entre 3 y 8 estaciones

  return Array.from({ length: numero }, (_, i) => {
    const precios: Precios = {
      gasolina95e5: precioOAusente(base, 0.02),
      gasoleoA: precioOAusente(base + 0.06, 0.02),
      gasolina98e5: precioOAusente(base + 0.15, 0.35),
      gasoleoPremium: precioOAusente(base + 0.2, 0.5),
    };
    return {
      id: `mock-${provincia.id}-${i}`,
      rotulo: elegir(ROTULOS),
      direccion: `Calle de prueba ${i + 1}`,
      municipio: provincia.nombre,
      cp: `${provincia.id}000`,
      lat: provincia.lat + (aleatorio() - 0.5) * 0.3,
      lon: provincia.lon + (aleatorio() - 0.5) * 0.3,
      horario: elegir(HORARIOS),
      tipoVenta: aleatorio() < 0.1 ? 'R' : 'P',
      margen: elegir<'D' | 'I' | 'N' | null>(['D', 'I', 'N', null]),
      precios,
    };
  });
}

function calcularMinimos(estaciones: Estacion[]): Partial<Record<ClavePrecio, number>> {
  const minimos: Partial<Record<ClavePrecio, number>> = {};
  for (const clave of CLAVES_PRECIO) {
    const precios = estaciones.map((e) => e.precios[clave]).filter((p): p is number => p !== null);
    if (precios.length > 0) minimos[clave] = Math.min(...precios);
  }
  return minimos;
}

async function main(): Promise<void> {
  const actualizado = new Date().toISOString();

  const datosPorProvincia: DatosProvincia[] = PROVINCIAS.map((provincia) => ({
    provincia: { id: provincia.id, nombre: provincia.nombre },
    actualizado,
    fechaMiteco: new Date().toLocaleString('es-ES'),
    mock: true,
    estaciones: generarEstaciones(provincia),
  }));

  const resumenProvincias: ResumenProvincia[] = datosPorProvincia.map((datos, i) => ({
    id: datos.provincia.id,
    nombre: datos.provincia.nombre,
    estaciones: datos.estaciones.length,
    minimos: calcularMinimos(datos.estaciones),
  }));

  const zonasProvincia: Zona[] = datosPorProvincia.map((datos) => ({
    id: `p-${datos.provincia.id}`,
    nombre: datos.provincia.nombre,
    tipo: 'provincia' as const,
    provincias: [datos.provincia.id],
  }));

  const provinciasPorCcaa = new Map<string, string[]>();
  for (const provincia of PROVINCIAS) {
    const lista = provinciasPorCcaa.get(provincia.idCcaa) ?? [];
    lista.push(provincia.id);
    provinciasPorCcaa.set(provincia.idCcaa, lista);
  }
  const zonasCcaa: Zona[] = Array.from(provinciasPorCcaa.entries()).map(([idCcaa, provincias]) => ({
    id: `ccaa-${idCcaa}`,
    nombre: NOMBRE_CCAA[idCcaa] ?? `CCAA ${idCcaa}`,
    tipo: 'ccaa' as const,
    provincias: provincias.sort(),
  }));

  const indice: Indice = {
    actualizado,
    mock: true,
    provincias: resumenProvincias,
    zonas: [...zonasProvincia, ...zonasCcaa],
  };

  await Promise.all(
    datosPorProvincia.map((datos) =>
      escribirJsonAtomico(join(DIRECTORIO_DATOS, 'provincias', `${datos.provincia.id}.json`), datos),
    ),
  );
  await escribirJsonAtomico(join(DIRECTORIO_DATOS, 'indice.json'), indice);

  console.log(`Datos de prueba generados: ${datosPorProvincia.length} provincias.`);
}

main().catch((error: unknown) => {
  console.error('La generación de datos de prueba ha fallado.');
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
