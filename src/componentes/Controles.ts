// Selector de zona (buscable, agrupado) vive en la cabecera superior
// (RF-32): se toca una vez por sesión. Selector de combustible vive en la
// cabecera de la hoja inferior (RF-30): es el control de más uso, y
// docs/05-diseno.md#Móvil lo pone siempre alcanzable en los tres estados de
// la hoja, también en escritorio. El filtro "solo abiertas ahora" ya no vive
// aquí: es una píldora en la cabecera de la lista (RF-82,
// src/componentes/Lista.ts), junto al contador que modifica. Persistencia
// de combustible/zona la hace src/logica/estado.ts al recibir cada
// actualización; aquí solo se dispara el cambio de estado.
//
// RF-80: las pestañas solo se muestran en estado de lista. Con una estación
// seleccionada (estado de ficha) desaparecen, porque la ficha ya lista los
// cuatro precios y el mismo control quedaría duplicado; las cuatro filas de
// la ficha son las que cambian el combustible activo entonces (RF-81).

import { actualizarEstado, obtenerEstado, suscribir, type EstadoApp } from '../logica/estado.ts';
import { ETIQUETA, ETIQUETA_CORTA, ORDEN_COMBUSTIBLES } from '../logica/combustibles.ts';
import { montarSelectorZona } from './SelectorZona.ts';
import type { ClavePrecio, ResumenProvincia, Zona } from '../../scripts/lib/tipos.ts';

/**
 * Monta los controles y los mantiene sincronizados con el estado. El DOM se
 * construye una sola vez: las actualizaciones posteriores solo tocan lo que
 * cambia, para no cerrar el panel de zona ni perder el foco cada vez que
 * algo más se recalcula.
 *
 * `contenedorIdentidad` recibe el selector de zona.
 * `contenedorRapidos` recibe el selector de combustible; se oculta entero en
 * estado de ficha (RF-80).
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
  _catalogoProvincias: ResumenProvincia[],
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

  // --- Selector de combustible: pestañas, un toque (RF-30) ---
  const tabsCombustible = document.createElement('div');
  tabsCombustible.className = 'controles__combustible';
  tabsCombustible.setAttribute('role', 'group');
  tabsCombustible.setAttribute('aria-label', 'Combustible');

  const botonesCombustible = new Map<ClavePrecio, HTMLButtonElement>();
  for (const clave of ORDEN_COMBUSTIBLES) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'controles__pestana';
    boton.textContent = ETIQUETA_CORTA[clave];
    boton.setAttribute('aria-label', ETIQUETA[clave]);
    boton.addEventListener('click', () => actualizarEstado({ combustible: clave }));
    tabsCombustible.append(boton);
    botonesCombustible.set(clave, boton);
  }

  contenedorRapidos.append(tabsCombustible);

  function render(estado: EstadoApp): void {
    const zonaActual = zonasOrdenadas.find((z) => z.id === estado.zonaId);
    if (enlaceEvolucionZona && zonaActual) {
      const provinciaId = zonaActual.provincias.length === 1 ? zonaActual.provincias[0] : null;
      enlaceEvolucionZona.href = provinciaId
        ? '/hoy/evolucion/' + encodeURIComponent(provinciaId) + '/'
        : '/hoy/evolucion/';
    }
    // RF-88: mientras se cargan los datos de una zona —incluido un cambio de
    // zona sin recargar (ADR-0016)— el botón lo dice, para que la interfaz
    // no se quede congelada sin señal mientras el resto (mapa, lista,
    // #tabla-zona) sigue mostrando la zona anterior a propósito.
    const enlaceZonaActual = zonaActual
      ? enlacesZona.find((enlace) => enlace.dataset.zonaId === zonaActual.id)
      : null;
    nombreZonaSpan.textContent = estado.cargando
      ? 'Cargando…'
      : (zonaActual?.nombre ?? estado.zonaId ?? 'Elige tu zona');
    nombreZonaSpan.dataset.zonaEtiqueta = estado.cargando
      ? 'Cargando…'
      : (enlaceZonaActual?.dataset.zonaEtiqueta ?? zonaActual?.nombre ?? estado.zonaId ?? 'Zona');
    botonZona.setAttribute('aria-label', zonaActual ? `Cambiar zona. Zona actual: ${zonaActual.nombre}` : 'Elegir zona');

    for (const enlace of enlacesZona) {
      const activo = enlace.dataset.zonaId === estado.zonaId;
      if (activo) enlace.setAttribute('aria-current', 'page');
      else enlace.removeAttribute('aria-current');
    }

    for (const [clave, boton] of botonesCombustible) {
      const activo = clave === estado.combustible;
      boton.setAttribute('aria-pressed', String(activo));
      boton.classList.toggle('controles__pestana--activa', activo);
    }

    // Rediseño Pencil 2026: la banda de combustible permanece fija también
    // con una estación seleccionada. Así se puede comparar otro combustible
    // sin cerrar la ficha, igual que en los frames de escritorio y móvil.
    contenedorRapidos.hidden = false;
  }

  render(obtenerEstado());
  suscribir(render);
  return { abrirSelector: () => selectorZona.abrir(botonZona) };
}
