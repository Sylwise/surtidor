// Decide qué provincias deberían estar cargadas dado lo que ocupa pantalla
// (ADR-0014, "el mapa manda", H12). Función pura: no toca red ni estado, solo
// calcula a partir del índice ya cargado y del rectángulo visible del mapa.
// La orquestación (pedir/soltar ficheros, actualizar el estado global, la
// URL) vive en src/logica/controladorMapaManda.ts.

import type { Rectangulo, ResumenProvincia } from '../../scripts/lib/tipos.ts';
import { fraccionVisible } from './rectangulos.ts';

/** ADR-0014: entran las provincias cuyo rectángulo ocupa más de este umbral
 *  de la vista. Constante única y declarada, valor de partida, a ajustar
 *  probando en un móvil real (no por cálculo). */
export const UMBRAL_FRACCION_VISTA = 0.15;

/**
 * Guarda provisional (encargo de H12, ver docs/06-roadmap.md#H12): por
 * debajo de este zoom no se dispara ninguna carga dinámica nueva. A esa
 * escala casi todas las provincias superarían a la vez el umbral de
 * pantalla, y cargar España entera son ~8 MB (RNF-12, RNF-13) — exactamente
 * el problema que V2-18 (vista nacional con pastillas) va a resolver de
 * verdad. Hasta entonces, por debajo de este zoom se conserva lo que ya
 * había cargado y no se descarga nada.
 */
export const UMBRAL_ZOOM_CARGA_DINAMICA = 8;

/** ADR-0005: listón de tamaño por zona, 300 KB comprimidos. Aquí se aplica
 *  al conjunto que "el mapa manda" va acumulando. */
export const PRESUPUESTO_BYTES_COMPRIMIDO = 300 * 1024;

export interface ResultadoVista {
  /** Provincias que deberían estar cargadas, ordenadas de más a menos
   *  pantalla ocupada (la primera es la dominante, ver ADR-0014 punto 3). */
  provincias: ResumenProvincia[];
  /** Provincias que superaban el umbral de pantalla pero se han quedado
   *  fuera por el presupuesto de ADR-0005: hay que decirlo en la interfaz,
   *  no crecer en silencio. */
  excluidasPorPresupuesto: ResumenProvincia[];
}

/**
 * `idsYaCargados`: lo que hay cargado ahora mismo, para poder devolverlo tal
 * cual cuando el zoom está por debajo del umbral (no se toca nada, ni se
 * añade ni se suelta).
 */
export function calcularVista(
  todasLasProvincias: ResumenProvincia[],
  vista: Rectangulo,
  zoom: number,
  idsYaCargados: string[],
): ResultadoVista {
  if (zoom < UMBRAL_ZOOM_CARGA_DINAMICA) {
    return {
      provincias: todasLasProvincias.filter((p) => idsYaCargados.includes(p.id)),
      excluidasPorPresupuesto: [],
    };
  }

  // "Entran las que superen el umbral" (H12): estrictamente mayor, no
  // "mayor o igual". Ordenadas de más a menos pantalla: la primera es la
  // dominante (ADR-0014 punto 3) y el presupuesto de abajo favorece a las
  // que más se ven.
  const candidatas = todasLasProvincias
    .map((provincia) => ({ provincia, fraccion: fraccionVisible(provincia.rectangulo, vista) }))
    .filter((c) => c.fraccion > UMBRAL_FRACCION_VISTA)
    .sort((a, b) => b.fraccion - a.fraccion)
    .map((c) => c.provincia);

  const provincias: ResumenProvincia[] = [];
  const excluidasPorPresupuesto: ResumenProvincia[] = [];
  let peso = 0;
  for (const provincia of candidatas) {
    if (peso + provincia.pesoComprimido > PRESUPUESTO_BYTES_COMPRIMIDO) {
      excluidasPorPresupuesto.push(provincia);
      continue;
    }
    peso += provincia.pesoComprimido;
    provincias.push(provincia);
  }

  return { provincias, excluidasPorPresupuesto };
}
