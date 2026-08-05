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
 * Carga en paralelo los ficheros de provincia de una zona y los fusiona.
 *
 * Fallo parcial (RF-36): si un fichero falla, el resto se muestra igual y se
 * informa de qué provincia falta. Una zona nunca falla entera por culpa de una
 * sola provincia.
 */
export async function cargarZona(zona: Zona, catalogoProvincias: ResumenProvincia[]): Promise<ResultadoZona> {
  const resultados = await Promise.allSettled(
    zona.provincias.map((id) => obtenerJson<DatosProvincia>(`/data/provincias/${id}.json`))
  );

  const estaciones: EstacionZona[] = [];
  const provinciasFallidas: FalloProvincia[] = [];
  let mock = false;
  let actualizado: string | null = null;

  resultados.forEach((resultado, indice) => {
    const id = zona.provincias[indice];
    const nombreCatalogo = catalogoProvincias.find((p) => p.id === id)?.nombre ?? id;

    if (resultado.status === 'fulfilled') {
      const datos = resultado.value;
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
    } else {
      const motivo = resultado.reason instanceof Error ? resultado.reason.message : 'error desconocido';
      provinciasFallidas.push({ id, nombre: nombreCatalogo, motivo });
    }
  });

  return { estaciones, provinciasFallidas, mock, actualizado };
}
