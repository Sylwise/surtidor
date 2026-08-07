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
import { ETIQUETA } from '../src/logica/combustibles.ts';
import { cajaDeTitulo, formatearPrecio } from '../src/logica/formato.ts';
import { generarSlug } from './lib/slug.ts';
import {
  MINIMO_ESTACIONES_MUNICIPIO,
  type DatosProvincia,
  type Indice,
  type IndiceMunicipios,
} from './lib/tipos.ts';

const RAIZ = process.cwd();
const DIR_DATOS = join(RAIZ, 'public', 'data');
const DIR_SALIDA = join(RAIZ, 'public', 'og');
const DIR_FUENTES = join(RAIZ, 'scripts', 'lib', 'fuentes');

const ANCHO = 1200;
const ALTO = 630;
const MARGEN = 64;
const ANCHO_UTIL = ANCHO - MARGEN * 2;

// Colores: solo tokens de src/estilos/tokens.css, copiados literalmente
// (este script corre en Node, no puede leer custom properties de CSS).
const COLOR_FONDO = '#16323B'; // --petrol
const COLOR_PAPEL = '#EDEFEF'; // --paper
const COLOR_MEJOR = '#046A38'; // --mejor
const COLOR_SIGNAL = '#F5B921'; // --signal
const COLOR_MUTED_LIGHT = 'rgba(255,255,255,0.58)'; // --muted-light
const COLOR_NO_VENDE = 'rgba(255,255,255,0.28)'; // --no-vende

interface Tarjeta {
  rutaSalida: string;
  nombre: string;
  precioGasolina95: number | null;
  precioDiesel: number | null;
  estacionMasBarata: string | null;
}

function escaparXml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Ancho aproximado de una línea en Inter Bold, en px: 0,58 em por carácter,
 * una estimación deliberadamente generosa (Inter real promedia más cerca de
 * 0,52-0,55) para no arriesgarse a que un nombre largo desborde el lienzo.
 * Calibrado a ojo contra el render real de los 20 municipios y zonas más
 * largos de España (ver el informe de medición del hito H11).
 */
function anchoEstimado(texto: string, tamFuente: number): number {
  return texto.length * tamFuente * 0.58;
}

const TAMANOS_TITULO = [64, 56, 48, 42, 36, 32, 28];

/** Envuelve el nombre de zona o municipio en 1 o 2 líneas, con el tamaño de
 *  fuente más grande de TAMANOS_TITULO que quepa. España tiene municipios de
 *  más de 50 caracteres ("Alquería de la Condesa/Alqueria de la Comtessa
 *  (l')"), así que una sola línea a tamaño fijo no basta. */
function ajustarTitulo(nombre: string): { lineas: string[]; tamFuente: number } {
  for (const tam of TAMANOS_TITULO) {
    if (anchoEstimado(nombre, tam) <= ANCHO_UTIL) {
      return { lineas: [nombre], tamFuente: tam };
    }
  }
  // No cabe en una línea ni al tamaño mínimo: se parte en dos por el espacio
  // más cercano al centro del texto.
  const centro = Math.floor(nombre.length / 2);
  let corte = -1;
  for (let distancia = 0; distancia < centro; distancia += 1) {
    if (nombre[centro + distancia] === ' ') {
      corte = centro + distancia;
      break;
    }
    if (nombre[centro - distancia] === ' ') {
      corte = centro - distancia;
      break;
    }
  }
  if (corte === -1) {
    // Sin espacios (raro): se deja en una línea al tamaño mínimo, aunque
    // desborde un poco. Es preferible a partir una palabra por la mitad.
    return { lineas: [nombre], tamFuente: TAMANOS_TITULO.at(-1)! };
  }
  const linea1 = nombre.slice(0, corte).trim();
  const linea2 = nombre.slice(corte + 1).trim();
  const anchoPeor = Math.max(linea1.length, linea2.length);
  const tam = TAMANOS_TITULO.find((t) => anchoPeor * t * 0.58 <= ANCHO_UTIL) ?? TAMANOS_TITULO.at(-1)!;
  return { lineas: [linea1, linea2], tamFuente: tam };
}

/** La estación más barata de gasolina 95 (el combustible por defecto de toda
 *  la aplicación); si ninguna de las visibles la vende, se cae a diésel. */
function estacionMasBarata(estaciones: EstacionZona[]): EstacionZona | null {
  if (estaciones.length === 0) return null;
  const porGasolina95 = estaciones.filter((e) => e.precios.gasolina95e5 !== null);
  const candidatas = porGasolina95.length > 0 ? porGasolina95 : estaciones.filter((e) => e.precios.gasoleoA !== null);
  if (candidatas.length === 0) return null;
  const clave = porGasolina95.length > 0 ? 'gasolina95e5' : 'gasoleoA';
  return [...candidatas].sort((a, b) => (a.precios[clave] as number) - (b.precios[clave] as number))[0];
}

function precioMinimo(estaciones: EstacionZona[], clave: 'gasolina95e5' | 'gasoleoA'): number | null {
  let minimo: number | null = null;
  for (const estacion of estaciones) {
    const precio = estacion.precios[clave];
    if (precio !== null && (minimo === null || precio < minimo)) minimo = precio;
  }
  return minimo;
}

// JetBrains Mono es monoespaciada de verdad (avance de 0,6 em por carácter,
// ver su METADATA): el ancho de la píldora se puede calcular exacto en vez
// de estimarlo, a diferencia del título en Inter (proporcional).
const AVANCE_MONO = 0.6;

function filaPrecio(y: number, etiqueta: string, precio: number | null): string {
  const yEtiqueta = y;
  const yPrecio = y + 66;
  const etiquetaSvg = `<text x="${MARGEN}" y="${yEtiqueta}" font-family="Inter" font-weight="600" font-size="20" letter-spacing="2" fill="${COLOR_MUTED_LIGHT}">${escaparXml(etiqueta.toUpperCase())}</text>`;

  if (precio === null) {
    return `
      ${etiquetaSvg}
      <text x="${MARGEN}" y="${yPrecio}" font-family="Inter" font-weight="400" font-size="34" fill="${COLOR_NO_VENDE}">no vende</text>`;
  }

  // El precio va en --mejor (RF/encargo H11), pero nunca como color de texto
  // directo sobre --petrol: esa pareja da ~2:1 de contraste, muy por debajo
  // del 4,5:1 de RNF-22. docs/05-diseno.md ya resuelve esto en el resto de
  // la interfaz con el mismo color — la más barata es "fondo --mejor, texto
  // blanco, a más de 7:1"— así que aquí se repite el mismo patrón: una
  // píldora rellena de --mejor con el número en --paper encima, en vez de
  // inventar una regla de color nueva solo para esta imagen.
  const texto = `${formatearPrecio(precio)} €/L`;
  const tamFuente = 64;
  const padH = 22;
  const padV = 16;
  const anchoTexto = texto.length * tamFuente * AVANCE_MONO;
  const pillX = MARGEN - padH;
  const pillY = yPrecio - tamFuente * 0.78 - padV;
  const pillAncho = anchoTexto + padH * 2;
  const pillAlto = tamFuente * 0.78 + padV * 2;
  return `
    ${etiquetaSvg}
    <rect x="${pillX}" y="${pillY}" width="${pillAncho}" height="${pillAlto}" rx="14" fill="${COLOR_MEJOR}" />
    <text x="${MARGEN}" y="${yPrecio}" font-family="JetBrains Mono" font-weight="700" font-size="${tamFuente}" fill="${COLOR_PAPEL}">${texto}</text>`;
}

// Tótem en miniatura: la misma silueta de marca/icono.svg (docs/07-marca.md),
// como trazos SVG propios — no hace falta rasterizar un PNG aparte para esto.
function totemMini(x: number, y: number): string {
  const e = 0.4; // escala: el tótem original es un viewBox de 64
  return `
    <g transform="translate(${x}, ${y}) scale(${e})" fill="${COLOR_SIGNAL}">
      <rect x="11" y="11" width="42" height="23" rx="6" />
      <rect x="28" y="34" width="8" height="12" />
      <rect x="19" y="46" width="26" height="6" rx="3" />
    </g>`;
}

export function renderizarSvg(tarjeta: Tarjeta): string {
  const { lineas, tamFuente } = ajustarTitulo(tarjeta.nombre);
  const yBase = lineas.length === 1 ? 150 : 118;
  const lineHeight = tamFuente * 1.12;
  const tituloSvg = lineas
    .map(
      (linea, i) =>
        `<text x="${MARGEN}" y="${yBase + i * lineHeight}" font-family="Inter" font-weight="700" font-size="${tamFuente}" fill="${COLOR_PAPEL}">${escaparXml(linea)}</text>`,
    )
    .join('\n');

  const yPrecios = lineas.length === 1 ? 260 : 300;

  const estacionSvg = tarjeta.estacionMasBarata
    ? `<text x="${MARGEN}" y="${yPrecios + 205}" font-family="Inter" font-weight="400" font-size="26" fill="${COLOR_MUTED_LIGHT}">Más barata: ${escaparXml(tarjeta.estacionMasBarata)}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}">
    <rect width="${ANCHO}" height="${ALTO}" fill="${COLOR_FONDO}" />
    ${tituloSvg}
    ${filaPrecio(yPrecios, ETIQUETA.gasolina95e5, tarjeta.precioGasolina95)}
    ${filaPrecio(yPrecios + 100, ETIQUETA.gasoleoA, tarjeta.precioDiesel)}
    ${estacionSvg}
    ${totemMini(MARGEN, ALTO - 64)}
    <text x="${MARGEN + 40}" y="${ALTO - 40}" font-family="Inter" font-weight="700" font-size="24" fill="${COLOR_SIGNAL}">Surtidor</text>
  </svg>`;
}

let fuentesCargadas: { fontFiles: string[]; loadSystemFonts: false; defaultFontFamily: string } | null = null;
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
  const resvg = new Resvg(svg, { font: opcionesFuente(), background: COLOR_FONDO });
  return resvg.render().asPng();
}

function escribir(tarjeta: Tarjeta): number {
  const png = renderizarPng(tarjeta);
  mkdirSync(dirname(tarjeta.rutaSalida), { recursive: true });
  writeFileSync(tarjeta.rutaSalida, png);
  return png.length;
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
    const { estaciones } = fusionarProvincias(datos);
    const visibles = estacionesVisibles(estaciones);
    const barata = estacionMasBarata(visibles);
    tarjetas.push({
      rutaSalida: join(DIR_SALIDA, `${zona.id}.png`),
      nombre: zona.nombre,
      precioGasolina95: precioMinimo(visibles, 'gasolina95e5'),
      precioDiesel: precioMinimo(visibles, 'gasoleoA'),
      estacionMasBarata: barata?.rotulo ?? null,
    });
  }

  // Una por municipio con página propia (RF-60): mismo umbral y misma fuente
  // de datos que src/pages/[provincia]/[municipio]/index.astro.
  const municipiosConPagina = indiceMunicipios.municipios.filter((m) => m.estaciones >= MINIMO_ESTACIONES_MUNICIPIO);
  for (const municipio of municipiosConPagina) {
    const provincia = provinciasPorId.get(municipio.provinciaId);
    if (!provincia) continue;
    const datos = leerProvincia(municipio.provinciaId);
    const { estaciones } = fusionarProvincias([datos]);
    const visibles = estacionesVisibles(estaciones).filter((e) => e.municipio.trim() === municipio.nombre.trim());
    const barata = estacionMasBarata(visibles);
    const provinciaSlug = generarSlug(provincia.nombre);
    const municipioSlug = generarSlug(municipio.nombre);
    tarjetas.push({
      rutaSalida: join(DIR_SALIDA, provinciaSlug, `${municipioSlug}.png`),
      nombre: cajaDeTitulo(municipio.nombre),
      precioGasolina95: precioMinimo(visibles, 'gasolina95e5'),
      precioDiesel: precioMinimo(visibles, 'gasoleoA'),
      estacionMasBarata: barata?.rotulo ?? null,
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
  const ms = Date.now() - inicio;

  const mediaBytes = Math.round(totalBytes / tarjetas.length);
  console.log(
    `Imágenes de compartición: ${tarjetas.length} de ${todas.length} totales, ` +
      `${ms} ms (${(ms / tarjetas.length).toFixed(1)} ms/imagen), ` +
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
