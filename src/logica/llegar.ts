// Enlaces a aplicaciones de mapas externas para el botón "cómo llegar"
// (RF-27, RF-28). En Android se usa el esquema `geo:`, que dispara el
// selector del sistema y respeta la app que cada uno tenga instalada; en
// cualquier otro sistema, el enlace universal de Google Maps hace de
// opción por defecto porque abre sin selector y sin app instalada. Waze y
// Apple Maps quedan siempre disponibles como accesos secundarios.

export function esAndroid(userAgent: string): boolean {
  return /android/i.test(userAgent);
}

export function enlaceGoogleMaps(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}

/** `geo:0,0?q=` en vez de `geo:lat,lon`: con coordenadas en la primera
 *  parte, algunas apps navegan directas al punto sin enseñar el rótulo. Con
 *  `0,0` y el punto solo en `q`, el selector del sistema y la app elegida
 *  reciben también la etiqueta legible. */
export function enlaceGeo(lat: number, lon: number, etiqueta: string): string {
  return `geo:0,0?q=${lat},${lon}(${encodeURIComponent(etiqueta)})`;
}

export function enlaceWaze(lat: number, lon: number): string {
  return `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
}

export function enlaceAppleMaps(lat: number, lon: number): string {
  return `https://maps.apple.com/?daddr=${lat},${lon}`;
}

/** El enlace principal del botón "cómo llegar": `geo:` en Android, Google
 *  Maps universal en cualquier otro caso (RF-27). */
export function enlacePrincipal(lat: number, lon: number, etiqueta: string, userAgent: string): string {
  return esAndroid(userAgent) ? enlaceGeo(lat, lon, etiqueta) : enlaceGoogleMaps(lat, lon);
}
