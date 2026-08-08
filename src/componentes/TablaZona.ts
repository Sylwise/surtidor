// Repinta `.tabla-zona` en cliente al cambiar de zona sin recargar (RF-88,
// ADR-0016). El HTML servido lo genera src/pages/[zona]/index.astro (con
// <FilaPieTabla>/<FilaPieLista>/<PastillaMunicipio>) en el build; esto
// reproduce la MISMA estructura a mano con el DOM —mismas clases, mismo
// plegado a LIMITE_FILAS_VISIBLES_PIE/LIMITE_PASTILLAS_VISIBLES_PIE
// (RF-89)— sobre el mismo cálculo de src/logica/tablaZona.ts, para que las
// dos vías no diverjan. DOM API en vez de innerHTML con datos interpolados,
// mismo patrón que src/componentes/Lista.ts.

import {
  calcularTablaZona,
  bandaPrecioZona,
  hrefMunicipioZona,
  anchosTablaPrincipal,
  LIMITE_FILAS_VISIBLES_PIE,
  LIMITE_PASTILLAS_VISIBLES_PIE,
  type ResumenMunicipioZona,
} from '../logica/tablaZona.ts';
import { ETIQUETA, ORDEN_COMBUSTIBLES } from '../logica/combustibles.ts';
import { cajaDeTitulo, formatearFechaHora, formatearPrecio } from '../logica/formato.ts';
import type { ClavePrecio } from '../../scripts/lib/tipos.ts';
import type { Escala } from '../logica/escala.ts';
import type { EstacionZona } from '../logica/zona.ts';

function celdaColumna(texto: string): HTMLTableCellElement {
  const th = document.createElement('th');
  th.scope = 'col';
  th.textContent = texto;
  return th;
}

function precioOAusente(precio: number | null, banda: string | null): HTMLSpanElement {
  const span = document.createElement('span');
  if (precio === null || banda === null) {
    span.className = 'tabla-zona__ausente';
    span.textContent = 'no vende';
  } else {
    span.className = `precio precio--${banda}`;
    span.textContent = formatearPrecio(precio);
  }
  return span;
}

function celdaPrecio(clave: ClavePrecio, precio: number | null, escalas: Record<ClavePrecio, Escala>): HTMLTableCellElement {
  const td = document.createElement('td');
  td.append(precioOAusente(precio, precio === null ? null : bandaPrecioZona(escalas, clave, precio)));
  return td;
}

function construirColgroup(anchos: number[]): HTMLTableColElement[] {
  return anchos.map((ancho) => {
    const col = document.createElement('col');
    col.style.width = `${ancho}%`;
    return col;
  });
}

// Mismas columnas y misma banda que <FilaPieTabla>.
function filaTr(estacion: EstacionZona, multiProvincia: boolean, escalas: Record<ClavePrecio, Escala>): HTMLTableRowElement {
  const tr = document.createElement('tr');

  const cabeceraFila = document.createElement('th');
  cabeceraFila.scope = 'row';
  cabeceraFila.textContent = estacion.rotulo;
  tr.append(cabeceraFila);

  const direccion = document.createElement('td');
  direccion.textContent = cajaDeTitulo(estacion.direccion);
  const municipio = document.createElement('td');
  municipio.textContent = cajaDeTitulo(estacion.municipio);
  tr.append(direccion, municipio);

  if (multiProvincia) {
    const provincia = document.createElement('td');
    provincia.textContent = estacion.provinciaNombre;
    tr.append(provincia);
  }

  for (const clave of ORDEN_COMBUSTIBLES) tr.append(celdaPrecio(clave, estacion.precios[clave], escalas));
  return tr;
}

// Misma fila que <FilaPieLista>: número de orden, rótulo + secundario,
// precio de gasolina 95 en píldora. `secundario` lo decide el llamador
// (municipio [+ provincia] aquí, siempre municipio multiprovincia porque
// esta tabla solo la repinta una página de ZONA).
function filaLi(estacion: EstacionZona, puesto: number, multiProvincia: boolean, escalas: Record<ClavePrecio, Escala>): HTMLLIElement {
  const li = document.createElement('li');
  const fila = document.createElement('div');
  fila.className = 'fila fila--pie';

  const orden = document.createElement('span');
  orden.className = 'fila__orden';
  orden.textContent = String(puesto);

  const info = document.createElement('span');
  info.className = 'fila__info';
  const rotulo = document.createElement('span');
  rotulo.className = 'fila__rotulo';
  rotulo.textContent = estacion.rotulo;
  const secundario = document.createElement('span');
  secundario.className = 'fila__municipio';
  const municipio = cajaDeTitulo(estacion.municipio);
  secundario.textContent = multiProvincia ? `${municipio} · ${estacion.provinciaNombre}` : municipio;
  info.append(rotulo, secundario);

  const precio = estacion.precios.gasolina95e5;
  const precioEl = precioOAusente(precio, precio === null ? null : bandaPrecioZona(escalas, 'gasolina95e5', precio));
  precioEl.classList.add('fila__precio');

  fila.append(orden, info, precioEl);
  li.append(fila);
  return li;
}

function construirTabla(
  filas: EstacionZona[],
  multiProvincia: boolean,
  escalas: Record<ClavePrecio, Escala>,
  anchos: number[],
  conCabecera: boolean,
): HTMLDivElement {
  const scroll = document.createElement('div');
  scroll.className = 'pie-tabla tabla-zona__scroll';

  const tabla = document.createElement('table');
  tabla.className = 'tabla-zona__tabla';

  const colgroup = document.createElement('colgroup');
  colgroup.append(...construirColgroup(anchos));
  tabla.append(colgroup);

  if (conCabecera) {
    const filaCabecera = document.createElement('tr');
    filaCabecera.append(celdaColumna('Gasolinera'), celdaColumna('Dirección'), celdaColumna('Municipio'));
    if (multiProvincia) filaCabecera.append(celdaColumna('Provincia'));
    for (const clave of ORDEN_COMBUSTIBLES) filaCabecera.append(celdaColumna(ETIQUETA[clave]));
    const thead = document.createElement('thead');
    thead.append(filaCabecera);
    tabla.append(thead);
  }

  const tbody = document.createElement('tbody');
  for (const estacion of filas) tbody.append(filaTr(estacion, multiProvincia, escalas));
  tabla.append(tbody);

  scroll.append(tabla);
  return scroll;
}

function construirLista(filas: EstacionZona[], offsetPuesto: number, multiProvincia: boolean, escalas: Record<ClavePrecio, Escala>): HTMLOListElement {
  const ol = document.createElement('ol');
  ol.className = 'pie-filas';
  filas.forEach((estacion, indice) => ol.append(filaLi(estacion, offsetPuesto + indice + 1, multiProvincia, escalas)));
  return ol;
}

function pastilla(resumen: ResumenMunicipioZona, escalas: Record<ClavePrecio, Escala>): HTMLLIElement {
  const li = document.createElement('li');
  const href = hrefMunicipioZona(resumen);
  const enlace = document.createElement(href ? 'a' : 'span');
  enlace.className = href ? 'pastilla' : 'pastilla pastilla--sin-pagina';
  if (href) (enlace as HTMLAnchorElement).href = href;

  const nombre = document.createElement('span');
  nombre.className = 'pastilla__nombre';
  nombre.textContent = cajaDeTitulo(resumen.municipio);
  enlace.append(nombre);

  const precio = resumen.precioMinimo;
  enlace.append(precioOAusente(precio, precio === null ? null : bandaPrecioZona(escalas, 'gasolina95e5', precio)));

  li.append(enlace);
  return li;
}

function construirPastillas(resumen: ResumenMunicipioZona[], escalas: Record<ClavePrecio, Escala>): HTMLUListElement {
  const ul = document.createElement('ul');
  ul.className = 'pastillas';
  for (const item of resumen) ul.append(pastilla(item, escalas));
  return ul;
}

function detallesPlegable(textoControl: string, contenido: HTMLElement[]): HTMLDetailsElement {
  const details = document.createElement('details');
  details.className = 'pie-plegable';
  const summary = document.createElement('summary');
  summary.className = 'pie-plegable__control';
  summary.textContent = textoControl;
  details.append(summary, ...contenido);
  return details;
}

/** Repinta `seccion` (`#tabla-zona`) entera con los datos de la zona nueva.
 *  Mismos criterios que el frontmatter de [zona]/index.astro: las
 *  `LIMITE_TABLA_ZONA` más baratas con plegado a `LIMITE_FILAS_VISIBLES_PIE`
 *  (RF-89), y el resumen por municipio en pastillas plegado a
 *  `LIMITE_PASTILLAS_VISIBLES_PIE`. */
export function renderizarTablaZona(
  seccion: HTMLElement,
  zonaNombre: string,
  estaciones: EstacionZona[],
  actualizado: string | null,
): void {
  const { filas, multiProvincia, escalas, resumenMunicipios } = calcularTablaZona(estaciones);
  const anchos = anchosTablaPrincipal(multiProvincia);
  const filasPrimeras = filas.slice(0, LIMITE_FILAS_VISIBLES_PIE);
  const filasResto = filas.slice(LIMITE_FILAS_VISIBLES_PIE);
  const municipiosPrimeras = resumenMunicipios.slice(0, LIMITE_PASTILLAS_VISIBLES_PIE);
  const municipiosResto = resumenMunicipios.slice(LIMITE_PASTILLAS_VISIBLES_PIE);

  seccion.innerHTML = '';
  seccion.setAttribute('aria-label', `Las más baratas y los municipios de ${zonaNombre}`);

  const tituloPrincipal = document.createElement('h2');
  tituloPrincipal.className = 'tabla-zona__titulo';
  tituloPrincipal.textContent = `Las ${filas.length} más baratas de ${zonaNombre}`;
  seccion.append(tituloPrincipal);

  if (actualizado) {
    const actualizadoEl = document.createElement('p');
    actualizadoEl.className = 'tabla-zona__actualizado';
    actualizadoEl.textContent = `Actualizado: ${formatearFechaHora(actualizado)}.`;
    seccion.append(actualizadoEl);
  }

  seccion.append(construirTabla(filasPrimeras, multiProvincia, escalas, anchos, true));
  seccion.append(construirLista(filasPrimeras, 0, multiProvincia, escalas));

  if (filasResto.length > 0) {
    seccion.append(
      detallesPlegable(`Ver las ${filas.length}`, [
        construirTabla(filasResto, multiProvincia, escalas, anchos, false),
        construirLista(filasResto, LIMITE_FILAS_VISIBLES_PIE, multiProvincia, escalas),
      ]),
    );
  }

  const tituloMunicipios = document.createElement('h2');
  tituloMunicipios.className = 'tabla-zona__titulo tabla-zona__titulo--municipios';
  tituloMunicipios.textContent = `Precios por municipio en ${zonaNombre}`;
  seccion.append(tituloMunicipios);

  seccion.append(construirPastillas(municipiosPrimeras, escalas));

  if (municipiosResto.length > 0) {
    seccion.append(detallesPlegable(`+ ${municipiosResto.length} más`, [construirPastillas(municipiosResto, escalas)]));
  }
}
