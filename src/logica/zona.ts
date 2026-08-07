// Carga en paralelo de los ficheros de provincia que componen una zona, y
// fusión en un solo conjunto de estaciones. Ver ADR-0005: la provincia es la
// unidad de almacenamiento, la zona es la unidad de consulta.
//
// Regla dura 1 de CLAUDE.md: toda petición de red lleva AbortController con
// timeout explícito, para que nada se quede colgado.

import type { DatosProvincia, Estacion, Indice, ResumenProvincia, Zona } from '../../scripts/lib/tipos.ts';

/** Una estación fusionada, con la provincia de origen adjunta: RF-24 exige
 *  poder mostrarla cuando la zona abarca varias. */
export interface EstacionZona extends Estacion {
  provinciaId: string;
  provinciaNombre: string;
}

export interface FalloProvincia {
  id: string;
  nombre: string;
  motivo: string;
}

export interface ResultadoZona {
  estaciones: EstacionZona[];
  provinciasFallidas: FalloProvincia[];
  /** true si alguno de los ficheros cargados venía marcado `mock: true`. */
  mock: boolean;
  /** El más antiguo de los `actualizado` de las provincias cargadas con
   *  éxito (RF-43: si ese dato tiene más de 6 horas, se avisa). `null` si
   *  ninguna provincia cargó. */
  actualizado: string | null;
}

/**
 * Umbral de estaciones a partir del cual una página de zona
 * (src/pages/[zona]/index.astro) deja de llevar el bloque JSON de
 * hidratación embebido, y el cliente vuelve a pedir los JSON de provincia
 * por fetch, como antes de H10.
 *
 * Por debajo del umbral gana el bloque embebido: una sola descarga, sin ida
 * y vuelta de red. Por encima pierde, y no por el tamaño en sí: los ficheros
 * de `public/data/provincias/` los cachea el CDN y se reaprovechan entre
 * páginas que comparten provincia (las 8 páginas de provincia de Andalucía y
 * la página de la comunidad entera piden los mismos 8 ficheros), mientras
 * que el bloque embebido va sin caché y se descarga entero en cada visita.
 * En una zona grande, el fetch sale más barato, no más caro.
 *
 * 300 es el punto, medido con datos reales de agosto de 2026, en el que una
 * comunidad autónoma grande (Andalucía, más de 2.000 estaciones) se acerca al
 * presupuesto de 120 KB comprimidos por página; una sola provincia grande
 * (Madrid, Barcelona) también lo supera y cae al mismo lado.
 */
export const UMBRAL_HIDRATACION_EMBEBIDA = 300;

const TIMEOUT_MS = 8000;

async function obtenerJson<T>(ruta: string): Promise<T> {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);
  try {
    const respuesta = await fetch(ruta, { signal: controlador.signal });
    if (!respuesta.ok) {
      throw new Error(`${ruta}: HTTP ${respuesta.status}`);
    }
    return (await respuesta.json()) as T;
  } finally {
    clearTimeout(temporizador);
  }
}

/** Carga el índice de provincias y zonas. Es el único fichero que se pide
 *  siempre, sea cual sea la zona activa. */
export function cargarIndice(): Promise<Indice> {
  return obtenerJson<Indice>('/data/indice.json');
}

/**
 * Zona de reserva para el caso imposible de que un `zonaId` (guardado en
 * localStorage o fijado por la URL) ya no exista en el índice — los datos se
 * regeneran cada dos horas y una zona puede desaparecer entre medias. No es
 * una elección editorial (ver la corrección de 2026-08-06 en ADR-0005): es
 * la provincia con más estaciones, calculada del propio índice, un recurso
 * técnico para no dejar la aplicación sin nada que mostrar.
 */
export function zonaDeReserva(indice: Indice): Zona {
  if (indice.provincias.length === 0) {
    throw new Error('No hay ninguna zona disponible en el índice.');
  }
  const provinciaConMasEstaciones = indice.provincias.reduce((mayor, actual) =>
    actual.estaciones > mayor.estaciones ? actual : mayor
  );
  const zona = indice.zonas.find((z) => z.id === `p-${provinciaConMasEstaciones.id}`);
  if (!zona) throw new Error('No hay ninguna zona disponible en el índice.');
  return zona;
}

/** Distancia entre dos puntos en km (fórmula de Haversine). Solo hace falta
 *  para encontrar la provincia más cercana a una posición (RF-37); no
 *  justifica traer una librería geoespacial por esto. */
function distanciaKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const radioTierraKm = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const rLat1 = (a.lat * Math.PI) / 180;
  const rLat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radioTierraKm * Math.asin(Math.sqrt(h));
}

/**
 * Provincia más cercana a una posición, por distancia a su centro (media de
 * las coordenadas de sus estaciones — ver `centro` en ResumenProvincia). No
 * es una zona a medida (ADR-0005): es solo la forma de traducir "aquí estoy"
 * a una de las 52 provincias que ya existen, para RF-37 (botón de ubicación).
 */
export function provinciaMasCercana(indice: Indice, posicion: { lat: number; lon: number }): ResumenProvincia {
  if (indice.provincias.length === 0) {
    throw new Error('No hay ninguna provincia disponible en el índice.');
  }
  return indice.provincias.reduce((mas, actual) =>
    distanciaKm(actual.centro, posicion) < distanciaKm(mas.centro, posicion) ? actual : mas
  );
}

/**
 * Fusiona los datos ya obtenidos de varias provincias en un único conjunto de
 * estaciones, con la provincia de origen adjunta a cada una (RF-24). No hace
 * ninguna carga por sí misma: recibe los `DatosProvincia` ya en memoria, sea
 * cual sea su procedencia. La usan tanto `cargarZona` de aquí abajo (fetch, en
 * el navegador) como `src/pages/[zona]/index.astro` (lectura de disco en el
 * build, sin red): las dos vías cargan distinto pero fusionan igual.
 */
export function fusionarProvincias(datosPorProvincia: DatosProvincia[]): {
  estaciones: EstacionZona[];
  mock: boolean;
  actualizado: string | null;
} {
  const estaciones: EstacionZona[] = [];
  let mock = false;
  let actualizado: string | null = null;

  for (const datos of datosPorProvincia) {
    if (datos.mock) mock = true;
    // El dato de la zona es tan fresco como su provincia más antigua.
    if (actualizado === null || new Date(datos.actualizado).getTime() < new Date(actualizado).getTime()) {
      actualizado = datos.actualizado;
    }
    for (const estacion of datos.estaciones) {
      estaciones.push({
        ...estacion,
        provinciaId: datos.provincia.id,
        provinciaNombre: datos.provincia.nombre,
      });
    }
  }

  return { estaciones, mock, actualizado };
}

export interface ResultadoCargaProvincias {
  /** Datos de las provincias que sí han llegado, por id. */
  cargadas: Map<string, DatosProvincia>;
  provinciasFallidas: FalloProvincia[];
}

/**
 * Carga en paralelo los ficheros de una lista de provincias sueltas.
 *
 * Fallo parcial (RF-36): si un fichero falla, el resto se carga igual y se
 * informa de qué provincia falta. La usa `cargarZona` de aquí abajo, y
 * también src/logica/controladorMapaManda.ts (H12, ADR-0014): "el mapa
 * manda" no siempre pide provincias agrupadas en una `Zona` declarada, pide
 * la lista suelta que le dice `calcularVista`, y necesita el resultado por
 * id (no ya fusionado) para poder mantener en memoria las que no han
 * cambiado entre un movimiento del mapa y el siguiente.
 */
export async function cargarProvincias(
  ids: string[],
  catalogoProvincias: ResumenProvincia[],
): Promise<ResultadoCargaProvincias> {
  const resultados = await Promise.allSettled(ids.map((id) => obtenerJson<DatosProvincia>(`/data/provincias/${id}.json`)));

  const provinciasFallidas: FalloProvincia[] = [];
  const cargadas = new Map<string, DatosProvincia>();

  resultados.forEach((resultado, indice) => {
    const id = ids[indice] as string;
    if (resultado.status === 'fulfilled') {
      cargadas.set(id, resultado.value);
    } else {
      const nombreCatalogo = catalogoProvincias.find((p) => p.id === id)?.nombre ?? id;
      const motivo = resultado.reason instanceof Error ? resultado.reason.message : 'error desconocido';
      provinciasFallidas.push({ id, nombre: nombreCatalogo, motivo });
    }
  });

  return { cargadas, provinciasFallidas };
}

/**
 * Carga en paralelo los ficheros de provincia de una zona y los fusiona.
 *
 * Fallo parcial (RF-36): si un fichero falla, el resto se muestra igual y se
 * informa de qué provincia falta. Una zona nunca falla entera por culpa de una
 * sola provincia.
 */
export async function cargarZona(zona: Zona, catalogoProvincias: ResumenProvincia[]): Promise<ResultadoZona> {
  const { cargadas, provinciasFallidas } = await cargarProvincias(zona.provincias, catalogoProvincias);
  const datosCargados = zona.provincias
    .map((id) => cargadas.get(id))
    .filter((datos): datos is DatosProvincia => datos !== undefined);

  const { estaciones, mock, actualizado } = fusionarProvincias(datosCargados);
  return { estaciones, provinciasFallidas, mock, actualizado };
}
