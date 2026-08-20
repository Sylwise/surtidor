// H11 (RF-66) · Imagen de compartición (`og:image`), una por página de zona y
// de municipio, generada aquí en el build — nunca en tiempo de petición ni
// con un servicio externo (regla dura 1 de CLAUDE.md).
//
// Por qué una dependencia nueva y dos ficheros de fuente: dibujar y
// rasterizar texto a PNG sin ninguna librería son cientos de líneas (un
// rasterizador de glifos no son "treinta líneas propias"), así que esto sí
// gana su sitio en la lista de docs/03-arquitectura.md#Stack. `resvg` (Rust,
// vía `@resvg/resvg-js`) convierte un SVG que construimos a mano —sin motor
// de layout, sin CSS externo, solo texto y rectángulos con los tokens de
// tokens.css copiados literalmente— a un PNG. Nada de Puppeteer/Playwright:
// eso exige un Chromium entero solo para pintar un rectángulo con tres
// líneas de texto, y sería lentísimo multiplicado por 1161 páginas.
//
// Las fuentes de sistema NO sirven aquí: este script corre tanto en el
// portátil de quien desarrolla (Fedora) como en el runner de GitHub Actions
// (Ubuntu), y cada uno trae un catálogo de fuentes distinto — el mismo build
// produciría imágenes distintas según dónde se ejecute, que es justo lo que
// una tubería de datos reproducible no puede permitirse. Por eso
// `scripts/lib/fuentes/` lleva sus dos únicas fuentes (Inter y JetBrains
// Mono, licencia OFL, ficheros `OFL-*.txt` al lado) embebidas: cero red en
// build, mismo resultado en cualquier máquina. No son "fuentes web" en el
// sentido que prohíbe docs/05-diseno.md —esa regla es sobre la interfaz que
// carga el navegador y bloquea el renderizado— esto es un asset de build que
// el navegador nunca pide ni descarga.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { fusionarProvincias, type EstacionZona } from '../src/logica/zona.ts';
import { estacionesVisibles } from '../src/logica/visibilidad.ts';
import { COMBUSTIBLES_COMPARTIR, ETIQUETA } from '../src/logica/combustibles.ts';
import { mensajeAquiNoHay } from '../src/logica/mensajesAusencia.ts';
import { formatearEuros, formatearFechaHora, formatearPrecio, nombreVisible } from '../src/logica/formato.ts';
import { calcularAgregadosEditoriales } from './lib/agregados.ts';
import { calcularAgregadosCapitales } from './lib/capitales.ts';
import { calcularAgregadosMinimos } from './lib/minimos.ts';
import { mayorCoste, menorMedia } from './lib/resumenes-hoy.ts';
import { rotulosQueVenden, seleccionarRotulos } from './lib/rotulos.ts';
import { generarSlug } from './lib/slug.ts';
import { MINIMO_ESTACIONES_MUNICIPIO, type DatosProvincia, type Indice, type IndiceMunicipios } from './lib/tipos.ts';

const RAIZ = process.cwd();
const DIR_DATOS = join(RAIZ, 'public', 'data');
const DIR_SALIDA = join(RAIZ, 'public', 'og');
const DIR_FUENTES = join(RAIZ, 'scripts', 'lib', 'fuentes');

const ANCHO = 1200;
const ALTO = 630;
// Zona segura (encargo del rediseño): nada esencial a menos de 60 px del
// borde, porque WhatsApp y Telegram recortan la tarjeta según el cliente.
// 72 px de margen, con holgura sobre el mínimo.
const MARGEN = 72;
const ANCHO_UTIL = ANCHO - MARGEN * 2;

// Colores: solo tokens de src/estilos/tokens.css, copiados literalmente
// (este script corre en Node, no puede leer custom properties de CSS).
const COLOR_FONDO = '#16323B'; // --petrol
const COLOR_PAPEL = '#EDEFEF'; // --paper
// --mejor RELLENA, --mejor-texto ESCRIBE (docs/05-diseno.md#Tokens): el
// precio aquí es color de texto directo sobre --petrol, así que es
// --mejor-texto, nunca --mejor (~2:1 de contraste, ilegible).
const COLOR_MEJOR_TEXTO = '#3FD69A'; // --mejor-texto
const COLOR_SIGNAL = '#F5B921'; // --signal
const COLOR_MUTED_LIGHT = 'rgba(255,255,255,0.58)'; // --muted-light
const COLOR_NO_VENDE = 'rgba(255,255,255,0.28)'; // --no-vende
const COLOR_HAIR_DARK = 'rgba(255,255,255,0.13)'; // --hair-dark: la línea separadora del pie

interface Tarjeta {
  rutaSalida: string;
  /** Municipio + provincia ("Vitoria-Gasteiz, Araba/Álava"), o el nombre de
   *  zona a secas para las páginas de provincia y comunidad. Antetítulo,
   *  pequeño: el héroe de la imagen es el precio, no el nombre (ver el
   *  informe de medición del hito H11 sobre el primer diseño, que lo tenía
   *  al revés). */
  antetitulo: string;
  precioGasolina95: number | null;
  precioDiesel: number | null;
  estacionMasBarata: string | null;
  actualizado: string | null;
}

type CombustibleCompartir = typeof COMBUSTIBLES_COMPARTIR[number];
const [GASOLINA_COMPARTIR, DIESEL_COMPARTIR] = COMBUSTIBLES_COMPARTIR;

export interface TarjetaEditorial {
  rutaSalida: string;
  titulo: string;
  gasolina95: string;
  origenGasolina95: string;
  diesel: string;
  origenDiesel: string;
  actualizado: string;
}

function escaparXml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Ancho aproximado de una línea en Inter, en px por carácter: 0,58 em, una
 * estimación deliberadamente generosa (Inter real promedia más cerca de
 * 0,52-0,55) para no arriesgarse a que un texto largo desborde el lienzo.
 * Calibrado a ojo contra el render real de los nombres y rótulos más largos
 * de España (ver el informe de medición del hito H11).
 */
function anchoEstimado(texto: string, tamFuente: number): number {
  return texto.length * tamFuente * 0.58;
}

/** Recorta con puntos suspensivos si no cabe en `anchoMaximo` a `tamFuente`.
 *  España tiene rótulos de estación de hasta 86 caracteres ("ESTACION DE
 *  SERVICIO DIEGO PILETA Y AUTOLAVADO AGUA OSMOTIZADA: HIJOS DE DIEGO
 *  PILETA", dato real del MITECO) y municipios con provincia que juntos
 *  superan la línea, así que truncar no es un caso de borde, es lo normal
 *  en el extremo largo de la distribución. */
function truncarConElipsis(texto: string, anchoMaximo: number, tamFuente: number): string {
  if (anchoEstimado(texto, tamFuente) <= anchoMaximo) return texto;
  let recortado = texto;
  while (recortado.length > 1 && anchoEstimado(`${recortado}…`, tamFuente) > anchoMaximo) {
    recortado = recortado.slice(0, -1);
  }
  return `${recortado.trimEnd()}…`;
}

/** La estación más barata de gasolina 95 (el combustible por defecto de toda
 *  la aplicación); si ninguna de las visibles la vende, se cae a diésel. */
function estacionMasBarata(estaciones: EstacionZona[]): EstacionZona | null {
  if (estaciones.length === 0) return null;
  const porGasolina95 = estaciones.filter((e) => e.precios[GASOLINA_COMPARTIR] !== null);
  const candidatas = porGasolina95.length > 0 ? porGasolina95 : estaciones.filter((e) => e.precios[DIESEL_COMPARTIR] !== null);
  if (candidatas.length === 0) return null;
  const clave = porGasolina95.length > 0 ? GASOLINA_COMPARTIR : DIESEL_COMPARTIR;
  return [...candidatas].sort((a, b) => (a.precios[clave] as number) - (b.precios[clave] as number))[0];
}

function precioMinimo(estaciones: EstacionZona[], clave: CombustibleCompartir): number | null {
  let minimo: number | null = null;
  for (const estacion of estaciones) {
    const precio = estacion.precios[clave];
    if (precio !== null && (minimo === null || precio < minimo)) minimo = precio;
  }
  return minimo;
}

// JetBrains Mono es monoespaciada de verdad (avance de 0,6 em por carácter,
// ver su METADATA): el ancho de un número se puede calcular exacto en vez de
// estimarlo, a diferencia del texto en Inter (proporcional).
const AVANCE_MONO = 0.6;

/** Qué combustible es el héroe de la imagen: el más barato de los dos, el que
 *  se lleva el verde y el cuerpo grande — ADR-0003 dice que el verde marca lo
 *  barato, no que marque siempre el mismo combustible. Si solo hay uno
 *  disponible, ese es el héroe sin comparar nada. En empate exacto gana
 *  gasolina 95, el combustible por defecto de toda la aplicación
 *  (COMBUSTIBLE_POR_DEFECTO en src/logica/estado.ts). Verificado con datos
 *  reales: Castilla-La Mancha (2026-08-07) vende diésel a 1,460 y gasolina 95
 *  a 1,465 — el diésel es el héroe ahí. */
function elegirHeroe(tarjeta: Tarjeta): {
  clave: CombustibleCompartir;
  precio: number | null;
} {
  const { precioGasolina95, precioDiesel } = tarjeta;
  if (precioGasolina95 === null && precioDiesel === null) return { clave: GASOLINA_COMPARTIR, precio: null };
  if (precioDiesel === null) return { clave: GASOLINA_COMPARTIR, precio: precioGasolina95 };
  if (precioGasolina95 === null) return { clave: DIESEL_COMPARTIR, precio: precioDiesel };
  return precioGasolina95 <= precioDiesel
    ? { clave: GASOLINA_COMPARTIR, precio: precioGasolina95 }
    : { clave: DIESEL_COMPARTIR, precio: precioDiesel };
}

/** Tamaño de la etiqueta según el tamaño del número que corona: usado tanto
 *  al dibujarla como al calcular cuánto alto reservarle, para que las dos
 *  cuentas no puedan divergir. */
function tamEtiquetaPara(tamNumero: number): number {
  return tamNumero >= 150 ? 26 : 24;
}

// Fracción del tamaño de fuente que ocupa la altura de mayúscula (el cuerpo
// del glifo por encima de su línea de base). Estimación generosa —mismo
// criterio que anchoEstimado más abajo—: JetBrains Mono Bold e Inter
// SemiBold rondan 0,72-0,74 reales; se redondea al alza para no arriesgar
// que el número invada la línea de la etiqueta que tiene encima.
const ALTURA_MAYUSCULA = 0.75;
// Aire entre la línea de base de la etiqueta y la parte superior del número.
// 14px quitaba el solape (el bug original) pero a ojo, en el render real,
// seguía leyéndose pegado — encargo tras verlo: más aire de separación.
const ESPACIO_ETIQUETA_NUMERO = 34;

/** Bloque de precio: etiqueta encima, número debajo, en la línea de base
 *  que le pasen (para que el héroe y el secundario compartan una sola línea
 *  de base, no el borde superior — encargo del segundo rediseño). Cada
 *  columna reserva su propio alto de etiqueta (`yNumero` se calcula en la
 *  llamada a partir de `ALTURA_MAYUSCULA` del número más grande de la
 *  tarjeta, nunca de un offset fijo), así que la etiqueta nunca puede quedar
 *  a la altura de un número, ni el suyo ni el de la otra columna. "€/L"
 *  pequeño al lado del número, posicionado con su ancho exacto: JetBrains
 *  Mono es monoespaciada de verdad, no hace falta medir el render. */
function bloquePrecio(
  x: number,
  yEtiqueta: number,
  yNumero: number,
  combustible: CombustibleCompartir,
  precio: number | null,
  tamNumero: number,
  colorNumero: string,
  tamUnidad: number,
): string {
  const tamEtiqueta = tamEtiquetaPara(tamNumero);
  const etiquetaSvg = `<text x="${x}" y="${yEtiqueta}" font-family="Inter" font-weight="600" font-size="${tamEtiqueta}" letter-spacing="1.5" fill="${COLOR_MUTED_LIGHT}">${escaparXml(ETIQUETA[combustible].toUpperCase())}</text>`;
  if (precio === null) {
    return `${etiquetaSvg}
    <text x="${x}" y="${yNumero}" font-family="Inter" font-weight="400" font-size="${Math.round(tamNumero * 0.3)}" fill="${COLOR_NO_VENDE}">${escaparXml(mensajeAquiNoHay(combustible))}</text>`;
  }
  const numero = formatearPrecio(precio);
  const anchoNumero = numero.length * tamNumero * AVANCE_MONO;
  const xUnidad = x + anchoNumero + tamUnidad * 0.4;
  return `${etiquetaSvg}
    <text x="${x}" y="${yNumero}" font-family="JetBrains Mono" font-weight="700" font-size="${tamNumero}" fill="${colorNumero}">${numero}</text>
    <text x="${xUnidad}" y="${yNumero}" font-family="Inter" font-weight="600" font-size="${tamUnidad}" fill="${COLOR_MUTED_LIGHT}">€/L</text>`;
}

// Tótem reducido: SOLO el cartel, sin poste ni peana (docs/07-marca.md#Marca
// reducida). Por debajo de 32 px el tótem completo deja de leerse como un
// cartel de precio y se lee como el pie de una copa. Coordenadas de
// marca/icono.svg, con el poste y la peana (los otros dos <rect>)
// sencillamente sin dibujar.
function totemReducido(x: number, y: number, escala: number): string {
  return `<rect x="${x + 11 * escala}" y="${y + 11 * escala}" width="${42 * escala}" height="${23 * escala}" rx="${6 * escala}" fill="${COLOR_SIGNAL}" />`;
}

/** Tótem completo (cartel + poste + peana), la misma silueta que
 *  marca/icono.svg. Por encima de 32 px las tres piezas se leen como lo que
 *  son —un cartel anclado a un punto—, no como el pie de una copa
 *  (docs/07-marca.md#Marca-reducida). `(x, y)` es el origen del `translate`,
 *  antes de compensar el desplazamiento de 11 unidades del cartel en el
 *  viewBox de 64 — igual que `totemReducido`, para que las dos funciones se
 *  usen igual. */
function totemCompleto(x: number, y: number, escala: number): string {
  return `
    <g transform="translate(${x - 11 * escala}, ${y - 11 * escala}) scale(${escala})" fill="${COLOR_SIGNAL}">
      <rect x="11" y="11" width="42" height="23" rx="6" />
      <rect x="28" y="34" width="8" height="12" />
      <rect x="19" y="46" width="26" height="6" rx="3" />
    </g>`;
}

/**
 * Tres bandas, dos de ancho completo (segundo rediseño: la primera
 * composición era una pila de líneas alineadas a la izquierda con todo el
 * lado derecho vacío — "un 45% de vacío a la derecha", en las palabras del
 * encargo):
 *
 * 1. Banda superior, ancho completo: antetítulo a la izquierda, tótem
 *    completo a la derecha. Ancla esa esquina, que antes no tenía nada, y
 *    sube la marca desde el pie, donde flotaba sin relación con nada.
 * 2. Bloque central en dos columnas: el combustible principal (héroe) a la
 *    izquierda, el otro combustible a la derecha, misma estructura a menor
 *    escala. Los dos números comparten línea de base.
 * 3. Pie, ancho completo, con una línea separadora fina: la estación más
 *    barata a la izquierda, la fecha del dato a la derecha.
 */
export function renderizarSvg(tarjeta: Tarjeta): string {
  const heroe = elegirHeroe(tarjeta);
  const claveSecundaria = heroe.clave === GASOLINA_COMPARTIR ? DIESEL_COMPARTIR : GASOLINA_COMPARTIR;
  const precioSecundario = claveSecundaria === GASOLINA_COMPARTIR ? tarjeta.precioGasolina95 : tarjeta.precioDiesel;
  const hayColumnaSecundaria = precioSecundario !== null;

  // --- 1. Banda superior ---
  const yAntetitulo = 110;
  const escalaTotemBanda = 1.27; // 41×1.27 ≈ 52 px de alto: por encima del umbral de 32 px
  const anchoTotemBanda = 42 * escalaTotemBanda;
  const gapTotem = 28;
  const anchoAntetituloDisponible = ANCHO_UTIL - anchoTotemBanda - gapTotem;
  const antetituloSvg = `<text x="${MARGEN}" y="${yAntetitulo}" font-family="Inter" font-weight="600" font-size="28" letter-spacing="0.5" fill="${COLOR_MUTED_LIGHT}">${escaparXml(truncarConElipsis(tarjeta.antetitulo, anchoAntetituloDisponible, 28))}</text>`;
  const totemBandaSvg = totemCompleto(ANCHO - MARGEN - anchoTotemBanda, MARGEN, escalaTotemBanda);
  // Alto real de la banda superior: el tótem (translate en MARGEN, 41 unidades
  // de viewBox × escalaTotemBanda) llega más abajo que el antetítulo. Con 10 px
  // de aire detrás, para no partir el bloque central pegado a sus glifos.
  const alturaCabecera = MARGEN + 41 * escalaTotemBanda + 10;

  // --- 3. Pie, ancho completo, con línea separadora ---
  // Se calcula antes que el bloque central (aunque se dibuja después) porque
  // el bloque 2 necesita su borde superior (la línea) para centrarse en el
  // hueco que queda entre cabecera y pie.
  const yLinea = 512;
  const yPie = 555;

  // --- 2. Bloque central, dos columnas, números en la misma línea de base ---
  // Reparto vertical: la etiqueta y el número del héroe (el bloque más alto
  // de la tarjeta) se centran como una sola unidad en el hueco entre el fin
  // de la cabecera y la línea del pie, con el mismo aire arriba que abajo.
  // Antes yEtiquetas/yNumeros eran offsets fijos (300/440): dejaban 124 px
  // vacíos arriba y solo 72 px de aire abajo, pegando el precio al pie.
  const tamNumeroHeroe = 160;
  const tamEtiquetaHeroe = tamEtiquetaPara(tamNumeroHeroe);
  const alturaEtiqueta = tamEtiquetaHeroe * ALTURA_MAYUSCULA;
  const alturaNumeroHeroe = tamNumeroHeroe * ALTURA_MAYUSCULA;
  const alturaBloqueCentral = alturaEtiqueta + ESPACIO_ETIQUETA_NUMERO + alturaNumeroHeroe;
  const huecoCentral = yLinea - alturaCabecera;
  const aireVertical = (huecoCentral - alturaBloqueCentral) / 2;
  const yColumnaSuperior = alturaCabecera + aireVertical;
  const yEtiquetas = yColumnaSuperior + alturaEtiqueta;
  const yNumeros = yEtiquetas + ESPACIO_ETIQUETA_NUMERO + alturaNumeroHeroe;

  const xColIzquierda = MARGEN;
  const xColDerecha = 830;
  // Sin segundo combustible, el héroe ocupa el ancho completo: no hay
  // columna derecha que dejar vacía con un "no vende" huérfano (encargo del
  // primer rediseño, que sigue en pie).
  const bloqueHeroeSvg = bloquePrecio(
    xColIzquierda,
    yEtiquetas,
    yNumeros,
    heroe.clave,
    heroe.precio,
    tamNumeroHeroe,
    COLOR_MEJOR_TEXTO,
    40,
  );
  const bloqueSecundarioSvg = hayColumnaSecundaria
    ? bloquePrecio(xColDerecha, yEtiquetas, yNumeros, claveSecundaria, precioSecundario, 76, COLOR_PAPEL, 24)
    : '';
  const lineaSvg = `<line x1="${MARGEN}" y1="${yLinea}" x2="${ANCHO - MARGEN}" y2="${yLinea}" stroke="${COLOR_HAIR_DARK}" stroke-width="1.5" />`;
  const fechaTexto = tarjeta.actualizado ? `Actualizado el ${formatearFechaHora(tarjeta.actualizado)}` : '';
  const anchoFecha = fechaTexto ? anchoEstimado(fechaTexto, 24) : 0;
  const anchoRotuloDisponible = ANCHO_UTIL - (fechaTexto ? anchoFecha + 40 : 0);
  const estacionSvg = tarjeta.estacionMasBarata
    ? `<text x="${MARGEN}" y="${yPie}" font-family="Inter" font-weight="400" font-size="26" fill="${COLOR_MUTED_LIGHT}">${escaparXml(truncarConElipsis(`Más barata: ${tarjeta.estacionMasBarata}`, anchoRotuloDisponible, 26))}</text>`
    : '';
  const actualizadoSvg = fechaTexto
    ? `<text x="${ANCHO - MARGEN}" y="${yPie}" text-anchor="end" font-family="Inter" font-weight="400" font-size="24" fill="${COLOR_MUTED_LIGHT}">${escaparXml(fechaTexto)}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}">
    <rect width="${ANCHO}" height="${ALTO}" fill="${COLOR_FONDO}" />
    ${antetituloSvg}
    ${totemBandaSvg}
    ${bloqueHeroeSvg}
    ${bloqueSecundarioSvg}
    ${lineaSvg}
    ${estacionSvg}
    ${actualizadoSvg}
  </svg>`;
}

let fuentesCargadas: {
  fontFiles: string[];
  loadSystemFonts: false;
  defaultFontFamily: string;
} | null = null;
function opcionesFuente() {
  if (!fuentesCargadas) {
    fuentesCargadas = {
      fontFiles: [join(DIR_FUENTES, 'Inter.ttf'), join(DIR_FUENTES, 'JetBrainsMono.ttf')],
      loadSystemFonts: false,
      defaultFontFamily: 'Inter',
    };
  }
  return fuentesCargadas;
}

export function renderizarPng(tarjeta: Tarjeta): Buffer {
  const svg = renderizarSvg(tarjeta);
  const resvg = new Resvg(svg, {
    font: opcionesFuente(),
    background: COLOR_FONDO,
  });
  return resvg.render().asPng();
}

function partirTitulo(texto: string, anchoMaximo = ANCHO_UTIL, tamFuente = 52): string[] {
  const palabras = texto.split(' ');
  const lineas: string[] = [];
  let linea = '';
  for (const palabra of palabras) {
    const candidata = linea ? `${linea} ${palabra}` : palabra;
    if (linea && anchoEstimado(candidata, tamFuente) > anchoMaximo) {
      lineas.push(linea);
      linea = palabra;
    } else {
      linea = candidata;
    }
  }
  if (linea) lineas.push(linea);
  if (lineas.length <= 2) return lineas;
  return [lineas[0], truncarConElipsis(lineas.slice(1).join(' '), anchoMaximo, tamFuente)];
}

/** RF-106: una única composición para las seis editoriales. Las dos cifras
 * tienen exactamente el mismo tamaño y peso; ninguna actúa como héroe. */
export function renderizarSvgEditorial(tarjeta: TarjetaEditorial): string {
  const lineasTitulo = partirTitulo(tarjeta.titulo);
  const tituloSvg = lineasTitulo
    .map(
      (linea, indice) =>
        `<text x="${MARGEN}" y="${112 + indice * 61}" font-family="Inter" font-weight="700" font-size="52" fill="${COLOR_PAPEL}">${escaparXml(linea)}</text>`,
    )
    .join('\n    ');
  const yLinea = lineasTitulo.length === 1 ? 168 : 220;
  const yEtiqueta = yLinea + 68;
  const yCifra = yEtiqueta + 118;
  const yOrigen = yCifra + 47;
  const bloque = (x: number, etiqueta: string, cifra: string, origen: string) => `
    <text x="${x}" y="${yEtiqueta}" font-family="Inter" font-weight="600" font-size="25" letter-spacing="1.5" fill="${COLOR_MUTED_LIGHT}">${etiqueta.toUpperCase()}</text>
    <text x="${x}" y="${yCifra}" font-family="JetBrains Mono" font-weight="700" font-size="82" fill="${COLOR_MEJOR_TEXTO}">${escaparXml(cifra)}</text>
    <text x="${x}" y="${yOrigen}" font-family="Inter" font-weight="600" font-size="26" fill="${COLOR_PAPEL}">${escaparXml(truncarConElipsis(origen, 455, 26))}</text>`;
  const fecha = `Datos del ${formatearFechaHora(tarjeta.actualizado)}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}">
    <rect width="${ANCHO}" height="${ALTO}" fill="${COLOR_FONDO}" />
    ${tituloSvg}
    ${totemCompleto(ANCHO - MARGEN - 53, MARGEN, 1.27)}
    <line x1="${MARGEN}" y1="${yLinea}" x2="${ANCHO - MARGEN}" y2="${yLinea}" stroke="${COLOR_HAIR_DARK}" stroke-width="1.5" />
    ${bloque(MARGEN, 'Gasolina 95', tarjeta.gasolina95, tarjeta.origenGasolina95)}
    ${bloque(650, 'Diésel', tarjeta.diesel, tarjeta.origenDiesel)}
    <line x1="${MARGEN}" y1="512" x2="${ANCHO - MARGEN}" y2="512" stroke="${COLOR_HAIR_DARK}" stroke-width="1.5" />
    <text x="${MARGEN}" y="557" font-family="Inter" font-weight="700" font-size="28" fill="${COLOR_SIGNAL}">Surtidor</text>
    <text x="${ANCHO - MARGEN}" y="557" text-anchor="end" font-family="Inter" font-weight="400" font-size="24" fill="${COLOR_MUTED_LIGHT}">${escaparXml(fecha)}</text>
  </svg>`;
}

export function renderizarPngEditorial(tarjeta: TarjetaEditorial): Buffer {
  const resvg = new Resvg(renderizarSvgEditorial(tarjeta), {
    font: opcionesFuente(),
    background: COLOR_FONDO,
  });
  return resvg.render().asPng();
}

/** Ruta de la tarjeta genérica: la usan la portada, el 404 y cualquier página
 * que no sea zona, municipio ni uno de los seis documentos editoriales. */
export const RUTA_PREDETERMINADA = join(DIR_SALIDA, 'predeterminada.png');

/**
 * La tarjeta genérica (encargo aparte del rediseño de la portada): sin
 * precio, sin gasolinera, sin fecha. Un precio de una estación a 500 km es
 * inútil y engañoso en una imagen que no habla de ningún sitio concreto —y
 * esta tarjeta tiene que seguir siendo cierta dentro de seis meses, porque
 * una previsualización cacheada vive mucho más que un dato—, así que aquí no
 * hay nada que se pueda quedar desactualizado: solo la marca y la promesa.
 *
 * Composición deliberadamente distinta de las tarjetas con precio: centrada,
 * con aire. Esas compiten por meter datos legibles; esta no tiene datos que
 * meter, así que el aire es lo que distingue "esto es un producto" de
 * "esto es una captura de pantalla".
 */
export function renderizarSvgPredeterminada(): string {
  const centroX = ANCHO / 2;

  // Tótem completo, grande (docs/07-marca.md#Marca-reducida: por debajo de
  // 32 px se usa el reducido, este va muy por encima).
  const escalaTotem = 2.6; // 42×2.6 ≈ 109 px de ancho, sobre un lienzo de 1200
  const anchoTotem = 42 * escalaTotem;
  const altoTotem = 41 * escalaTotem; // de y=11 a y=52 en el viewBox de 64
  const totemX = centroX - anchoTotem / 2;
  const totemY = 122;
  const totemSvg = totemCompleto(totemX, totemY, escalaTotem);

  const marcaTextoY = totemY + altoTotem + 62;
  const marcaTextoSvg = `<text x="${centroX}" y="${marcaTextoY}" text-anchor="middle" font-family="Inter" font-weight="700" font-size="52" letter-spacing="0.5" fill="${COLOR_SIGNAL}">Surtidor</text>`;

  // Titular: el nombre ya lo dice la marca de arriba, así que aquí solo va
  // la promesa. Partido a mano en dos líneas (el texto es fijo, autoría
  // propia, no hace falta envolver en tiempo de build como los nombres de
  // municipio) y calibrado contra el render real.
  const tituloY1 = marcaTextoY + 92;
  const tituloY2 = tituloY1 + 66;
  const tituloSvg = `
    <text x="${centroX}" y="${tituloY1}" text-anchor="middle" font-family="Inter" font-weight="700" font-size="56" fill="${COLOR_PAPEL}">Precios de carburante</text>
    <text x="${centroX}" y="${tituloY2}" text-anchor="middle" font-family="Inter" font-weight="700" font-size="56" fill="${COLOR_PAPEL}">de toda España</text>`;

  // La promesa: lo que diferencia, no lo que es. --mejor-texto para
  // destacarla del titular (RF/encargo), sin ser un precio.
  const prometeY = tituloY2 + 74;
  const prometeSvg = `<text x="${centroX}" y="${prometeY}" text-anchor="middle" font-family="Inter" font-weight="600" font-size="29" fill="${COLOR_MEJOR_TEXTO}">Sin anuncios. Sin registro. Actualizado cada dos horas.</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}">
    <rect width="${ANCHO}" height="${ALTO}" fill="${COLOR_FONDO}" />
    ${totemSvg}
    ${marcaTextoSvg}
    ${tituloSvg}
    ${prometeSvg}
  </svg>`;
}

export function renderizarPngPredeterminada(): Buffer {
  const svg = renderizarSvgPredeterminada();
  const resvg = new Resvg(svg, {
    font: opcionesFuente(),
    background: COLOR_FONDO,
  });
  return resvg.render().asPng();
}

function escribir(tarjeta: Tarjeta): number {
  const png = renderizarPng(tarjeta);
  mkdirSync(dirname(tarjeta.rutaSalida), { recursive: true });
  writeFileSync(tarjeta.rutaSalida, png);
  return png.length;
}

const cifraPrecio = (valor: number | null, combustible: CombustibleCompartir) => valor === null ? mensajeAquiNoHay(combustible) : `${formatearPrecio(valor)} €/L`;
const cifraEuros = (valor: number | null, combustible: CombustibleCompartir) => valor === null ? mensajeAquiNoHay(combustible) : formatearEuros(valor);

export function construirTarjetasEditoriales(): TarjetaEditorial[] {
  const indice = JSON.parse(readFileSync(join(DIR_DATOS, 'indice.json'), 'utf-8')) as Indice;
  const indiceMunicipios = JSON.parse(
    readFileSync(join(RAIZ, 'datos-build', 'municipios.json'), 'utf-8'),
  ) as IndiceMunicipios;
  const datos = indice.provincias.map(
    ({ id }) => JSON.parse(readFileSync(join(DIR_DATOS, 'provincias', `${id}.json`), 'utf-8')) as DatosProvincia,
  );
  const agregados = calcularAgregadosEditoriales(datos, indice.zonas, indice.actualizado);
  const provincias = agregados.zonas.general.filter((zona) => zona.tipo === 'provincia');
  const fiscales = agregados.zonas.canariasCeutaMelilla.filter((zona) => zona.tipo === 'provincia');
  const rotulos = seleccionarRotulos(agregados.rotulos.general).incluidos;
  const capitales = calcularAgregadosCapitales(datos, indiceMunicipios, indice.actualizado).general;
  const minimos = calcularAgregadosMinimos(datos, indice.zonas, indiceMunicipios, indice.actualizado).nacional;
  const ruta = (slug: string) => join(DIR_SALIDA, 'hoy', `${slug}.png`);
  const tarjeta = (
    slug: string,
    titulo: string,
    gasolina95: { cifra: string; origen: string },
    diesel: { cifra: string; origen: string },
  ): TarjetaEditorial => ({
    rutaSalida: ruta(slug),
    titulo,
    gasolina95: gasolina95.cifra,
    origenGasolina95: gasolina95.origen,
    diesel: diesel.cifra,
    origenDiesel: diesel.origen,
    actualizado: indice.actualizado,
  });
  const precioConOrigen = (resultado: { valor: number | null; origen: string }, combustible: CombustibleCompartir) => ({
    cifra: cifraPrecio(resultado.valor, combustible),
    origen: resultado.origen,
  });
  const eurosConOrigen = (resultado: { valor: number | null; origen: string }, combustible: CombustibleCompartir) => ({
    cifra: cifraEuros(resultado.valor, combustible),
    origen: resultado.origen,
  });
  const origenMinimo = (combustible: CombustibleCompartir) => ({
    cifra: cifraPrecio(minimos[combustible].minimo, combustible),
    origen: minimos[combustible].origenes[0]
      ? nombreVisible(minimos[combustible].origenes[0].municipio, 'municipio')
      : 'Sin origen disponible',
  });

  return [
    tarjeta(
      'provincias-mas-baratas',
      'Las provincias más baratas para repostar',
      precioConOrigen(menorMedia(provincias, GASOLINA_COMPARTIR, (zona) => nombreVisible(zona.nombre, 'provincia')), GASOLINA_COMPARTIR),
      precioConOrigen(menorMedia(provincias, DIESEL_COMPARTIR, (zona) => nombreVisible(zona.nombre, 'provincia')), DIESEL_COMPARTIR),
    ),
    tarjeta(
      'cuanto-te-juegas',
      'Cuánto puedes ahorrar al llenar el depósito',
      eurosConOrigen(mayorCoste(provincias, GASOLINA_COMPARTIR), GASOLINA_COMPARTIR),
      eurosConOrigen(mayorCoste(provincias, DIESEL_COMPARTIR), DIESEL_COMPARTIR),
    ),
    tarjeta(
      'marcas-mas-baratas',
      'Qué marcas tienen los precios más bajos',
      precioConOrigen(menorMedia(rotulosQueVenden(rotulos, GASOLINA_COMPARTIR), GASOLINA_COMPARTIR, (rotulo) => rotulo.rotulo), GASOLINA_COMPARTIR),
      precioConOrigen(menorMedia(rotulosQueVenden(rotulos, DIESEL_COMPARTIR), DIESEL_COMPARTIR, (rotulo) => rotulo.rotulo), DIESEL_COMPARTIR),
    ),
    tarjeta(
      'capitales-de-provincia',
      'Qué capitales tienen el combustible más barato',
      precioConOrigen(menorMedia(capitales, GASOLINA_COMPARTIR, (capital) => nombreVisible(capital.nombre, 'municipio')), GASOLINA_COMPARTIR),
      precioConOrigen(menorMedia(capitales, DIESEL_COMPARTIR, (capital) => nombreVisible(capital.nombre, 'municipio')), DIESEL_COMPARTIR),
    ),
    tarjeta(
      'la-mas-barata-de-espana',
      'Dónde está el combustible más barato de España',
      origenMinimo(GASOLINA_COMPARTIR),
      origenMinimo(DIESEL_COMPARTIR),
    ),
    tarjeta(
      'canarias-ceuta-melilla',
      'Gasolina y diésel en Canarias, Ceuta y Melilla',
      precioConOrigen(menorMedia(fiscales, GASOLINA_COMPARTIR, (zona) => nombreVisible(zona.nombre, 'provincia')), GASOLINA_COMPARTIR),
      precioConOrigen(menorMedia(fiscales, DIESEL_COMPARTIR, (zona) => nombreVisible(zona.nombre, 'provincia')), DIESEL_COMPARTIR),
    ),
  ];
}

export function construirTarjetas(): Tarjeta[] {
  const indice = JSON.parse(readFileSync(join(DIR_DATOS, 'indice.json'), 'utf-8')) as Indice;
  const indiceMunicipios = JSON.parse(
    readFileSync(join(RAIZ, 'datos-build', 'municipios.json'), 'utf-8'),
  ) as IndiceMunicipios;
  const provinciasPorId = new Map(indice.provincias.map((p) => [p.id, p]));

  const datosPorProvincia = new Map<string, DatosProvincia>();
  const leerProvincia = (id: string): DatosProvincia => {
    let datos = datosPorProvincia.get(id);
    if (!datos) {
      datos = JSON.parse(readFileSync(join(DIR_DATOS, 'provincias', `${id}.json`), 'utf-8')) as DatosProvincia;
      datosPorProvincia.set(id, datos);
    }
    return datos;
  };

  const tarjetas: Tarjeta[] = [];

  // Una por zona (provincia o comunidad autónoma): RF-66 ampliado, ver
  // docs/06-roadmap.md#H11 y el encargo del hito. Misma fusión que usa
  // src/pages/[zona]/index.astro para no divergir sobre qué es "la zona".
  for (const zona of indice.zonas) {
    const datos = zona.provincias.map(leerProvincia);
    const { estaciones, actualizado } = fusionarProvincias(datos);
    const visibles = estacionesVisibles(estaciones);
    const barata = estacionMasBarata(visibles);
    tarjetas.push({
      rutaSalida: join(DIR_SALIDA, `${zona.id}.png`),
      antetitulo: nombreVisible(zona.nombre, zona.tipo),
      precioGasolina95: precioMinimo(visibles, GASOLINA_COMPARTIR),
      precioDiesel: precioMinimo(visibles, DIESEL_COMPARTIR),
      estacionMasBarata: barata?.rotulo ?? null,
      actualizado,
    });
  }

  // Una por municipio con página propia (RF-60): mismo umbral y misma fuente
  // de datos que src/pages/[provincia]/[municipio]/index.astro.
  const municipiosConPagina = indiceMunicipios.municipios.filter((m) => m.estaciones >= MINIMO_ESTACIONES_MUNICIPIO);
  for (const municipio of municipiosConPagina) {
    const provincia = provinciasPorId.get(municipio.provinciaId);
    if (!provincia) continue;
    const datos = leerProvincia(municipio.provinciaId);
    const { estaciones, actualizado } = fusionarProvincias([datos]);
    const visibles = estacionesVisibles(estaciones).filter((e) => e.municipio.trim() === municipio.nombre.trim());
    const barata = estacionMasBarata(visibles);
    const provinciaSlug = generarSlug(provincia.nombre);
    const municipioSlug = generarSlug(municipio.nombre);
    tarjetas.push({
      rutaSalida: join(DIR_SALIDA, provinciaSlug, `${municipioSlug}.png`),
      antetitulo: `${nombreVisible(municipio.nombre, 'municipio')}, ${nombreVisible(provincia.nombre, 'provincia')}`,
      precioGasolina95: precioMinimo(visibles, GASOLINA_COMPARTIR),
      precioDiesel: precioMinimo(visibles, DIESEL_COMPARTIR),
      estacionMasBarata: barata?.rotulo ?? null,
      actualizado,
    });
  }

  return tarjetas;
}

function main(): void {
  const limite = process.env.LIMITE_IMAGENES ? Number(process.env.LIMITE_IMAGENES) : Infinity;
  const todas = construirTarjetas();
  const tarjetas = Number.isFinite(limite) ? todas.slice(0, limite) : todas;

  const inicio = Date.now();
  let totalBytes = 0;
  for (const tarjeta of tarjetas) {
    totalBytes += escribir(tarjeta);
  }

  const editoriales = construirTarjetasEditoriales();
  for (const tarjeta of editoriales) {
    const png = renderizarPngEditorial(tarjeta);
    mkdirSync(dirname(tarjeta.rutaSalida), { recursive: true });
    writeFileSync(tarjeta.rutaSalida, png);
    totalBytes += png.length;
  }

  // La tarjeta genérica (portada, 404 y cualquier página que no sea de zona
  // ni de municipio): sin datos, así que no hace falta recalcularla por
  // zona/municipio, pero sí escribirla en cada build para que exista en
  // dist/ igual que el resto de public/og/.
  mkdirSync(dirname(RUTA_PREDETERMINADA), { recursive: true });
  writeFileSync(RUTA_PREDETERMINADA, renderizarPngPredeterminada());

  const ms = Date.now() - inicio;

  const mediaBytes = Math.round(totalBytes / tarjetas.length);
  console.log(
    `Imágenes de compartición: ${tarjetas.length} de ${todas.length} totales ` +
      `+ ${editoriales.length} editoriales + 1 genérica, ${ms} ms (${(ms / (tarjetas.length + editoriales.length)).toFixed(1)} ms/imagen), ` +
      `${mediaBytes} bytes de media, ${(totalBytes / 1024).toFixed(0)} KB en total.`,
  );
  if (Number.isFinite(limite) && limite < todas.length) {
    const msEstimado = (ms / tarjetas.length) * todas.length;
    const kbEstimado = (mediaBytes * todas.length) / 1024;
    console.log(
      `Extrapolado a las ${todas.length} páginas: ~${(msEstimado / 1000).toFixed(1)} s, ` +
        `~${(kbEstimado / 1024).toFixed(1)} MB, ${todas.length} ficheros nuevos en dist/.`,
    );
  }
}

// Guarda para poder importar renderizarSvg/construirTarjetas desde una
// prueba puntual sin disparar la generación completa como efecto lateral.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
