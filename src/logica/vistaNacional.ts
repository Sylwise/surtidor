import type { ClavePrecio, ProvinciaNacional, ResumenNacional } from '../../scripts/lib/tipos.ts';

export const ZOOM_ENTRADA_NACIONAL = 8;
export const ZOOM_SALIDA_NACIONAL = 8.5;
const TIEMPO_ESPERA_RESUMEN_MS = 8000;
const COMBUSTIBLES: readonly ClavePrecio[] = [
  'gasolina95e5',
  'gasoleoA',
  'gasolina98e5',
  'gasoleoPremium',
  'gasoleoB',
  'glp',
];

/** Posiciones de lectura para provincias cuyo centroide de estaciones cae
 * fuera de tierra. Las Palmas se reparte entre varias islas; su media queda
 * en el mar, así que el cartel nacional se ancla en Gran Canaria. */
const POSICIONES_MARCADOR: Readonly<Record<string, readonly [number, number]>> = {
  '35': [-15.59, 27.96],
};

export type ModoMapa = 'nacional' | 'zona';

/** Histéresis de V2-18: entre ambos umbrales se conserva el modo anterior. */
export function modoMapaParaZoom(zoom: number, anterior: ModoMapa): ModoMapa {
  if (zoom < ZOOM_ENTRADA_NACIONAL) return 'nacional';
  if (zoom >= ZOOM_SALIDA_NACIONAL) return 'zona';
  return anterior;
}

export function compararProvincias(
  a: ProvinciaNacional,
  b: ProvinciaNacional,
  combustible: ClavePrecio,
  idConFoco: string | null,
): number {
  if (a.id === idConFoco) return -1;
  if (b.id === idConFoco) return 1;
  const mediaA = a.combustibles[combustible].media;
  const mediaB = b.combustibles[combustible].media;
  if (mediaA === null && mediaB !== null) return 1;
  if (mediaA !== null && mediaB === null) return -1;
  if (mediaA !== null && mediaB !== null && mediaA !== mediaB) return mediaA - mediaB;
  return a.id.localeCompare(b.id);
}

/** Coordenadas [longitud, latitud] usadas solo para dibujar el cartel. El
 * centroide original se conserva en los datos para los cálculos geográficos. */
export function posicionMarcadorProvincia(provincia: ProvinciaNacional): [number, number] {
  const posicion = POSICIONES_MARCADOR[provincia.id];
  return posicion ? [...posicion] : [provincia.centro.lon, provincia.centro.lat];
}

function esResumenNacional(valor: unknown): valor is ResumenNacional {
  if (!valor || typeof valor !== 'object') return false;
  const resumen = valor as Partial<ResumenNacional>;
  if (typeof resumen.actualizado !== 'string' || !Array.isArray(resumen.provincias)) return false;
  return resumen.provincias.every((provincia) => {
    if (!provincia || typeof provincia !== 'object') return false;
    const candidata = provincia as Partial<ProvinciaNacional>;
    if (
      typeof candidata.id !== 'string' ||
      typeof candidata.nombre !== 'string' ||
      typeof candidata.centro?.lat !== 'number' ||
      typeof candidata.centro.lon !== 'number' ||
      !candidata.combustibles
    ) return false;
    return COMBUSTIBLES.every((clave) => {
      const agregado = candidata.combustibles?.[clave];
      return (
        !!agregado &&
        (agregado.media === null || typeof agregado.media === 'number') &&
        typeof agregado.n === 'number'
      );
    });
  });
}

/** El fallo del resumen es local al mapa: devuelve null y no toca el estado de
 * la aplicación ni impide seguir usando la zona cargada. */
export async function cargarResumenNacional(): Promise<ResumenNacional | null> {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_ESPERA_RESUMEN_MS);
  try {
    const respuesta = await fetch('/data/resumen-nacional.json', { signal: controlador.signal });
    if (!respuesta.ok) return null;
    const datos: unknown = await respuesta.json();
    return esResumenNacional(datos) ? datos : null;
  } catch {
    return null;
  } finally {
    clearTimeout(temporizador);
  }
}
