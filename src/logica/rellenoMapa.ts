export interface RectanguloVisible {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

export interface RellenoMapa {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Calcula el área útil de cámara a partir de la geometría que ya existe en
 * pantalla. En móvil, la hoja tapa el mapa por abajo; no se replica aquí
 * ninguna de sus tres alturas ni se presupone en qué estado está.
 */
export function calcularRellenoMapa(
  mapa: RectanguloVisible,
  hoja: RectanguloVisible | null,
  movil: boolean,
): RellenoMapa {
  const solapamientoHorizontal = hoja
    ? Math.max(0, Math.min(mapa.right, hoja.right) - Math.max(mapa.left, hoja.left))
    : 0;
  const solapamientoVertical = movil && hoja && solapamientoHorizontal > 0
    ? Math.max(0, Math.min(mapa.bottom, hoja.bottom) - Math.max(mapa.top, hoja.top))
    : 0;
  const altoVisible = Math.max(1, mapa.height - solapamientoVertical);
  const margenBase = Math.round(Math.min(mapa.width, mapa.height) * 0.08);
  const margenVertical = Math.min(margenBase, Math.floor(altoVisible / 4));

  return {
    top: margenVertical,
    right: margenBase,
    bottom: solapamientoVertical + margenVertical,
    left: margenBase,
  };
}
