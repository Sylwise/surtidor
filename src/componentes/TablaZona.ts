// Repinta `.tabla-zona` en cliente al cambiar de zona sin recargar (RF-88,
// ADR-0016). El HTML servido lo genera src/pages/[zona]/index.astro con JSX
// en el build; esto reproduce la misma estructura a mano con el DOM, sobre
// el mismo cálculo de src/logica/tablaZona.ts, para que las dos vías no
// diverjan. DOM API en vez de innerHTML con datos interpolados, mismo
// patrón que src/componentes/Lista.ts.

import { calcularTablaZona, bandaPrecioZona, hrefMunicipioZona, type ResumenMunicipioZona } from '../logica/tablaZona.ts';
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

function celdaPrecio(clave: ClavePrecio, precio: number | null, escalas: Record<ClavePrecio, Escala>): HTMLTableCellElement {
  const td = document.createElement('td');
  const span = document.createElement('span');
  if (precio === null) {
    span.className = 'tabla-zona__ausente';
    span.textContent = 'no vende';
  } else {
    span.className = `precio precio--${bandaPrecioZona(escalas, clave, precio)}`;
    span.textContent = formatearPrecio(precio);
  }
  td.append(span);
  return td;
}

function construirTablaPrincipal(
  filas: EstacionZona[],
  multiProvincia: boolean,
  escalas: Record<ClavePrecio, Escala>,
): HTMLDivElement {
  const scroll = document.createElement('div');
  scroll.className = 'tabla-zona__scroll';

  const tabla = document.createElement('table');
  tabla.className = 'tabla-zona__tabla';

  const filaCabecera = document.createElement('tr');
  filaCabecera.append(celdaColumna('Gasolinera'), celdaColumna('Dirección'), celdaColumna('Municipio'));
  if (multiProvincia) filaCabecera.append(celdaColumna('Provincia'));
  for (const clave of ORDEN_COMBUSTIBLES) filaCabecera.append(celdaColumna(ETIQUETA[clave]));
  const thead = document.createElement('thead');
  thead.append(filaCabecera);
  tabla.append(thead);

  const tbody = document.createElement('tbody');
  for (const estacion of filas) {
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
    tbody.append(tr);
  }
  tabla.append(tbody);
  scroll.append(tabla);
  return scroll;
}

function construirTablaMunicipios(
  resumen: ResumenMunicipioZona[],
  multiProvincia: boolean,
  escalas: Record<ClavePrecio, Escala>,
): HTMLDivElement {
  const scroll = document.createElement('div');
  scroll.className = 'tabla-zona__scroll';

  const tabla = document.createElement('table');
  tabla.className = 'tabla-zona__tabla';

  const filaCabecera = document.createElement('tr');
  filaCabecera.append(celdaColumna('Municipio'));
  if (multiProvincia) filaCabecera.append(celdaColumna('Provincia'));
  filaCabecera.append(celdaColumna('Estaciones'), celdaColumna('Gasolina 95 desde'));
  const thead = document.createElement('thead');
  thead.append(filaCabecera);
  tabla.append(thead);

  const tbody = document.createElement('tbody');
  for (const resumenMunicipio of resumen) {
    const tr = document.createElement('tr');

    const cabeceraFila = document.createElement('th');
    cabeceraFila.scope = 'row';
    const href = hrefMunicipioZona(resumenMunicipio);
    if (href) {
      const enlace = document.createElement('a');
      enlace.href = href;
      enlace.textContent = cajaDeTitulo(resumenMunicipio.municipio);
      cabeceraFila.append(enlace);
    } else {
      cabeceraFila.textContent = cajaDeTitulo(resumenMunicipio.municipio);
    }
    tr.append(cabeceraFila);

    if (multiProvincia) {
      const provincia = document.createElement('td');
      provincia.textContent = resumenMunicipio.provinciaNombre;
      tr.append(provincia);
    }

    const estaciones = document.createElement('td');
    estaciones.textContent = String(resumenMunicipio.estaciones);
    tr.append(estaciones);

    tr.append(celdaPrecio('gasolina95e5', resumenMunicipio.precioMinimo, escalas));
    tbody.append(tr);
  }
  tabla.append(tbody);
  scroll.append(tabla);
  return scroll;
}

/** Repinta `seccion` (`#tabla-zona`) entera con los datos de la zona nueva.
 *  Mismos criterios que el frontmatter: las `LIMITE_TABLA_ZONA` más baratas
 *  y el resumen por municipio (src/logica/tablaZona.ts). */
export function renderizarTablaZona(
  seccion: HTMLElement,
  zonaNombre: string,
  estaciones: EstacionZona[],
  actualizado: string | null,
): void {
  const { filas, multiProvincia, escalas, resumenMunicipios } = calcularTablaZona(estaciones);

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

  seccion.append(construirTablaPrincipal(filas, multiProvincia, escalas));

  const tituloMunicipios = document.createElement('h2');
  tituloMunicipios.className = 'tabla-zona__titulo tabla-zona__titulo--municipios';
  tituloMunicipios.textContent = `Precios por municipio en ${zonaNombre}`;
  seccion.append(tituloMunicipios);

  seccion.append(construirTablaMunicipios(resumenMunicipios, multiProvincia, escalas));
}
