// Resumen de estaciones por municipio dentro de una zona: cuántas hay y su
// precio mínimo de gasolina 95, más el href de su página si llega al mínimo
// de RF-60. Alimenta las pastillas que cierran la lista de una página de
// zona (RF-89, RF-74: "los enlaces a otros municipios cierran la lista").
// Antes vivía en tablaZona.ts, junto al cálculo de la tabla estática de 30
// más baratas; esa tabla desapareció con el pie de contenido
// (docs/05-diseno.md#La-lista-es-el-contenido) y este resumen es lo único
// que queda con consumidores.

import { estacionesVisibles } from './visibilidad.ts';
import { generarSlug } from '../../scripts/lib/slug.ts';
import { MINIMO_ESTACIONES_MUNICIPIO } from '../../scripts/lib/tipos.ts';
import type { EstacionZona } from './zona.ts';

export interface ResumenMunicipioZona {
  municipio: string;
  provinciaId: string;
  provinciaNombre: string;
  estaciones: number;
  precioMinimo: number | null;
}

/** Agrupa las estaciones visibles (RF-48) de una zona por municipio+provincia
 *  (RF-76/ADR-0007: el mismo nombre de municipio puede repetirse en varias
 *  provincias), ordenado alfabéticamente. */
export function resumenMunicipiosDe(estaciones: EstacionZona[]): ResumenMunicipioZona[] {
  const visibles = estacionesVisibles(estaciones);
  const porClave = new Map<string, ResumenMunicipioZona>();

  for (const estacion of visibles) {
    const clave = `${estacion.provinciaId}::${estacion.municipio}`;
    const precio = estacion.precios.gasolina95e5;
    const existente = porClave.get(clave);
    if (existente) {
      existente.estaciones += 1;
      if (precio !== null && (existente.precioMinimo === null || precio < existente.precioMinimo)) {
        existente.precioMinimo = precio;
      }
    } else {
      porClave.set(clave, {
        municipio: estacion.municipio,
        provinciaId: estacion.provinciaId,
        provinciaNombre: estacion.provinciaNombre,
        estaciones: 1,
        precioMinimo: precio,
      });
    }
  }

  return [...porClave.values()].sort((a, b) => a.municipio.localeCompare(b.municipio, 'es'));
}

/** `null` si el municipio no llega al mínimo de RF-60: esa URL no existe. */
export function hrefMunicipioZona(resumen: ResumenMunicipioZona): string | null {
  if (resumen.estaciones < MINIMO_ESTACIONES_MUNICIPIO) return null;
  return `/${generarSlug(resumen.provinciaNombre)}/${generarSlug(resumen.municipio)}/`;
}

export function multiProvinciaDe(estaciones: EstacionZona[]): boolean {
  return new Set(estacionesVisibles(estaciones).map((e) => e.provinciaId)).size > 1;
}
