// Lado de la carretera a partir del campo `Margen` (RF-29, RF-87). Comparte
// causa raíz con `Tipo Venta` en el normalizador (docs/06-roadmap.md#H6): los
// dos se perdían en el mismo punto y se arreglaron juntos.
//
// `null` (el ministerio no declara el campo) y `N` (declarado explícitamente,
// pero sin lado que decir en una vía de doble sentido) no tienen fila: una
// etiqueta que dice "sin margen" es ruido, no información útil para decidir
// (docs/05-diseno.md#Palabras-concretas). Solo `D`/`I` se muestran.

import type { Margen } from '../../scripts/lib/tipos.ts';

type MargenConocido = Exclude<Margen, null | 'N'>;

export const ETIQUETA_MARGEN: Record<MargenConocido, string> = {
  D: 'A la derecha de la vía',
  I: 'A la izquierda de la vía',
};

const NS_SVG = 'http://www.w3.org/2000/svg';

function crearLinea(x1: number, y1: number, x2: number, y2: number): SVGLineElement {
  const linea = document.createElementNS(NS_SVG, 'line');
  linea.setAttribute('x1', String(x1));
  linea.setAttribute('y1', String(y1));
  linea.setAttribute('x2', String(x2));
  linea.setAttribute('y2', String(y2));
  return linea;
}

/**
 * Icono de 20×20: una carretera de dos carriles vista desde arriba, con un
 * punto relleno marcando en qué lado está la estación.
 */
export function crearIconoMargen(margen: MargenConocido): SVGSVGElement {
  const svg = document.createElementNS(NS_SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.4');

  const bordeIzquierdo = crearLinea(7, 2, 7, 18);
  const bordeDerecho = crearLinea(13, 2, 13, 18);
  bordeIzquierdo.setAttribute('opacity', '0.55');
  bordeDerecho.setAttribute('opacity', '0.55');

  const mediana = crearLinea(10, 2, 10, 18);
  mediana.setAttribute('stroke-dasharray', '2 2');
  mediana.setAttribute('opacity', '0.35');

  const punto = document.createElementNS(NS_SVG, 'circle');
  const cx = margen === 'D' ? 16 : 4;
  punto.setAttribute('cx', String(cx));
  punto.setAttribute('cy', '10');
  punto.setAttribute('r', '2.3');
  punto.setAttribute('fill', 'currentColor');
  punto.setAttribute('stroke', 'none');

  svg.append(bordeIzquierdo, mediana, bordeDerecho, punto);
  return svg;
}
