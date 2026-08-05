// Agrupación en racimos y detección de colisiones de los marcadores del
// mapa (ADR-0006, RF-16, RF-18). Funciones puras sobre coordenadas de
// pantalla ya proyectadas: no tocan MapLibre ni el DOM, para que sean
// triviales de probar. src/componentes/Mapa.ts las llama al terminar cada
// gesto del mapa (moveend/zoomend), nunca en cada fotograma.

export interface PuntoColision {
  id: string;
  /** Coordenadas de pantalla en píxeles, con el marcador anclado por abajo
   *  (anchor: 'bottom', igual que maplibregl.Marker). */
  x: number;
  y: number;
  /** Precio del combustible activo, o null si la estación no lo vende. Se
   *  usa solo para decidir el orden de la cola: null cuenta como "el más
   *  caro posible", así un marcador sin dato es el primero en sacrificarse
   *  ante una colisión, nunca la estación más barata (RF-18). */
  precio: number | null;
  /** Tamaño del cartel en píxeles, si difiere del tamaño por defecto (la
   *  más barata es un punto más grande, ver docs/05-diseno.md#Marcador). */
  ancho?: number;
  alto?: number;
}

export interface DimensionesCartel {
  ancho: number;
  alto: number;
}

interface Caja {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Tamaño aproximado del cartel de precio ("1,409"): suficiente para la
 *  detección de colisiones, que no necesita el ancho exacto de cada texto. */
export const CAJA_CARTEL_POR_DEFECTO: DimensionesCartel = { ancho: 60, alto: 26 };

/** Separación mínima entre carteles, además de su propio tamaño, para que no
 *  queden pegados unos a otros aunque técnicamente no se solapen. */
const MARGEN_PX = 4;

function cajaDe(p: PuntoColision, porDefecto: DimensionesCartel, margen: number): Caja {
  const ancho = p.ancho ?? porDefecto.ancho;
  const alto = p.alto ?? porDefecto.alto;
  // El ancla es la base del cartel (anchor: 'bottom'): el punto (x, y) es la
  // esquina inferior central, no el centro de la caja.
  return {
    minX: p.x - ancho / 2 - margen,
    maxX: p.x + ancho / 2 + margen,
    minY: p.y - alto - margen,
    maxY: p.y + margen,
  };
}

function solapan(a: Caja, b: Caja): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

/**
 * Detección de colisiones propia (ADR-0006): ordena por precio ascendente y
 * coloca de forma voraz, descartando el que solape con uno ya colocado.
 * Como la cola va ordenada por precio, la más barata se coloca siempre
 * primero y nunca pierde una colisión (RF-18).
 *
 * Devuelve el conjunto de ids que se pueden mostrar sin solaparse; el resto
 * se oculta, no se amontona.
 */
export function resolverColisiones(
  puntos: PuntoColision[],
  cajaPorDefecto: DimensionesCartel = CAJA_CARTEL_POR_DEFECTO,
  margen: number = MARGEN_PX
): Set<string> {
  const ordenados = [...puntos].sort((a, b) => (a.precio ?? Infinity) - (b.precio ?? Infinity));
  const colocadas: Caja[] = [];
  const visibles = new Set<string>();

  for (const punto of ordenados) {
    const caja = cajaDe(punto, cajaPorDefecto, margen);
    if (colocadas.some((otra) => solapan(caja, otra))) continue;
    colocadas.push(caja);
    visibles.add(punto.id);
  }

  return visibles;
}

export interface PuntoAgrupable {
  id: string;
  /** Coordenadas de pantalla en píxeles. */
  x: number;
  y: number;
  precio: number | null;
}

export interface Racimo {
  /** Centroide del grupo, en coordenadas de pantalla. */
  x: number;
  y: number;
  ids: string[];
  /** Precio más bajo del grupo, o null si ninguna estación del grupo vende
   *  el combustible activo. */
  precioMinimo: number | null;
}

/**
 * Agrupación por racimos (ADR-0006, RF-16): reparte los puntos en una
 * rejilla de celdas de `radioPx` píxeles de lado y agrupa los que caen en la
 * misma celda. Una celda con una sola estación no es un racimo: esa
 * estación se pinta como marcador individual, no como grupo de uno.
 */
export function agruparEnRacimos(puntos: PuntoAgrupable[], radioPx: number): Racimo[] {
  if (radioPx <= 0) throw new Error('radioPx debe ser mayor que 0');

  const celdas = new Map<string, PuntoAgrupable[]>();
  for (const punto of puntos) {
    const clave = `${Math.floor(punto.x / radioPx)},${Math.floor(punto.y / radioPx)}`;
    const grupo = celdas.get(clave);
    if (grupo) grupo.push(punto);
    else celdas.set(clave, [punto]);
  }

  const racimos: Racimo[] = [];
  for (const grupo of celdas.values()) {
    if (grupo.length < 2) continue;
    const precios = grupo.map((p) => p.precio).filter((p): p is number => p !== null);
    racimos.push({
      x: grupo.reduce((suma, p) => suma + p.x, 0) / grupo.length,
      y: grupo.reduce((suma, p) => suma + p.y, 0) / grupo.length,
      ids: grupo.map((p) => p.id),
      precioMinimo: precios.length > 0 ? Math.min(...precios) : null,
    });
  }
  return racimos;
}

/** Ids de todas las estaciones repartidas en algún racimo, para que quien
 *  llama sepa qué marcadores individuales ocultar. */
export function idsAgrupados(racimos: Racimo[]): Set<string> {
  const ids = new Set<string>();
  for (const racimo of racimos) {
    for (const id of racimo.ids) ids.add(id);
  }
  return ids;
}
