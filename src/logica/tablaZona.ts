// Cálculo de `.tabla-zona`: las 30 más baratas y el resumen por municipio.
// Un solo cálculo para dos consumidores que tienen que dar el mismo
// resultado (ADR-0016): el frontmatter de src/pages/[zona]/index.astro, en
// el build, y el regenerado en cliente de AppInteractiva.astro al cambiar de
// zona sin recargar (RF-88). Mismo patrón que fusionarProvincias en
// src/logica/zona.ts: la lógica vive una vez, cada vía la alimenta distinto.

import { estacionesVisibles } from './visibilidad.ts';
import { crearEscala, type Escala } from './escala.ts';
import { ORDEN_COMBUSTIBLES } from './combustibles.ts';
import { generarSlug } from '../../scripts/lib/slug.ts';
import { MINIMO_ESTACIONES_MUNICIPIO, type ClavePrecio } from '../../scripts/lib/tipos.ts';
import type { EstacionZona } from './zona.ts';

/** Una tabla con las 2.000 y pico estaciones de una comunidad no posiciona
 *  mejor que una con 30 (ver el comentario igual en [zona]/index.astro). */
export const LIMITE_TABLA_ZONA = 30;

export interface ResumenMunicipioZona {
  municipio: string;
  provinciaId: string;
  provinciaNombre: string;
  estaciones: number;
  precioMinimo: number | null;
}

export interface DatosTablaZona {
  /** Las `LIMITE_TABLA_ZONA` estaciones más baratas por gasolina 95. */
  filas: EstacionZona[];
  /** true si la zona abarca más de una provincia: decide si sale la columna
   *  "Provincia" en las dos tablas. */
  multiProvincia: boolean;
  /** Una escala por combustible (RF-12: percentil dentro de TODA la zona
   *  visible, no solo dentro de las filas de la tabla). */
  escalas: Record<ClavePrecio, Escala>;
  resumenMunicipios: ResumenMunicipioZona[];
}

/** Calcula los datos de `.tabla-zona` a partir de las estaciones fusionadas
 *  de una zona. No toca el DOM ni el disco: cada consumidor decide cómo
 *  pintar el resultado. */
export function calcularTablaZona(estaciones: EstacionZona[]): DatosTablaZona {
  const visibles = estacionesVisibles(estaciones);
  const multiProvincia = new Set(visibles.map((e) => e.provinciaId)).size > 1;

  const filas = [...visibles]
    .sort((a, b) => {
      const pa = a.precios.gasolina95e5;
      const pb = b.precios.gasolina95e5;
      if (pa === null && pb === null) return 0;
      if (pa === null) return 1;
      if (pb === null) return -1;
      return pa - pb;
    })
    .slice(0, LIMITE_TABLA_ZONA);

  const escalas = Object.fromEntries(
    ORDEN_COMBUSTIBLES.map((clave) => [
      clave,
      crearEscala(visibles.map((e) => e.precios[clave]).filter((p): p is number => p !== null)),
    ]),
  ) as Record<ClavePrecio, Escala>;

  const municipiosPorClave = new Map<string, ResumenMunicipioZona>();
  for (const estacion of visibles) {
    const clave = `${estacion.provinciaId}::${estacion.municipio}`;
    const precio = estacion.precios.gasolina95e5;
    const existente = municipiosPorClave.get(clave);
    if (existente) {
      existente.estaciones += 1;
      if (precio !== null && (existente.precioMinimo === null || precio < existente.precioMinimo)) {
        existente.precioMinimo = precio;
      }
    } else {
      municipiosPorClave.set(clave, {
        municipio: estacion.municipio,
        provinciaId: estacion.provinciaId,
        provinciaNombre: estacion.provinciaNombre,
        estaciones: 1,
        precioMinimo: precio,
      });
    }
  }
  const resumenMunicipios = [...municipiosPorClave.values()].sort((a, b) =>
    a.municipio.localeCompare(b.municipio, 'es'),
  );

  return { filas, multiProvincia, escalas, resumenMunicipios };
}

export function bandaPrecioZona(escalas: Record<ClavePrecio, Escala>, clave: ClavePrecio, precio: number): string {
  const escala = escalas[clave];
  return escala.esMasBarata(precio) ? 'barata' : escala.banda(precio);
}

/** `null` si el municipio no llega al mínimo de RF-60: esa URL no existe. */
export function hrefMunicipioZona(resumen: ResumenMunicipioZona): string | null {
  if (resumen.estaciones < MINIMO_ESTACIONES_MUNICIPIO) return null;
  return `/${generarSlug(resumen.provinciaNombre)}/${generarSlug(resumen.municipio)}/`;
}
