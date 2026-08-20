// Los selectores de zona (buscable, agrupado) y combustible comparten la
// cabecera de la hoja inferior. El de combustible es el control de más uso, y
// docs/05-diseno.md#Móvil lo pone siempre alcanzable en los tres estados de
// la hoja, también en escritorio. El filtro "solo abiertas ahora" ya no vive
// aquí: es una píldora en la cabecera de la lista (RF-82,
// src/componentes/Lista.ts), junto al contador que modifica. Persistencia
// de combustible/zona la hace src/logica/estado.ts al recibir cada
// actualización; aquí solo se dispara el cambio de estado.
//
// RF-80/RF-81: el selector permanece accesible en lista y ficha; las seis
// filas de la ficha también cambian el combustible activo.

import { actualizarEstado, obtenerEstado, suscribir, type EstadoApp } from '../logica/estado.ts';
import { combustibleDisponibleEnEvolucion, ETIQUETA, ETIQUETA_SELECTOR, ORDEN_COMBUSTIBLES } from '../logica/combustibles.ts';
import { mensajeAquiNoHay } from '../logica/mensajesAusencia.ts';
import { formatearPrecio, nombreVisible } from '../logica/formato.ts';
import { estacionesQueVenden } from '../logica/visibilidad.ts';
import { estacionesDeZona } from '../logica/zona.ts';
import { montarSelectorZona } from './SelectorZona.ts';
import type { ClavePrecio, ResumenProvincia, Zona } from '../../scripts/lib/tipos.ts';

/**
 * Monta los controles y los mantiene sincronizados con el estado. El DOM se
 * construye una sola vez: las actualizaciones posteriores solo tocan lo que
 * cambia, para no cerrar el panel de zona ni perder el foco cada vez que
 * algo más se recalcula.
 *
 * `contenedorIdentidad` trae de la navegación el selector de zona servido.
 * Se mueve a `contenedorRapidos` para compartir fila con combustible.
 * `catalogoProvincias` es `Indice.provincias`: de ahí sale el recuento de
 * estaciones de cada fila del panel de zona (docs/05-diseno.md#Selector-de-
 * zona), sumado por `estacionesDeZona`. No es una petición nueva: el índice
 * ya viaja siempre con la página.
 *
 * Devuelve `abrirSelector`, para que la página pueda abrir el panel de zona
 * directamente cuando no hay ninguna zona resuelta todavía (RF-49).
 */
export function montarControles(
  contenedorIdentidad: HTMLElement,
  contenedorRapidos: HTMLElement,
  zonas: Zona[],
  catalogoProvincias: ResumenProvincia[],
  municipioEvolucion: string | null = null,
): { abrirSelector: () => void } {
  const zonasOrdenadas = [...zonas].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  contenedorRapidos.innerHTML = '';

  // --- Selector de zona: enlaces servidos, mejorados en cliente (RF-91) ---
  const exigir = <T extends HTMLElement>(selector: string): T => {
    const elemento = document.querySelector<T>(selector);
    if (!elemento) throw new Error(`Falta ${selector} en la navegación de la aplicación.`);
    return elemento;
  };
  const botonZona = exigir<HTMLButtonElement>('#boton-zona');
  const nombreZonaSpan = exigir<HTMLElement>('#nombre-zona');
  const botonHoy = exigir<HTMLButtonElement>('#boton-hoy');
  const panelHoy = exigir<HTMLElement>('#panel-hoy');
  const fondoPanelHoy = exigir<HTMLElement>('#fondo-panel-hoy');
  const cerrarHoy = exigir<HTMLButtonElement>('#cerrar-panel-hoy');
  const enlaceZonaActual = contenedorIdentidad.querySelector<HTMLAnchorElement>('[data-zona-actual]');
  const nombreZonaActual = contenedorIdentidad.querySelector<HTMLElement>('[data-zona-actual-nombre]');
  const recuentoZonaActual = contenedorIdentidad.querySelector<HTMLElement>('[data-zona-actual-recuento]');
  const enlaceEvolucionZona = document.querySelector<HTMLAnchorElement>('[data-enlace-evolucion-zona]');
  const enlacesZona = Array.from(contenedorIdentidad.querySelectorAll<HTMLAnchorElement>('[data-zona-id]'));
  document.addEventListener('click', (evento) => {
    if (!panelHoy.hidden && !panelHoy.contains(evento.target as Node) && !botonHoy.contains(evento.target as Node)) {
      cerrarPanelHoy();
      botonHoy.focus();
    }
  });
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && !panelHoy.hidden) {
      cerrarPanelHoy();
      botonHoy.focus();
    }
  });

  function abrirPanelHoy(): void {
    selectorZona.cerrar(false);
    panelHoy.hidden = false;
    fondoPanelHoy.hidden = false;
    document.querySelector('.app')?.classList.add('app--hoy-abierto');
    document.body.classList.add('menu-hoy-abierto');
    botonHoy.setAttribute('aria-expanded', 'true');
    panelHoy.querySelector<HTMLAnchorElement>('a')?.focus();
  }

  function cerrarPanelHoy(): void {
    panelHoy.hidden = true;
    fondoPanelHoy.hidden = true;
    document.querySelector('.app')?.classList.remove('app--hoy-abierto');
    document.body.classList.remove('menu-hoy-abierto');
    botonHoy.setAttribute('aria-expanded', 'false');
  }

  const selectorZona = montarSelectorZona(contenedorIdentidad, {
    alElegirZona: (zonaId) => actualizarEstado({ zonaId }),
    antesDeAbrir: cerrarPanelHoy,
  });

  botonHoy.addEventListener('click', () => {
    if (panelHoy.hidden) abrirPanelHoy();
    else cerrarPanelHoy();
  });
  cerrarHoy.addEventListener('click', () => {
    cerrarPanelHoy();
    botonHoy.focus();
  });
  fondoPanelHoy.addEventListener('click', () => {
    cerrarPanelHoy();
    botonHoy.focus();
  });

  panelHoy.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Tab') return;
    const focables = Array.from(panelHoy.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
    const primero = focables[0];
    const ultimo = focables.at(-1);
    if (!primero || !ultimo) return;
    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  });

  // --- Selector de combustible desplegable (ADR-0027 / RF-120) ---
  const selectorCombustible = document.createElement('div');
  selectorCombustible.className = 'selector-combustible';

  const botonCombustible = document.createElement('button');
  botonCombustible.type = 'button';
  botonCombustible.className = 'selector-combustible__boton';
  botonCombustible.setAttribute('aria-expanded', 'false');
  botonCombustible.setAttribute('aria-controls', 'panel-combustible');
  const principalCombustible = document.createElement('strong');
  principalCombustible.className = 'selector-combustible__principal';
  const detalleCombustible = document.createElement('span');
  detalleCombustible.className = 'selector-combustible__detalle';
  const flechaCombustible = document.createElement('span');
  flechaCombustible.className = 'selector-combustible__flecha';
  flechaCombustible.setAttribute('aria-hidden', 'true');
  botonCombustible.append(principalCombustible, detalleCombustible, flechaCombustible);

  const panelCombustible = document.createElement('section');
  panelCombustible.id = 'panel-combustible';
  panelCombustible.className = 'panel-combustible';
  panelCombustible.setAttribute('role', 'radiogroup');
  panelCombustible.setAttribute('aria-label', 'Elegir combustible');
  panelCombustible.hidden = true;

  const botonesCombustible = new Map<ClavePrecio, HTMLButtonElement>();
  const preciosCombustible = new Map<ClavePrecio, HTMLElement>();
  for (const [titulo, claves] of [
    ['Habituales', ORDEN_COMBUSTIBLES.slice(0, 4)],
    ['Alternativos', ORDEN_COMBUSTIBLES.slice(4)],
  ] as const) {
    const grupo = document.createElement('div');
    grupo.className = 'panel-combustible__grupo';
    const encabezado = document.createElement('p');
    encabezado.className = 'panel-combustible__titulo';
    encabezado.textContent = titulo;
    grupo.append(encabezado);
    for (const clave of claves) {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'panel-combustible__opcion';
      boton.setAttribute('role', 'radio');
      const nombre = document.createElement('span');
      nombre.textContent = ETIQUETA[clave];
      const precio = document.createElement('strong');
      precio.className = 'panel-combustible__precio';
      boton.append(nombre, precio);
      boton.addEventListener('click', () => {
        actualizarEstado({ combustible: clave });
        panelCombustible.hidden = true;
        botonCombustible.setAttribute('aria-expanded', 'false');
        botonCombustible.focus();
      });
      grupo.append(boton);
      botonesCombustible.set(clave, boton);
      preciosCombustible.set(clave, precio);
    }
    if (titulo === 'Alternativos') {
      const nota = document.createElement('p');
      nota.className = 'panel-combustible__nota';
      nota.textContent = 'El GLP consume más volumen: su precio por litro no es comparable con los demás.';
      grupo.append(nota);
    }
    panelCombustible.append(grupo);
  }

  selectorCombustible.append(botonCombustible, panelCombustible);
  contenedorRapidos.append(contenedorIdentidad, selectorCombustible);

  botonCombustible.addEventListener('click', () => {
    const abrir = panelCombustible.hidden;
    panelCombustible.hidden = !abrir;
    botonCombustible.setAttribute('aria-expanded', String(abrir));
    if (abrir) botonesCombustible.get(obtenerEstado().combustible)?.focus();
  });
  document.addEventListener('click', (evento) => {
    if (panelCombustible.hidden || selectorCombustible.contains(evento.target as Node)) return;
    panelCombustible.hidden = true;
    botonCombustible.setAttribute('aria-expanded', 'false');
  });
  document.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Escape' || panelCombustible.hidden) return;
    panelCombustible.hidden = true;
    botonCombustible.setAttribute('aria-expanded', 'false');
    botonCombustible.focus();
  });

  function render(estado: EstadoApp): void {
    const zonaActual = zonasOrdenadas.find((z) => z.id === estado.zonaId);
    if (enlaceEvolucionZona) {
      enlaceEvolucionZona.hidden = !combustibleDisponibleEnEvolucion(estado.combustible);
    }
    if (enlaceEvolucionZona && zonaActual && combustibleDisponibleEnEvolucion(estado.combustible)) {
      const provinciaId = zonaActual.provincias.length === 1 ? zonaActual.provincias[0] : null;
      if (provinciaId) {
        const parametros = new URLSearchParams();
        if (municipioEvolucion) parametros.set('municipio', municipioEvolucion);
        parametros.set('combustible', estado.combustible);
        enlaceEvolucionZona.href = `/hoy/evolucion/${encodeURIComponent(provinciaId)}/?${parametros}`;
      } else enlaceEvolucionZona.href = '/hoy/evolucion/';
    }
    // RF-88: mientras se cargan los datos de una zona —incluido un cambio de
    // zona sin recargar (ADR-0016)— el botón lo dice, para que la interfaz
    // no se quede congelada sin señal mientras el resto (mapa, lista,
    // #tabla-zona) sigue mostrando la zona anterior a propósito.
    const nombreZonaVisible = zonaActual ? nombreVisible(zonaActual.nombre, zonaActual.tipo) : null;
    const nombreAmbito = estado.municipioNombre
      ? estado.ambitoAmpliado && estado.provinciaNombre
        ? `${estado.municipioNombre} · mostrando ${estado.provinciaNombre}`
        : estado.municipioNombre
      : nombreZonaVisible;
    nombreZonaSpan.textContent = estado.cargando
      ? 'Cargando…'
      : (nombreAmbito ?? estado.zonaId ?? 'Elige tu zona');
    botonZona.setAttribute('aria-label', nombreAmbito ? `Cambiar zona. Ámbito actual: ${nombreAmbito}` : 'Elegir zona');

    // La tarjeta superior del panel viene servida con la zona de la URL
    // inicial. En las páginas de zona el cambio ocurre en sitio (RF-88), así
    // que hay que mover también esta tarjeta; si no, URL, mapa y cabecera
    // avanzan mientras "Zona actual" se queda congelada en la primera zona.
    if (zonaActual && enlaceZonaActual && nombreZonaActual && recuentoZonaActual) {
      enlaceZonaActual.href = `/${zonaActual.id}/`;
      nombreZonaActual.textContent = nombreZonaVisible;
      const estaciones = estacionesDeZona(zonaActual, catalogoProvincias);
      recuentoZonaActual.replaceChildren(
        document.createTextNode(String(estaciones)),
        Object.assign(document.createElement('span'), { textContent: ' estaciones' }),
      );
    }

    for (const enlace of enlacesZona) {
      const activo = enlace.dataset.zonaId === estado.zonaId;
      if (activo) enlace.setAttribute('aria-current', 'page');
      else enlace.removeAttribute('aria-current');
    }

    for (const [clave, boton] of botonesCombustible) {
      const activo = clave === estado.combustible;
      boton.setAttribute('aria-checked', String(activo));
      boton.classList.toggle('panel-combustible__opcion--activa', activo);
      const municipales = estacionesQueVenden(estado.estacionesMunicipio, clave);
      const candidatas = estado.municipioNombre
        ? (municipales.length > 0 ? municipales : estacionesQueVenden(estado.estacionesProvincia, clave))
        : estacionesQueVenden(estado.estaciones, clave);
      const minimo = candidatas.reduce<number | null>((actual, estacion) => {
        const precio = estacion.precios[clave];
        return precio !== null && (actual === null || precio < actual) ? precio : actual;
      }, null);
      preciosCombustible.get(clave)!.textContent = minimo === null ? mensajeAquiNoHay(clave) : formatearPrecio(minimo);
    }

    const etiquetaSelector = ETIQUETA_SELECTOR[estado.combustible];
    principalCombustible.textContent = etiquetaSelector.principal;
    detalleCombustible.textContent = etiquetaSelector.detalle;
    botonCombustible.setAttribute('aria-label', `Cambiar combustible. Actual: ${ETIQUETA[estado.combustible]}`);

    // Rediseño Pencil 2026: la banda de combustible permanece fija también
    // con una estación seleccionada. Así se puede comparar otro combustible
    // sin cerrar la ficha, igual que en los frames de escritorio y móvil.
    contenedorRapidos.hidden = false;
  }

  render(obtenerEstado());
  suscribir(render);
  return { abrirSelector: () => selectorZona.abrir(botonZona) };
}
