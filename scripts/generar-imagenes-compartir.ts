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
import { cajaDeTitulo, formatearFechaHora, formatearPrecio } from '../src/logica/formato.ts';
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
// ver su METADATA): el ancho de un número se puede calcular exacto en vez de
// estimarlo, a diferencia del texto en Inter (proporcional).
const AVANCE_MONO = 0.6;

/** Qué combustible es el héroe de la imagen: gasolina 95, el combustible por
 *  defecto de toda la aplicación (COMBUSTIBLE_POR_DEFECTO en
 *  src/logica/estado.ts); si esa zona o municipio no lo vende, diésel pasa a
 *  héroe y gasolina 95 baja a la fila secundaria. No verificado con datos
 *  reales de hoy: las 1160 zonas y municipios con página venden los dos —
 *  mismo caso ya señalado para "no vende" en H11, ver ADR-0011. */
function elegirHeroe(
  tarjeta: Tarjeta,
): { clave: 'gasolina95e5' | 'gasoleoA'; precio: number | null } {
  if (tarjeta.precioGasolina95 !== null) return { clave: 'gasolina95e5', precio: tarjeta.precioGasolina95 };
  if (tarjeta.precioDiesel !== null) return { clave: 'gasoleoA', precio: tarjeta.precioDiesel };
  return { clave: 'gasolina95e5', precio: null };
}

/** (a) El precio del combustible principal: el héroe de la imagen. Enorme,
 *  monoespaciada, --mejor-texto — nunca --mejor de relleno, que sobre
 *  --petrol da ~2:1 de contraste (ver tokens.css). "€/L" pequeño al lado,
 *  posicionado con el ancho exacto del número (JetBrains Mono es
 *  monoespaciada de verdad, así que no hace falta medir el render). */
function heroPrecio(yBaseline: number, precio: number | null): string {
  if (precio === null) {
    return `<text x="${MARGEN}" y="${yBaseline}" font-family="Inter" font-weight="400" font-size="56" fill="${COLOR_NO_VENDE}">no vende</text>`;
  }
  const tamFuente = 176;
  const numero = formatearPrecio(precio);
  const anchoNumero = numero.length * tamFuente * AVANCE_MONO;
  const xUnidad = MARGEN + anchoNumero + 16;
  return `
    <text x="${MARGEN}" y="${yBaseline}" font-family="JetBrains Mono" font-weight="700" font-size="${tamFuente}" fill="${COLOR_MEJOR_TEXTO}">${numero}</text>
    <text x="${xUnidad}" y="${yBaseline}" font-family="Inter" font-weight="600" font-size="40" fill="${COLOR_MUTED_LIGHT}">€/L</text>`;
}

/** (c) El otro combustible: etiqueta a la izquierda, número alineado a la
 *  derecha en tabular — una fila secundaria, nunca compite con el héroe. */
function filaSecundaria(yBaseline: number, etiqueta: string, precio: number | null): string {
  const etiquetaSvg = `<text x="${MARGEN}" y="${yBaseline}" font-family="Inter" font-weight="600" font-size="30" fill="${COLOR_MUTED_LIGHT}">${escaparXml(etiqueta)}</text>`;
  if (precio === null) {
    return `${etiquetaSvg}
    <text x="${ANCHO - MARGEN}" y="${yBaseline}" text-anchor="end" font-family="Inter" font-weight="400" font-size="30" fill="${COLOR_NO_VENDE}">no vende</text>`;
  }
  const texto = `${formatearPrecio(precio)} €/L`;
  return `${etiquetaSvg}
    <text x="${ANCHO - MARGEN}" y="${yBaseline}" text-anchor="end" font-family="JetBrains Mono" font-weight="700" font-size="38" fill="${COLOR_PAPEL}">${texto}</text>`;
}

// Tótem reducido: SOLO el cartel, sin poste ni peana (docs/07-marca.md#Marca
// reducida). Por debajo de 32 px el tótem completo deja de leerse como un
// cartel de precio y se lee como el pie de una copa — pasó aquí mismo, con
// el tótem a unos 19×10 px. Mismas coordenadas que marca/icono.svg, con el
// poste y la peana (los otros dos <rect>) sencillamente sin dibujar.
function totemReducido(x: number, y: number, escala: number): string {
  return `<rect x="${x + 11 * escala}" y="${y + 11 * escala}" width="${42 * escala}" height="${23 * escala}" rx="${6 * escala}" fill="${COLOR_SIGNAL}" />`;
}

export function renderizarSvg(tarjeta: Tarjeta): string {
  const antetituloSvg = `<text x="${MARGEN}" y="96" font-family="Inter" font-weight="600" font-size="28" letter-spacing="0.5" fill="${COLOR_MUTED_LIGHT}">${escaparXml(truncarConElipsis(tarjeta.antetitulo, ANCHO_UTIL, 28))}</text>`;

  const heroe = elegirHeroe(tarjeta);
  const claveSecundaria = heroe.clave === 'gasolina95e5' ? 'gasoleoA' : 'gasolina95e5';
  const precioSecundario = claveSecundaria === 'gasolina95e5' ? tarjeta.precioGasolina95 : tarjeta.precioDiesel;

  const etiquetaHeroeSvg = `<text x="${MARGEN}" y="158" font-family="Inter" font-weight="600" font-size="26" letter-spacing="1.5" fill="${COLOR_MUTED_LIGHT}">${escaparXml(ETIQUETA[heroe.clave].toUpperCase())}</text>`;

  // (d) + (e) en la misma fila, para que ocupen todo el ancho en vez de dos
  // líneas cortas y sueltas por la izquierda (espacio muerto en el cuadrante
  // inferior derecho, encargo del rediseño): rótulo a la izquierda, fecha
  // del dato alineada a la derecha. La fecha es imprescindible (sin ella una
  // imagen de hace una semana parece de hoy), así que su ancho se reserva
  // primero y el rótulo se trunca con lo que quede.
  const yPie = 486;
  const fechaTexto = tarjeta.actualizado ? `Actualizado el ${formatearFechaHora(tarjeta.actualizado)}` : '';
  const anchoFecha = fechaTexto ? anchoEstimado(fechaTexto, 24) : 0;
  const anchoRotuloDisponible = ANCHO_UTIL - (fechaTexto ? anchoFecha + 40 : 0);
  const estacionSvg = tarjeta.estacionMasBarata
    ? `<text x="${MARGEN}" y="${yPie}" font-family="Inter" font-weight="400" font-size="28" fill="${COLOR_MUTED_LIGHT}">${escaparXml(truncarConElipsis(`Más barata: ${tarjeta.estacionMasBarata}`, anchoRotuloDisponible, 28))}</text>`
    : '';
  const actualizadoSvg = fechaTexto
    ? `<text x="${ANCHO - MARGEN}" y="${yPie}" text-anchor="end" font-family="Inter" font-weight="400" font-size="24" fill="${COLOR_MUTED_LIGHT}">${escaparXml(fechaTexto)}</text>`
    : '';

  // Marca, en una esquina (encargo del rediseño): tótem reducido + "Surtidor"
  // en --signal. Zona segura de 60 px del borde inferior (WhatsApp/Telegram
  // recortan según el cliente) — aquí con 66 px, algo más holgado.
  const marcaSvg = `
    ${totemReducido(MARGEN, ALTO - 89, 0.62)}
    <text x="${MARGEN + 46}" y="${ALTO - 66}" font-family="Inter" font-weight="700" font-size="26" fill="${COLOR_SIGNAL}">Surtidor</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}">
    <rect width="${ANCHO}" height="${ALTO}" fill="${COLOR_FONDO}" />
    ${antetituloSvg}
    ${etiquetaHeroeSvg}
    ${heroPrecio(340, heroe.precio)}
    ${filaSecundaria(424, ETIQUETA[claveSecundaria], precioSecundario)}
    ${estacionSvg}
    ${actualizadoSvg}
    ${marcaSvg}
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
    const { estaciones, actualizado } = fusionarProvincias(datos);
    const visibles = estacionesVisibles(estaciones);
    const barata = estacionMasBarata(visibles);
    tarjetas.push({
      rutaSalida: join(DIR_SALIDA, `${zona.id}.png`),
      antetitulo: zona.nombre,
      precioGasolina95: precioMinimo(visibles, 'gasolina95e5'),
      precioDiesel: precioMinimo(visibles, 'gasoleoA'),
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
      // (b) Municipio y provincia, antetítulo: municipio en caja de título
      // (RF-86, es prosa), provincia verbatim (RF-76, es como el catálogo).
      antetitulo: `${cajaDeTitulo(municipio.nombre)}, ${provincia.nombre}`,
      precioGasolina95: precioMinimo(visibles, 'gasolina95e5'),
      precioDiesel: precioMinimo(visibles, 'gasoleoA'),
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
