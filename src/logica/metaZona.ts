// Título y meta-descripción de una página de zona. Misma cadena en dos
// sitios que no pueden divergir (ADR-0016): el frontmatter de
// src/pages/[zona]/index.astro, en el build, y el regenerado en cliente de
// AppInteractiva.astro al cambiar de zona sin recargar (RF-88).

export function tituloZona(zonaNombre: string): string {
  return `Precios de gasolina y diésel en ${zonaNombre} · Surtidor`;
}

export function descripcionZona(zonaNombre: string): string {
  return `Precios de gasolina y diésel en ${zonaNombre}, actualizados cada dos horas, sin anuncios ni registro.`;
}
