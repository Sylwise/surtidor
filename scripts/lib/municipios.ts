// Cruce entre el catálogo oficial de municipios (`Listados/Municipios`) y las
// estaciones reales de cada provincia, para construir `datos-build/municipios.json`
// (docs/06-roadmap.md#H10, segunda mitad). El catálogo aporta el nombre
// canónico y la provincia; el número de estaciones sale de contar, no del
// catálogo (que no lo trae).

import type { DatosProvincia, ResumenMunicipio } from './tipos.ts';
import type { MunicipioCatalogo } from './miteco.ts';

export interface ResultadoMunicipios {
  municipios: ResumenMunicipio[];
  /** Estaciones cuyo `municipio` (recortado) no aparece en el catálogo
   *  oficial para esa provincia: se cuentan igual (no se descartan
   *  estaciones reales por una discrepancia de catálogo) pero se avisa, en
   *  el mismo espíritu que RF-06. */
  sinCatalogar: number;
}

/**
 * Agrupa las estaciones visibles (RF-48: `tipoVenta === 'P'`, mismo filtro
 * que `src/logica/visibilidad.ts`) por provincia y municipio, y usa el
 * catálogo oficial para preferir su nombre exacto. Los dos lados se
 * recortan de espacios antes de comparar: el catálogo real trae al menos una
 * entrada con un espacio final que las estaciones no llevan.
 */
export function construirMunicipios(
  datosPorProvincia: DatosProvincia[],
  catalogoMunicipios: MunicipioCatalogo[],
): ResultadoMunicipios {
  const catalogoPorClave = new Map<string, string>();
  for (const municipio of catalogoMunicipios) {
    const nombre = municipio.Municipio.trim();
    catalogoPorClave.set(`${municipio.IDProvincia}::${nombre}`, nombre);
  }

  const conteoPorClave = new Map<string, ResumenMunicipio>();
  let sinCatalogar = 0;

  for (const datos of datosPorProvincia) {
    for (const estacion of datos.estaciones) {
      if (estacion.tipoVenta !== 'P') continue;

      const nombreEstacion = estacion.municipio.trim();
      const clave = `${datos.provincia.id}::${nombreEstacion}`;
      const nombreCanonico = catalogoPorClave.get(clave);
      if (nombreCanonico === undefined) sinCatalogar += 1;
      const nombre = nombreCanonico ?? nombreEstacion;

      const existente = conteoPorClave.get(clave);
      if (existente) {
        existente.estaciones += 1;
      } else {
        conteoPorClave.set(clave, { nombre, provinciaId: datos.provincia.id, estaciones: 1 });
      }
    }
  }

  return { municipios: [...conteoPorClave.values()], sinCatalogar };
}
