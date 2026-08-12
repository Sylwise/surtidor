// Selector de zona (buscable, agrupado) vive en la cabecera superior
// (RF-32): se toca una vez por sesión. Selector de combustible vive en la
// cabecera de la hoja inferior (RF-30): es el control de más uso, y
// docs/05-diseno.md#Móvil lo pone siempre alcanzable en los tres estados de
// la hoja, también en escritorio. El filtro "solo abiertas ahora" ya no vive
// aquí: es una píldora en la cabecera de la lista (RF-82,
// src/componentes/Lista.ts), junto al contador que modifica. Los litros a
// repostar (RF-33) tampoco: se mudaron a la ficha de estación
// (src/componentes/Totem.ts), junto al cálculo de ahorro, que es el único
// sitio donde significa algo. Persistencia de combustible/zona la hace
// src/logica/estado.ts al recibir cada actualización; aquí solo se dispara
// el cambio de estado.
//
// RF-80: las pestañas solo se muestran en estado de lista. Con una estación
// seleccionada (estado de ficha) desaparecen, porque la ficha ya lista los
// cuatro precios y el mismo control quedaría duplicado; las cuatro filas de
// la ficha son las que cambian el combustible activo entonces (RF-81).

import { actualizarEstado, obtenerEstado, suscribir, type EstadoApp } from '../logica/estado.ts';
import { ETIQUETA_CORTA, ORDEN_COMBUSTIBLES } from '../logica/combustibles.ts';
import type { ClavePrecio, ResumenProvincia, Zona } from '../../scripts/lib/tipos.ts';

// Exportadas: src/pages/index.astro (RF-91, ADR-0017) agrupa sus enlaces de
// portada con el mismo vocabulario y el mismo orden que este selector, para
// que las dos vías no diverjan.
export const ETIQUETA_TIPO: Record<Zona['tipo'], string> = {
  provincia: 'Provincias',
  ccaa: 'Comunidades autónomas',
};

export const ORDEN_TIPOS: Zona['tipo'][] = ['provincia', 'ccaa'];

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

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
  const panelZona = exigir<HTMLElement>('#panel-zona');
  const fondoPanelZona = exigir<HTMLElement>('#fondo-panel-zona');
  const cerrarZona = exigir<HTMLButtonElement>('#cerrar-panel-zona');
  const buscar = exigir<HTMLInputElement>('#buscar-zona');
  const botonHoy = exigir<HTMLButtonElement>('#boton-hoy');
  const panelHoy = exigir<HTMLElement>('#panel-hoy');
  const fondoPanelHoy = exigir<HTMLElement>('#fondo-panel-hoy');
  const cerrarHoy = exigir<HTMLButtonElement>('#cerrar-panel-hoy');
  const opcionesZona = Array.from(
    contenedorIdentidad.querySelectorAll<HTMLLIElement>('[data-opcion-zona]'),
    (fila) => ({ fila, textoBusqueda: normalizar(fila.dataset.busqueda ?? '') }),
  );
  const gruposDom = Array.from(contenedorIdentidad.querySelectorAll<HTMLElement>('[data-grupo-zona]'));
  const enlacesZona = Array.from(contenedorIdentidad.querySelectorAll<HTMLAnchorElement>('[data-zona-id]'));

  function abrirPanel(): void {
    cerrarPanelHoy();
    panelZona.hidden = false;
    fondoPanelZona.hidden = false;
    botonZona.setAttribute('aria-expanded', 'true');
    buscar.value = '';
    filtrarZonas('');
    // `hidden` no se puede animar directamente (salta a display:none): se
    // quita en el frame anterior a añadir la clase que dispara la
    // transición de entrada en móvil (ver interfaz.css, .panel-zona--abierta).
    requestAnimationFrame(() => panelZona.classList.add('panel-zona--abierta'));
    buscar.focus();
  }

  function cerrarPanel(): void {
    panelZona.hidden = true;
    fondoPanelZona.hidden = true;
    panelZona.classList.remove('panel-zona--abierta');
    botonZona.setAttribute('aria-expanded', 'false');
  }

  function filtrarZonas(consulta: string): void {
    const q = normalizar(consulta.trim());
    for (const { fila, textoBusqueda } of opcionesZona) {
      fila.hidden = q !== '' && !textoBusqueda.includes(q);
    }
    for (const grupo of gruposDom) {
      const hayVisibles = Array.from(grupo.querySelectorAll('li')).some((li) => !(li as HTMLLIElement).hidden);
      grupo.hidden = !hayVisibles;
    }
  }

  botonZona.addEventListener('click', () => {
    if (panelZona.hidden) abrirPanel();
    else cerrarPanel();
  });
  cerrarZona.addEventListener('click', () => {
    cerrarPanel();
    botonZona.focus();
  });
  fondoPanelZona.addEventListener('click', () => {
    cerrarPanel();
    botonZona.focus();
  });
  for (const enlace of enlacesZona) {
    enlace.addEventListener('click', (evento) => {
      const zonaId = enlace.dataset.zonaId;
      if (!zonaId) return;
      evento.preventDefault();
      actualizarEstado({ zonaId });
      cerrarPanel();
      botonZona.focus();
    });
  }
  buscar.addEventListener('input', () => filtrarZonas(buscar.value));
  document.addEventListener('click', (evento) => {
    if (!panelHoy.hidden && !panelHoy.contains(evento.target as Node) && !botonHoy.contains(evento.target as Node)) {
      cerrarPanelHoy();
    }
  });
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && !panelZona.hidden) {
      evento.stopPropagation();
      cerrarPanel();
      botonZona.focus();
    } else if (evento.key === 'Escape' && !panelHoy.hidden) {
      cerrarPanelHoy();
      botonHoy.focus();
    }
  });

  function abrirPanelHoy(): void {
    cerrarPanel();
    panelHoy.hidden = false;
    fondoPanelHoy.hidden = false;
    document.querySelector('.app')?.classList.add('app--hoy-abierto');
    botonHoy.setAttribute('aria-expanded', 'true');
    panelHoy.querySelector<HTMLAnchorElement>('a')?.focus();
  }

  function cerrarPanelHoy(): void {
    panelHoy.hidden = true;
    fondoPanelHoy.hidden = true;
    document.querySelector('.app')?.classList.remove('app--hoy-abierto');
    botonHoy.setAttribute('aria-expanded', 'false');
  }

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
    boton.addEventListener('click', () => actualizarEstado({ combustible: clave }));
    tabsCombustible.append(boton);
    botonesCombustible.set(clave, boton);
  }

  contenedorRapidos.append(tabsCombustible);

  function render(estado: EstadoApp): void {
    const zonaActual = zonasOrdenadas.find((z) => z.id === estado.zonaId);
    // RF-88: mientras se cargan los datos de una zona —incluido un cambio de
    // zona sin recargar (ADR-0016)— el botón lo dice, para que la interfaz
    // no se quede congelada sin señal mientras el resto (mapa, lista,
    // #tabla-zona) sigue mostrando la zona anterior a propósito.
    nombreZonaSpan.textContent = estado.cargando
      ? 'Cargando…'
      : (zonaActual?.nombre ?? estado.zonaId ?? 'Elige tu zona');

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
  return { abrirSelector: abrirPanel };
}
