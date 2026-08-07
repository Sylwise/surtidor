// Centro y rectángulo envolvente de una provincia, a partir de las
// coordenadas reales de sus estaciones. Ambos descartan (0, 0) — "Null
// Island", en el golfo de Guinea, nunca un punto real de España — con el
// mismo criterio que src/componentes/Mapa.ts usa para no pintar marcadores
// ahí (ver tieneCoordenadas allí).
//
// El rectángulo es la base de ADR-0014 ("el mapa manda"): se calcula una vez
// en el build y se guarda en indice.json, sin depender de ningún límite
// administrativo que el MITECO no da.
//
// También descartan coordenadas fuera de España (con margen amplio para
// Canarias): verificando H12 con datos reales apareció una estación de
// Pontevedra (MITECO, id 16268, "GUAY", Tui) con Latitud/Longitud
// intercambiadas en el origen — lat -8,66, lon 42,04, en el océano Índico.
// Antes de H12 eso ya torcía un poco el centro de la provincia (RF-37); con
// el rectángulo envolvente el efecto deja de ser cosmético: infla el
// rectángulo de una provincia hasta el otro extremo del planeta y "el mapa
// manda" la cargaría al arrastrar por cualquier sitio de España. No se toca
// el normalizador (regla de CLAUDE.md) ni el dato de la estación, que se
// sigue viendo tal cual en la lista y la ficha: solo se excluye de estos dos
// cálculos geométricos, igual que ya se excluye (0, 0).

import type { Rectangulo } from './tipos.ts';

const LIMITES_ESPANA = { minLat: 26, maxLat: 44, minLon: -19, maxLon: 5 };

interface Punto {
  lat: number;
  lon: number;
}

function dentroDeEspana(p: Punto): boolean {
  return (
    p.lat >= LIMITES_ESPANA.minLat &&
    p.lat <= LIMITES_ESPANA.maxLat &&
    p.lon >= LIMITES_ESPANA.minLon &&
    p.lon <= LIMITES_ESPANA.maxLon
  );
}

function conCoordenadas<T extends Punto>(puntos: T[]): T[] {
  return puntos.filter((p) => !(p.lat === 0 && p.lon === 0) && dentroDeEspana(p));
}

/** Media de las coordenadas, o `{ lat: 0, lon: 0 }` si ninguna estación
 *  tiene coordenadas válidas. */
export function calcularCentro(puntos: Punto[]): { lat: number; lon: number } {
  const validos = conCoordenadas(puntos);
  if (validos.length === 0) return { lat: 0, lon: 0 };
  const lat = validos.reduce((suma, p) => suma + p.lat, 0) / validos.length;
  const lon = validos.reduce((suma, p) => suma + p.lon, 0) / validos.length;
  return { lat, lon };
}

/** Rectángulo envolvente de las coordenadas, o `null` si ninguna estación
 *  tiene coordenadas válidas (provincia sin ninguna estación geolocalizada,
 *  caso imposible en la práctica pero no descartable en tipos). */
export function calcularRectangulo(puntos: Punto[]): Rectangulo | null {
  const validos = conCoordenadas(puntos);
  if (validos.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const p of validos) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLon = Math.min(minLon, p.lon);
    maxLon = Math.max(maxLon, p.lon);
  }
  return { minLat, maxLat, minLon, maxLon };
}
