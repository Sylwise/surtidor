// Selector de zona (buscable, agrupado) vive en la cabecera superior
// (RF-32): se toca una vez por sesión. Selector de combustible y filtro
// "solo abiertas ahora" viven en la cabecera de la hoja inferior (RF-30,
// RF-31): son los controles de más uso, y docs/05-diseno.md#Móvil los pone
// siempre alcanzables en los tres estados de la hoja, también en
// escritorio. El depósito (RF-33) ya no vive aquí: se mudó a la ficha de
// estación (src/componentes/Totem.ts), junto al cálculo de ahorro, que es
// el único sitio donde significa algo. Persistencia de combustible/zona la
// hace src/logica/estado.ts al recibir cada actualización; aquí solo se
// dispara el cambio de estado.

import { actualizarEstado, obtenerEstado, suscribir, type EstadoApp } from '../logica/estado.ts';
import { ETIQUETA_CORTA, ORDEN_COMBUSTIBLES } from '../logica/combustibles.ts';
import type { ClavePrecio, Zona } from '../../scripts/lib/tipos.ts';

const ETIQUETA_TIPO: Record<Zona['tipo'], string> = {
  provincia: 'Provincias',
  ccaa: 'Comunidades autónomas',
  medida: 'A medida',
};

const ORDEN_TIPOS: Zona['tipo'][] = ['provincia', 'ccaa', 'medida'];

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
 * `contenedorRapidos` recibe el selector de combustible y el filtro.
 */
export function montarControles(
  contenedorIdentidad: HTMLElement,
  contenedorRapidos: HTMLElement,
  zonas: Zona[],
): () => void {
  const zonasOrdenadas = [...zonas].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  contenedorIdentidad.innerHTML = '';
  contenedorRapidos.innerHTML = '';

  // --- Selector de zona: buscable, agrupado por tipo (RF-32) ---
  const bloqueZona = document.createElement('div');
  bloqueZona.className = 'controles__zona';

  const botonZona = document.createElement('button');
  botonZona.type = 'button';
  botonZona.className = 'boton-zona';
  botonZona.setAttribute('aria-expanded', 'false');
  botonZona.setAttribute('aria-controls', 'panel-zona');
  const nombreZonaSpan = document.createElement('span');
  nombreZonaSpan.className = 'boton-zona__nombre';
  botonZona.append(nombreZonaSpan);

  const panelZona = document.createElement('div');
  panelZona.id = 'panel-zona';
  panelZona.className = 'panel-zona';
  panelZona.hidden = true;

  const buscar = document.createElement('input');
  buscar.type = 'search';
  buscar.className = 'panel-zona__buscar';
  buscar.placeholder = 'Buscar provincia, comunidad o zona…';
  buscar.setAttribute('aria-label', 'Buscar zona');

  const listaGrupos = document.createElement('div');
  listaGrupos.className = 'panel-zona__grupos';

  const opcionesZona: { fila: HTMLLIElement; textoBusqueda: string }[] = [];
  const gruposDom: HTMLElement[] = [];

  for (const tipo of ORDEN_TIPOS) {
    const deEsteTipo = zonasOrdenadas.filter((z) => z.tipo === tipo);
    if (deEsteTipo.length === 0) continue;

    const grupo = document.createElement('div');
    grupo.className = 'panel-zona__grupo';
    const titulo = document.createElement('h3');
    titulo.className = 'panel-zona__titulo-grupo';
    titulo.textContent = ETIQUETA_TIPO[tipo];
    grupo.append(titulo);

    const ul = document.createElement('ul');
    ul.className = 'panel-zona__lista';

    for (const zona of deEsteTipo) {
      const li = document.createElement('li');
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'panel-zona__opcion';
      boton.textContent = zona.nombre;
      boton.addEventListener('click', () => {
        actualizarEstado({ zonaId: zona.id });
        cerrarPanel();
        botonZona.focus();
      });
      li.append(boton);
      ul.append(li);
      opcionesZona.push({ fila: li, textoBusqueda: normalizar(zona.nombre) });
    }

    grupo.append(ul);
    listaGrupos.append(grupo);
    gruposDom.push(grupo);
  }

  panelZona.append(buscar, listaGrupos);
  bloqueZona.append(botonZona, panelZona);

  function abrirPanel(): void {
    panelZona.hidden = false;
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
  buscar.addEventListener('input', () => filtrarZonas(buscar.value));
  document.addEventListener('click', (evento) => {
    if (!panelZona.hidden && !bloqueZona.contains(evento.target as Node)) cerrarPanel();
  });
  bloqueZona.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && !panelZona.hidden) {
      evento.stopPropagation();
      cerrarPanel();
      botonZona.focus();
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
    boton.addEventListener('click', () => actualizarEstado({ combustible: clave }));
    tabsCombustible.append(boton);
    botonesCombustible.set(clave, boton);
  }

  // --- Filtro "solo abiertas ahora": interruptor a medida (RF-31, CU-4) ---
  // El <input> real sigue siendo la fuente de verdad accesible (teclado,
  // lectores de pantalla): se oculta visualmente sin `display:none`, que
  // lo sacaría del árbol de accesibilidad. La pastilla es un <span> puramente
  // visual que reacciona a `:checked` por CSS (ver .toggle en interfaz.css).
  const filtro = document.createElement('label');
  filtro.className = 'toggle controles__filtro';
  const checkAbiertas = document.createElement('input');
  checkAbiertas.type = 'checkbox';
  checkAbiertas.className = 'toggle__input';
  checkAbiertas.addEventListener('change', () => actualizarEstado({ soloAbiertas: checkAbiertas.checked }));
  const pastilla = document.createElement('span');
  pastilla.className = 'toggle__pastilla';
  pastilla.setAttribute('aria-hidden', 'true');
  const textoFiltro = document.createElement('span');
  textoFiltro.className = 'toggle__texto';
  textoFiltro.textContent = 'Solo abiertas ahora';
  filtro.append(checkAbiertas, pastilla, textoFiltro);

  contenedorIdentidad.append(bloqueZona);
  contenedorRapidos.append(tabsCombustible, filtro);

  function render(estado: EstadoApp): void {
    const zonaActual = zonasOrdenadas.find((z) => z.id === estado.zonaId);
    nombreZonaSpan.textContent = zonaActual?.nombre ?? estado.zonaId;

    for (const [clave, boton] of botonesCombustible) {
      const activo = clave === estado.combustible;
      boton.setAttribute('aria-pressed', String(activo));
      boton.classList.toggle('controles__pestana--activa', activo);
    }

    checkAbiertas.checked = estado.soloAbiertas;
  }

  render(obtenerEstado());
  return suscribir(render);
}
