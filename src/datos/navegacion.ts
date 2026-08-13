export interface EntradaHoy {
  slug: string;
  nombre: string;
  descripcion: string;
}

/** Catálogo único de análisis. La ruta de Evolución se completa con la
 * provincia activa cuando existe, pero nunca cambia de significado. */
export const CATALOGO_HOY: readonly EntradaHoy[] = [
  { slug: 'evolucion', nombre: 'Evolución de precios', descripcion: 'Cambios en los últimos 30 días' },
  { slug: 'provincias-mas-baratas', nombre: 'Provincias más baratas', descripcion: 'Compara medias y mínimos' },
  { slug: 'cuanto-te-juegas', nombre: 'Cuánto puedes ahorrar', descripcion: 'Ahorro posible por depósito' },
  { slug: 'marcas-mas-baratas', nombre: 'Marcas más baratas', descripcion: 'Ranking por cadenas' },
  { slug: 'capitales-de-provincia', nombre: 'Capitales de provincia', descripcion: 'Precios en grandes ciudades' },
  { slug: 'la-mas-barata-de-espana', nombre: 'La más barata de España', descripcion: 'El mínimo nacional de hoy' },
  { slug: 'canarias-ceuta-melilla', nombre: 'Canarias, Ceuta y Melilla', descripcion: 'Precios separados por su fiscalidad' },
] as const;

export const EDITORIALES_HOY = CATALOGO_HOY.filter(({ slug }) => slug !== 'evolucion');

export const HERRAMIENTAS_HOY: readonly EntradaHoy[] = [
  CATALOGO_HOY.find(({ slug }) => slug === 'evolucion')!,
  { slug: 'como-calculamos-los-datos', nombre: 'Cómo calculamos los datos', descripcion: 'Fuente, proceso y reglas' },
] as const;

export function hrefEntradaHoy(entrada: EntradaHoy, provinciaId?: string | null): string {
  if (entrada.slug === 'evolucion' && provinciaId) return `/hoy/evolucion/${provinciaId}/`;
  if (entrada.slug === 'como-calculamos-los-datos') return '/como-calculamos-los-datos/';
  return `/hoy/${entrada.slug}/`;
}

export function entradaHoyActiva(pathname: string, entrada: EntradaHoy): boolean {
  if (entrada.slug === 'como-calculamos-los-datos') return pathname === '/como-calculamos-los-datos/';
  return pathname.startsWith(`/hoy/${entrada.slug}/`);
}
