import { resumirCombustibles } from './agregados.ts';
import type { DatosProvincia, Estacion, ProvinciaNacional, ResumenNacional } from './tipos.ts';

function tieneCoordenadas(estacion: Estacion): boolean {
  return !(estacion.lat === 0 && estacion.lon === 0);
}

function centroide(estaciones: readonly Estacion[]): { lat: number; lon: number } {
  const conCoordenadas = estaciones.filter(tieneCoordenadas);
  if (conCoordenadas.length === 0) return { lat: 0, lon: 0 };
  return {
    lat: conCoordenadas.reduce((suma, estacion) => suma + estacion.lat, 0) / conCoordenadas.length,
    lon: conCoordenadas.reduce((suma, estacion) => suma + estacion.lon, 0) / conCoordenadas.length,
  };
}

/** Construye el artefacto de ADR-0022. El filtro público se aplica antes de
 * agregar y antes de calcular el centroide, para que ambos describan el mismo
 * conjunto utilizable. */
export function calcularResumenNacional(
  datosPorProvincia: readonly DatosProvincia[],
  actualizado: string,
  mock = false,
): ResumenNacional {
  const provincias = datosPorProvincia.map((datos): ProvinciaNacional => {
    const publicas = datos.estaciones.filter((estacion) => estacion.tipoVenta === 'P');
    const resumen = resumirCombustibles(publicas);
    return {
      id: datos.provincia.id,
      nombre: datos.provincia.nombre,
      centro: centroide(publicas),
      combustibles: Object.fromEntries(
        Object.entries(resumen).map(([clave, valor]) => [clave, { media: valor.media, n: valor.n }]),
      ) as ProvinciaNacional['combustibles'],
    };
  });

  return { actualizado, ...(mock ? { mock: true as const } : {}), provincias };
}
