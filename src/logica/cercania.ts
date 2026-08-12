import type { EstacionZona } from './zona.ts';

export interface PosicionUsuario {
  lat: number;
  lon: number;
}

const RADIO_TIERRA_KM = 6371.0088;

function radianes(grados: number): number {
  return grados * Math.PI / 180;
}

/** Distancia ortodrómica. No representa una ruta por carretera. */
export function distanciaKm(a: PosicionUsuario, b: PosicionUsuario): number {
  const diferenciaLat = radianes(b.lat - a.lat);
  const diferenciaLon = radianes(b.lon - a.lon);
  const latA = radianes(a.lat);
  const latB = radianes(b.lat);
  const haversine = Math.sin(diferenciaLat / 2) ** 2
    + Math.cos(latA) * Math.cos(latB) * Math.sin(diferenciaLon / 2) ** 2;
  return 2 * RADIO_TIERRA_KM * Math.asin(Math.sqrt(haversine));
}

export function compararPorDistancia(
  posicion: PosicionUsuario,
  a: EstacionZona,
  b: EstacionZona,
): number {
  return distanciaKm(posicion, a) - distanciaKm(posicion, b)
    || a.id.localeCompare(b.id, 'es');
}

export function formatearDistancia(km: number): string {
  if (km < 1) return `${Math.max(10, Math.round(km * 100) * 10)} m`;
  if (km < 10) return `${km.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
  return `${Math.round(km).toLocaleString('es-ES')} km`;
}

/** Mensaje de error legible para el usuario a partir de un `GeolocationPositionError`.
 *  Función pura y compartida: el botón "mi ubicación" del mapa (RF-17) y el
 *  filtro "Cerca de mí" de la evolución la usan igual, para que no diverjan. */
export function mensajeErrorGeolocalizacion(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Permiso de ubicación denegado.';
    case error.POSITION_UNAVAILABLE:
      return 'No se ha podido determinar tu ubicación.';
    case error.TIMEOUT:
      return 'La ubicación ha tardado demasiado en responder.';
    default:
      return 'No se ha podido obtener tu ubicación.';
  }
}
