// Título y meta-descripción de una página de zona. Misma cadena en dos
// sitios que no pueden divergir (ADR-0016): el frontmatter de
// src/pages/[zona]/index.astro, en el build, y el regenerado en cliente de
// AppInteractiva.astro al cambiar de zona sin recargar (RF-88).

import { nombreVisible, type TipoNombreTerritorial } from './formato.ts';

export function tituloZona(zonaNombre: string, tipo: TipoNombreTerritorial): string {
  return `Precios de gasolina y diésel en ${nombreVisible(zonaNombre, tipo)} · Surtidor`;
}

export function descripcionZona(zonaNombre: string, tipo: TipoNombreTerritorial): string {
  return `Precios de gasolina y diésel en ${nombreVisible(zonaNombre, tipo)}, actualizados cada dos horas, sin anuncios ni registro.`;
}
