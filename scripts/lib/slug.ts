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
 * Prefijo de las URLs de comunidad aut\u00f3noma cuyo slug coincide con el de una
 * provincia (ADR-0018: Asturias, Cantabria, Ceuta, Madrid, Melilla, Murcia,
 * Navarra, Rioja (La)). Exportado como constante, no como cadena repetida a
 * mano, porque tanto quien construye la URL en el build
 * (scripts/descargar-datos.ts, scripts/datos-mock.ts, v\u00eda `idZonaComunidad`)
 * como quien la interpreta en el cliente
 * (src/componentes/AppInteractiva.astro#zonaIdDeDireccion) tienen que estar
 * de acuerdo en el mismo literal.
 */
export const PREFIJO_COMUNIDAD = 'comunidad';

/**
 * Id (y tramo de URL) de una comunidad aut\u00f3noma: su slug a secas, salvo que
 * coincida con el de alguna de las 52 provincias, en cuyo caso
 * `comunidad/{slug}` (ADR-0018). `slugsProvincia` se calcula una vez en el
 * build comparando las 52 provincias contra las 19 comunidades \u2014 nunca una
 * lista de colisiones escrita a mano, para que sobreviva a un cambio en el
 * cat\u00e1logo del ministerio.
 */
export function idZonaComunidad(nombre: string, slugsProvincia: ReadonlySet<string>): string {
  const slug = generarSlug(nombre);
  return slugsProvincia.has(slug) ? `${PREFIJO_COMUNIDAD}/${slug}` : slug;
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
