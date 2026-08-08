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

// RF-92 (ADR-0017): un bloque de enlaces reales, no una tabla — mismo
// tratamiento visual que .lista__filas/.fila (docs/05-diseno.md#La-lista-es-
// el-contenido), pero con <a>, no <button>. Solo entran los municipios con
// página propia (hrefMunicipioZona !== null): no hay adónde mandar a los
// demás. Reproduce a mano la misma estructura que src/pages/[zona]/index.astro
// genera con JSX en el build, para que las dos vías no diverjan (RF-88).
function construirEnlacesMunicipios(
  resumen: ResumenMunicipioZona[],
  multiProvincia: boolean,
  escalas: Record<ClavePrecio, Escala>,
  zonaNombre: string,
): HTMLDivElement {
  const bloque = document.createElement('div');
  bloque.className = 'enlaces-bloque';

  const titulo = document.createElement('h2');
  titulo.className = 'enlaces-bloque__titulo micro';
  titulo.textContent = `Municipios de ${zonaNombre}`;
  bloque.append(titulo);

  const filas = document.createElement('ul');
  filas.className = 'enlaces-bloque__filas';

  for (const resumenMunicipio of resumen) {
    const href = hrefMunicipioZona(resumenMunicipio);
    if (!href) continue;

    const fila = document.createElement('a');
    fila.className = 'enlaces-bloque__fila';
    fila.href = href;

    const info = document.createElement('span');
    info.className = 'enlaces-bloque__info';
    const nombre = document.createElement('span');
    nombre.className = 'enlaces-bloque__nombre';
    nombre.textContent = cajaDeTitulo(resumenMunicipio.municipio);
    info.append(nombre);
    if (multiProvincia) {
      const provincia = document.createElement('span');
      provincia.className = 'enlaces-bloque__provincia';
      provincia.textContent = resumenMunicipio.provinciaNombre;
      info.append(provincia);
    }
    fila.append(info);

    if (resumenMunicipio.precioMinimo !== null) {
      const precio = document.createElement('span');
      precio.className = `enlaces-bloque__precio precio precio--${bandaPrecioZona(escalas, 'gasolina95e5', resumenMunicipio.precioMinimo)}`;
      precio.textContent = formatearPrecio(resumenMunicipio.precioMinimo);
      fila.append(precio);
    }

    const li = document.createElement('li');
    li.append(fila);
    filas.append(li);
  }

  bloque.append(filas);
  return bloque;
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
  seccion.append(construirEnlacesMunicipios(resumenMunicipios, multiProvincia, escalas, zonaNombre));
}
