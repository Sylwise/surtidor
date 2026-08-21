// Resumen de estaciones por municipio dentro de una zona: cuántas hay y su
// precio mínimo de los SEIS combustibles (RF-94/RF-120), más el href de su
// página si llega al mínimo de RF-60. Alimenta las pastillas que cierran la
// lista de una página de zona (RF-89, RF-74: "los enlaces a otros
// municipios cierran la lista") y, con la misma forma de entrada, los
// vecinos de una página de municipio (RF-65, ver
// src/pages/[provincia]/[municipio]/index.astro).
// Antes vivía en tablaZona.ts, junto al cálculo de la tabla estática de 30
// más baratas; esa tabla desapareció con el pie de contenido
// (docs/05-diseno.md#La-lista-es-el-contenido) y este resumen es lo único
// que queda con consumidores.

import { estacionesVisibles } from './visibilidad.ts';
import { crearEscala } from './escala.ts';
import { ORDEN_COMBUSTIBLES } from './combustibles.ts';
import { generarSlug } from '../../scripts/lib/slug.ts';
import { MINIMO_ESTACIONES_MUNICIPIO } from '../../scripts/lib/tipos.ts';
import type { Banda } from './escala.ts';
import type { ClavePrecio, Precios } from '../../scripts/lib/tipos.ts';
import type { EstacionZona } from './zona.ts';

export interface ResumenMunicipioZona {
  municipio: string;
  provinciaId: string;
  provinciaNombre: string;
  estaciones: number;
  precios: Precios;
}

function preciosVacios(): Precios {
  return {
    gasolina95e5: null,
    gasoleoA: null,
    gasolina98e5: null,
    gasoleoPremium: null,
    gasoleoB: null,
    glp: null,
  };
}

/** Agrupa las estaciones visibles (RF-48) de una zona por municipio+provincia
 *  (RF-76/ADR-0007: el mismo nombre de municipio puede repetirse en varias
 *  provincias), ordenado alfabéticamente. El precio mínimo se calcula para
 *  los seis combustibles a la vez (RF-94/RF-120): quien consume esto elige cuál
 *  enseñar según el combustible activo, en vez de fijarlo aquí. */
export function resumenMunicipiosDe(estaciones: EstacionZona[]): ResumenMunicipioZona[] {
  const visibles = estacionesVisibles(estaciones);
  const porClave = new Map<string, ResumenMunicipioZona>();

  for (const estacion of visibles) {
    const clave = `${estacion.provinciaId}::${estacion.municipio}`;
    let resumen = porClave.get(clave);
    if (!resumen) {
      resumen = {
        municipio: estacion.municipio,
        provinciaId: estacion.provinciaId,
        provinciaNombre: estacion.provinciaNombre,
        estaciones: 0,
        precios: preciosVacios(),
      };
      porClave.set(clave, resumen);
    }
    resumen.estaciones += 1;
    for (const combustible of ORDEN_COMBUSTIBLES) {
      const precio = estacion.precios[combustible];
      const actual = resumen.precios[combustible];
      if (precio !== null && (actual === null || precio < actual)) resumen.precios[combustible] = precio;
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

export interface FilaMunicipio {
  href: string;
  nombre: string;
  /** `null` si el municipio no vende este combustible (RF-94): nunca el
   *  precio de otro. */
  precio: number | null;
  /** `null` junto con `precio: null`: sin precio no hay banda que pintar. */
  banda: (Banda | 'barata') | null;
}

/** Resuelve un conjunto de municipios (con sus cuatro precios ya calculados
 *  por `resumenMunicipiosDe`, o equivalentes) al combustible activo: precio
 *  y banda de color, o ambos `null` si no lo venden. La banda es relativa
 *  solo a este conjunto de enlaces (mismo patrón que
 *  src/logica/listaEstaciones.ts con las estaciones), no a toda la zona.
 *  Fuente única para el HTML servido (AppInteractiva.astro) y el repintado
 *  del cliente (Lista.ts, RF-94): que las dos vías no diverjan al cambiar
 *  de combustible. */
export function calcularEnlacesMunicipio(
  entradas: { href: string; nombre: string; precios: Precios }[],
  combustible: ClavePrecio,
): FilaMunicipio[] {
  const escala = crearEscala(
    entradas.map((entrada) => entrada.precios[combustible]).filter((precio): precio is number => precio !== null),
  );
  return entradas
    .map((entrada) => {
      const precio = entrada.precios[combustible];
      return {
        href: entrada.href,
        nombre: entrada.nombre,
        precio,
        banda: precio === null
          ? null
          : escala.esMasBarata(precio)
            ? 'barata' as const
            : escala.banda(precio),
      };
    })
    .sort((a, b) => {
      if (a.precio === null && b.precio === null) return a.nombre.localeCompare(b.nombre, 'es');
      if (a.precio === null) return 1;
      if (b.precio === null) return -1;
      return a.precio - b.precio || a.nombre.localeCompare(b.nombre, 'es');
    });
}
