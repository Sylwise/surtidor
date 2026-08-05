// Frescura de los datos: RF-43 exige avisar si el dato tiene más de 6 horas.
// Función pura, sin dependencias, para poder testearla con fechas fabricadas.

const LIMITE_HORAS = 6;
const LIMITE_MS = LIMITE_HORAS * 60 * 60 * 1000;

/**
 * Compara la marca de tiempo `actualizado` (ISO 8601) contra `ahora` y
 * devuelve `true` si han pasado más de 6 horas.
 *
 * Una fecha ilegible cuenta como desactualizada: si no se puede confiar en el
 * dato, mejor avisar de más que de menos.
 */
export function datosDesactualizados(actualizadoIso: string, ahora: Date): boolean {
  const marca = new Date(actualizadoIso).getTime();
  if (Number.isNaN(marca)) return true;
  return ahora.getTime() - marca > LIMITE_MS;
}
