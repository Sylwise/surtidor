// Lista de estaciones ordenada de menor a mayor precio del combustible activo,
// sincronizada con la selección (RF-20, RF-21).
//
// El HTML que sirve el build (AppInteractiva.astro, RF-89) ya trae esta
// misma lista pintada para los cuatro combustibles; en cuanto este módulo
// monta, la sustituye por la versión reactiva de aquí (mismo cálculo,
// src/logica/listaEstaciones.ts, para que las dos vías no diverjan) y a
// partir de ahí manda ella.

import { actualizarEstado, obtenerEstado, suscribir, type EstadoApp } from '../logica/estado.ts';
import { calcularListaCombustible } from '../logica/listaEstaciones.ts';
import { resumenMunicipiosDe, hrefMunicipioZona } from '../logica/municipios.ts';
import { estaAbierta } from '../../scripts/lib/horario.ts';
import { ETIQUETA } from '../logica/combustibles.ts';
import { cajaDeTitulo, formatearPrecio } from '../logica/formato.ts';

export interface EnlaceMunicipio {
  href: string;
  nombre: string;
  precioMinimo: number | null;
}

/** Enlaces de cierre para una página de MUNICIPIO (RF-90): fijos, no se
 *  recalculan con el estado (el municipio de la página no cambia). En una
 *  página de ZONA no se pasan: se calculan en cada render a partir de
 *  `estado.estaciones`, para que un cambio de zona en sitio (RF-88,
 *  ADR-0016) los actualice solo. */
export interface EnlacesEstaticos {
  /** RF-90: enlace de vuelta a la página de la provincia entera. */
  volverA: { href: string; nombre: string };
  /** RF-65/RF-74: municipios vecinos, con página propia. */
  vecinos: EnlaceMunicipio[];
}

function crearAviso(texto: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.className = 'lista__aviso';
  p.textContent = texto;
  return p;
}

// RF-82: el filtro de abiertas ya no tiene fila propia, es una píldora junto
// al contador que modifica ("MÁS BARATAS · 72 · Abiertas",
// docs/05-diseno.md#Los-dos-estados-de-la-hoja). Reutiliza el aspecto de
// pestaña de Controles.ts (misma familia visual de píldora) en vez de crear
// un componente de chip aparte.
function crearCabecera(soloAbiertas: boolean, contador: number): HTMLDivElement {
  const cabecera = document.createElement('div');
  cabecera.className = 'lista__cabecera';

  const titulo = document.createElement('h2');
  titulo.className = 'lista__titulo';
  titulo.textContent = 'Más baratas';

  const contadorEl = document.createElement('span');
  contadorEl.className = 'lista__contador';
  contadorEl.textContent = String(contador);

  const filtro = document.createElement('button');
  filtro.type = 'button';
  filtro.className = 'controles__pestana lista__filtro';
  filtro.classList.toggle('controles__pestana--activa', soloAbiertas);
  filtro.setAttribute('aria-pressed', String(soloAbiertas));
  filtro.setAttribute('aria-label', 'Filtrar solo estaciones abiertas ahora');
  filtro.textContent = 'Abiertas';
  filtro.addEventListener('click', () => actualizarEstado({ soloAbiertas: !soloAbiertas }));

  cabecera.append(titulo, document.createTextNode(' · '), contadorEl, document.createTextNode(' · '), filtro);
  return cabecera;
}

function crearPildoraEnlace(enlace: EnlaceMunicipio, textoAlternativo?: string): HTMLLIElement {
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.className = 'enlace-municipio';
  a.href = enlace.href;

  const nombre = document.createElement('span');
  nombre.textContent = textoAlternativo ?? enlace.nombre;
  a.append(nombre);

  if (enlace.precioMinimo !== null) {
    const precio = document.createElement('span');
    precio.className = 'enlace-municipio__precio';
    precio.textContent = formatearPrecio(enlace.precioMinimo);
    a.append(precio);
  }

  li.append(a);
  return li;
}

// RF-89 ("los enlaces a otros municipios cierran la lista") + RF-90 (enlace
// de vuelta a la provincia). En una página de zona, `enlacesEstaticos` es
// `undefined` y los municipios salen de las estaciones ya cargadas —así que
// un cambio de zona en sitio (ADR-0016) los renueva solo, sin plumbing
// aparte—. En una página de municipio, `enlacesEstaticos` los fija de una
// vez porque el municipio de la página nunca cambia.
function crearEnlacesCierre(estado: EstadoApp, enlacesEstaticos?: EnlacesEstaticos): HTMLElement | null {
  const items: HTMLLIElement[] = [];

  if (enlacesEstaticos) {
    items.push(
      crearPildoraEnlace(
        { href: enlacesEstaticos.volverA.href, nombre: enlacesEstaticos.volverA.nombre, precioMinimo: null },
        `Ver toda ${enlacesEstaticos.volverA.nombre}`,
      ),
    );
    for (const vecino of enlacesEstaticos.vecinos) items.push(crearPildoraEnlace(vecino));
  } else {
    const municipios = resumenMunicipiosDe(estado.estaciones);
    for (const resumen of municipios) {
      const href = hrefMunicipioZona(resumen);
      if (!href) continue;
      items.push(
        crearPildoraEnlace({ href, nombre: cajaDeTitulo(resumen.municipio), precioMinimo: resumen.precioMinimo }),
      );
    }
  }

  if (items.length === 0) return null;

  const nav = document.createElement('nav');
  nav.className = 'lista__enlaces';
  nav.setAttribute('aria-label', 'Otros municipios');
  const ul = document.createElement('ul');
  ul.className = 'lista__enlaces-filas';
  ul.append(...items);
  nav.append(ul);
  return nav;
}

/** Monta la lista en `contenedor` y la mantiene sincronizada con el estado.
 *  Devuelve una función para desuscribirse, por si el llamador la necesita. */
export function montarLista(contenedor: HTMLElement, enlacesEstaticos?: EnlacesEstaticos): () => void {
  function render(estado: EstadoApp): void {
    contenedor.innerHTML = '';
    contenedor.setAttribute('aria-busy', estado.cargando ? 'true' : 'false');

    if (estado.cargando && estado.estaciones.length === 0) {
      contenedor.append(crearAviso('Cargando estaciones…'));
      return;
    }

    if (!estado.cargando && estado.error && estado.estaciones.length === 0) {
      contenedor.append(crearAviso('No se han podido cargar los datos. Usa «Reintentar» arriba.'));
      return;
    }

    // RF-49: sin zona elegida todavía (recién llegado, sin nada guardado en
    // localStorage), no hay que confundirlo con RF-42 (zona sin ese
    // combustible): aquí no hay zona en absoluto.
    if (!estado.cargando && estado.zonaId === null) {
      contenedor.append(crearAviso('Elige una zona arriba para ver sus estaciones.'));
      return;
    }

    // RF-89: mismo cálculo (puesto, precio, banda) que el HTML servido en el
    // build para los cuatro combustibles a la vez.
    const ordenadas = calcularListaCombustible(estado.estaciones, estado.combustible);

    // RF-42: ninguna estación de la zona vende el combustible elegido.
    if (ordenadas.length === 0) {
      contenedor.append(crearCabecera(estado.soloAbiertas, 0));
      const nombreZona = estado.zonaNombre || 'esta zona';
      contenedor.append(
        crearAviso(`Ninguna estación de ${nombreZona} vende ${ETIQUETA[estado.combustible].toLowerCase()}.`)
      );
      const enlaces = crearEnlacesCierre(estado, enlacesEstaticos);
      if (enlaces) contenedor.append(enlaces);
      return;
    }

    const visibles = estado.soloAbiertas
      ? ordenadas.filter((f) => estaAbierta(f.estacion.horario, new Date()))
      : ordenadas;

    contenedor.append(crearCabecera(estado.soloAbiertas, visibles.length));

    // Filtro sin resultados.
    if (visibles.length === 0) {
      const aviso = crearAviso('Ninguna abierta ahora.');
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'lista__quitar-filtro';
      boton.textContent = 'Quitar filtro';
      boton.addEventListener('click', () => actualizarEstado({ soloAbiertas: false }));
      aviso.append(document.createTextNode(' '), boton);
      contenedor.append(aviso);
      const enlaces = crearEnlacesCierre(estado, enlacesEstaticos);
      if (enlaces) contenedor.append(enlaces);
      return;
    }

    const filas = document.createElement('ol');
    filas.className = 'lista__filas';

    for (const { estacion, puesto, precio, banda } of visibles) {
      const abierta = estaAbierta(estacion.horario, new Date());

      const item = document.createElement('li');
      const fila = document.createElement('button');
      fila.type = 'button';
      fila.className = 'fila';
      if (!abierta) fila.classList.add('fila--cerrada');
      fila.setAttribute('aria-pressed', String(estacion.id === estado.estacionId));
      if (estacion.id === estado.estacionId) fila.classList.add('fila--activa');

      const orden = document.createElement('span');
      orden.className = 'fila__orden';
      orden.textContent = String(puesto);

      const info = document.createElement('span');
      info.className = 'fila__info';
      const rotulo = document.createElement('span');
      rotulo.className = 'fila__rotulo';
      rotulo.textContent = estacion.rotulo;
      // RF-89: la dirección va donde antes iba el municipio.
      const direccion = document.createElement('span');
      direccion.className = 'fila__direccion';
      direccion.textContent = cajaDeTitulo(estacion.direccion);
      info.append(rotulo, direccion);

      const precioEl = document.createElement('span');
      precioEl.className = `fila__precio precio precio--${banda}`;
      precioEl.textContent = formatearPrecio(precio);

      fila.append(orden, info, precioEl);
      fila.addEventListener('click', () => actualizarEstado({ estacionId: estacion.id }));
      item.append(fila);
      filas.append(item);
    }

    contenedor.append(filas);

    const enlaces = crearEnlacesCierre(estado, enlacesEstaticos);
    if (enlaces) contenedor.append(enlaces);
  }

  render(obtenerEstado());
  return suscribir(render);
}
