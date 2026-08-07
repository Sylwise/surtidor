// Slugs para las URLs anidadas de las páginas de municipio (ADR-0007,
// docs/06-roadmap.md#H10): /{provincia}/{municipio}/. El slug sale siempre
// del nombre del catálogo del ministerio, normalizado — nunca se inventa ni
// se acorta a mano (RF-76).

/**
 * "ARABA/ALAVA" → "araba-alava". "Donostia/San Sebastián" →
 * "donostia-san-sebastian". Minúsculas, sin diacríticos (incluida la ñ, que
 * en NFD se descompone igual que una vocal acentuada: "n" + marca de tilde),
 * y cualquier tramo de caracteres que no sean letra o número —barra, coma,
 * espacio, guion ya presente— colapsa a un solo guion.
 */
export function generarSlug(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Lanza si dos elementos del mismo grupo generan el mismo slug: dos
 * municipios de la misma provincia (o dos provincias, con un único grupo
 * global) que colisionarían en la misma URL. Es la guarda de la que habla el
 * hito H10: "es el fallo que ningún test detecta si no lo buscas a
 * propósito". Se llama antes de escribir nada (mismo principio que RF-05):
 * una colisión de slugs no debe llegar nunca a publicarse en silencio,
 * pisando la página de otro municipio.
 */
export function comprobarSlugsUnicos<T>(
  items: T[],
  nombreDe: (item: T) => string,
  grupoDe: (item: T) => string,
  descripcion: string,
): void {
  const vistos = new Map<string, string>();
  for (const item of items) {
    const nombre = nombreDe(item);
    const clave = `${grupoDe(item)}::${generarSlug(nombre)}`;
    const anterior = vistos.get(clave);
    if (anterior !== undefined && anterior !== nombre) {
      throw new Error(
        `${descripcion}: "${anterior}" y "${nombre}" generan el mismo slug ` +
          `("${generarSlug(nombre)}") dentro del mismo grupo. No se puede generar ` +
          'una URL para cada uno sin que se pisen.',
      );
    }
    vistos.set(clave, nombre);
  }
}
