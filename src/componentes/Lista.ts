// Lista de estaciones ordenada de menor a mayor precio del combustible activo,
// sincronizada con la selección (RF-20, RF-21).
//
// El HTML que sirve el build (AppInteractiva.astro, RF-89) ya trae esta
// misma lista pintada para los seis combustibles; en cuanto este módulo
// monta, la sustituye por la versión reactiva de aquí (mismo cálculo,
// src/logica/listaEstaciones.ts, para que las dos vías no diverjan) y a
// partir de ahí manda ella.

import { actualizarEstado, obtenerEstado, suscribir, type EstadoApp } from '../logica/estado.ts';
import { calcularListaCombustible } from '../logica/listaEstaciones.ts';
import { crearEscala, explicacionEscalaSuprimida } from '../logica/escala.ts';
import { resumenMunicipiosDe, hrefMunicipioZona, calcularEnlacesMunicipio } from '../logica/municipios.ts';
import { estaAbierta } from '../../scripts/lib/horario.ts';
import { ETIQUETA, etiquetaCombustibleEnFrase } from '../logica/combustibles.ts';
import { cajaDeTitulo, formatearPrecio, nombreVisible } from '../logica/formato.ts';
import { compararPorDistancia, distanciaKm, formatearDistancia } from '../logica/cercania.ts';
import type { Precios } from '../../scripts/lib/tipos.ts';

export interface EnlaceMunicipio {
  href: string;
  nombre: string;
  /** Los seis combustibles (RF-94/RF-120): quien pinta la fila elige cuál
   *  enseñar según el combustible activo, nunca fijo a uno solo. */
  precios: Precios;
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
function crearCabecera(estado: EstadoApp, contador: number): HTMLDivElement {
  const cabecera = document.createElement('div');
  cabecera.className = 'lista__cabecera';
  cabecera.classList.toggle('lista__cabecera--con-ubicacion', Boolean(estado.ubicacionUsuario));

  const titulo = document.createElement('h2');
  titulo.className = 'lista__titulo';
  if (estado.ubicacionUsuario) {
    titulo.classList.add('lista__ordenacion');
    titulo.setAttribute('aria-label', 'Orden de las estaciones');
    const opcionesOrden = [['precio', 'Baratas'], ['distancia', 'Cercanas']] as const;
    for (const [indice, [valor, texto]] of opcionesOrden.entries()) {
      if (indice > 0) {
        const separador = document.createElement('span');
        separador.className = 'lista__ordenacion-separador';
        separador.setAttribute('aria-hidden', 'true');
        separador.textContent = '/';
        titulo.append(separador);
      }
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'lista__ordenacion-opcion';
      boton.classList.toggle('lista__ordenacion-opcion--activa', estado.ordenLista === valor);
      boton.setAttribute('aria-pressed', String(estado.ordenLista === valor));
      boton.textContent = texto;
      boton.addEventListener('click', () => actualizarEstado({ ordenLista: valor }));
      titulo.append(boton);
    }
  } else {
    titulo.textContent = 'Más baratas';
  }

  const contadorEl = document.createElement('span');
  contadorEl.className = 'lista__contador';
  contadorEl.textContent = String(contador);

  const filtro = document.createElement('button');
  filtro.type = 'button';
  filtro.className = 'controles__pestana lista__filtro';
  filtro.classList.toggle('controles__pestana--activa', estado.soloAbiertas);
  filtro.setAttribute('aria-pressed', String(estado.soloAbiertas));
  filtro.setAttribute('aria-label', 'Filtrar solo estaciones abiertas ahora');
  filtro.textContent = 'Solo abiertas';
  filtro.addEventListener('click', () => actualizarEstado({ soloAbiertas: !estado.soloAbiertas }));

  cabecera.append(titulo, document.createTextNode(' · '), contadorEl, document.createTextNode(' · '), filtro);
  return cabecera;
}

// Mismo tratamiento de fila que las páginas de índice (ADR-0017,
// .enlaces-bloque en interfaz.css): las píldoras de ancho variable que tuvo
// primero RF-89 no alineaban con 130 municipios.
function crearFilaEnlace(
  enlace: { href: string; nombre: string },
  // `undefined`: fila sin precio en absoluto (el "Ver toda la provincia" de
  // RF-90, que no es un municipio). `null`: es un municipio pero no vende
  // el combustible activo (RF-94/RF-23: "no vende", nunca el precio de
  // otro). Un número: el precio real.
  precio: number | null | undefined,
  claseBanda: string,
  textoAlternativo?: string,
): HTMLLIElement {
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.className = 'enlaces-bloque__fila';
  a.href = enlace.href;

  const info = document.createElement('span');
  info.className = 'enlaces-bloque__info';
  const nombre = document.createElement('span');
  nombre.className = 'enlaces-bloque__nombre';
  nombre.textContent = textoAlternativo ?? enlace.nombre;
  info.append(nombre);
  a.append(info);

  if (precio !== undefined) {
    const precioEl = document.createElement('span');
    if (precio === null) {
      precioEl.className = 'enlaces-bloque__precio enlaces-bloque__precio--ausente';
      precioEl.textContent = 'no vende';
    } else {
      precioEl.className = `enlaces-bloque__precio precio${claseBanda}`;
      precioEl.textContent = formatearPrecio(precio);
    }
    a.append(precioEl);
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
  let entradas: { href: string; nombre: string; precios: Precios }[];
  let volverA: { href: string; nombre: string } | null = null;
  let titulo: string;

  if (enlacesEstaticos) {
    volverA = enlacesEstaticos.volverA;
    entradas = enlacesEstaticos.vecinos;
    titulo = `Otros municipios de ${enlacesEstaticos.volverA.nombre}`;
  } else {
    entradas = resumenMunicipiosDe(estado.estaciones)
      .map((resumen) => {
        const href = hrefMunicipioZona(resumen);
        return href ? { href, nombre: nombreVisible(resumen.municipio, 'municipio'), precios: resumen.precios } : null;
      })
      .filter((entrada): entrada is { href: string; nombre: string; precios: Precios } => entrada !== null);
    titulo = `Municipios de ${estado.zonaNombre || 'esta zona'}`;
  }

  if (entradas.length === 0 && !volverA) return null;

  // RF-94: precio y banda de color resueltos al combustible activo, no
  // fijos a gasolina 95 — misma función que pinta el HTML servido
  // (AppInteractiva.astro), para que las dos vías no diverjan.
  const filas = calcularEnlacesMunicipio(entradas, estado.combustible);

  const items: HTMLLIElement[] = [];
  if (volverA) {
    items.push(crearFilaEnlace(volverA, undefined, '', `Ver toda ${volverA.nombre}`));
  }
  for (const fila of filas) {
    items.push(crearFilaEnlace(fila, fila.precio, fila.banda ? ` precio--${fila.banda}` : ''));
  }

  const nav = document.createElement('nav');
  nav.className = 'enlaces-bloque';
  nav.setAttribute('aria-label', 'Otros municipios');
  const h2 = document.createElement('h2');
  h2.className = 'enlaces-bloque__titulo micro';
  h2.textContent = titulo;
  nav.append(h2);
  const ul = document.createElement('ul');
  ul.className = 'enlaces-bloque__filas';
  ul.append(...items);
  nav.append(ul);
  return nav;
}

/** Monta la lista en `contenedor` y la mantiene sincronizada con el estado.
 *  Devuelve una función para desuscribirse, por si el llamador la necesita. */
export function montarLista(contenedor: HTMLElement, enlacesEstaticos?: EnlacesEstaticos): () => void {
  const portalCabecera = document.getElementById('lista-cabecera');
  const ponerCabecera = (cabecera: HTMLElement): void => {
    if (portalCabecera) portalCabecera.replaceChildren(cabecera);
    else contenedor.append(cabecera);
  };

  function render(estado: EstadoApp): void {
    contenedor.innerHTML = '';
    portalCabecera?.replaceChildren();
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
    // build para los seis combustibles a la vez.
    const ordenadas = calcularListaCombustible(estado.estaciones, estado.combustible);
    const escala = crearEscala(ordenadas.map(({ precio }) => precio));

    // RF-42: ninguna estación de la zona vende el combustible elegido.
    if (ordenadas.length === 0) {
      ponerCabecera(crearCabecera(estado, 0));
      const nombreZona = estado.zonaNombre || 'esta zona';
      contenedor.append(
        crearAviso(`Ninguna estación de ${nombreZona} vende ${etiquetaCombustibleEnFrase(estado.combustible)}.`)
      );
      const enlaces = crearEnlacesCierre(estado, enlacesEstaticos);
      if (enlaces) contenedor.append(enlaces);
      return;
    }

    const visiblesPorApertura = estado.soloAbiertas
      ? ordenadas.filter((f) => estaAbierta(f.estacion.horario, new Date()))
      : ordenadas;
    const visibles = estado.ordenLista === 'distancia' && estado.ubicacionUsuario
      ? [...visiblesPorApertura].sort((a, b) =>
          compararPorDistancia(estado.ubicacionUsuario!, a.estacion, b.estacion))
      : visiblesPorApertura;

    ponerCabecera(crearCabecera(estado, visibles.length));

    // RF-123: una sola línea, sin tarjeta ni fondo, antes de las filas. El
    // selector territorial conserva el municipio como intención y muestra
    // en paralelo el ámbito efectivo de provincia (Controles.ts).
    if (estado.ambitoAmpliado && estado.municipioNombre && estado.provinciaNombre) {
      const avisoAmbito = crearAviso(
        `En ${estado.municipioNombre} no hay ${ETIQUETA[estado.combustible]} · se muestran las ${ordenadas.length} de ${estado.provinciaNombre}`,
      );
      avisoAmbito.classList.add('lista__aviso--ambito');
      contenedor.append(avisoAmbito);
    }

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

    const explicacionEscala = explicacionEscalaSuprimida(escala);
    if (explicacionEscala) {
      const avisoEscala = crearAviso(explicacionEscala);
      avisoEscala.classList.add('lista__aviso--escala');
      contenedor.append(avisoEscala);
    }

    const filas = document.createElement('ol');
    filas.className = 'lista__filas';

    // La ficha ya representa por completo la estación activa. Repetirla como
    // primera fila crea dos blancos interactivos para la misma acción y
    // rompe la continuidad del ranking mostrada en los frames (la lista
    // debe continuar desde el siguiente puesto).
    const filasVisibles = estado.estacionId
      ? visibles.filter(({ estacion }) => estacion.id !== estado.estacionId)
      : visibles;

    for (const { estacion, puesto, precio, banda } of filasVisibles) {
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
      if (estado.ordenLista === 'distancia' && estado.ubicacionUsuario) {
        orden.classList.add('fila__orden--distancia');
        orden.textContent = formatearDistancia(distanciaKm(estado.ubicacionUsuario, estacion));
      } else {
        orden.textContent = String(puesto);
      }

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
