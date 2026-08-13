export type IntencionGestoGrafico = 'pendiente' | 'recorrer' | 'desplazar';

const UMBRAL_GESTO_PX = 8;

/**
 * Separa el barrido horizontal del gráfico del scroll vertical de la página.
 * Mientras el dedo no supera el umbral se conserva como un toque simple.
 */
export function clasificarGestoGrafico(
  deltaX: number,
  deltaY: number,
  umbral = UMBRAL_GESTO_PX,
): IntencionGestoGrafico {
  const horizontal = Math.abs(deltaX);
  const vertical = Math.abs(deltaY);
  if (Math.max(horizontal, vertical) < umbral) return 'pendiente';
  return horizontal > vertical ? 'recorrer' : 'desplazar';
}
