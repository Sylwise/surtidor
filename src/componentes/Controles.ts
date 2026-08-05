// Selector de combustible (pestañas, un toque), selector de zona (buscable,
// agrupado), filtro "solo abiertas ahora" y campo de depósito (RF-30 a RF-34).
// Persistencia de combustible/zona/depósito la hace src/logica/estado.ts al
// recibir cada actualización; aquí solo se dispara el cambio de estado.

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
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Monta los controles en `contenedor` (zona, combustible, filtro, depósito) y
 *  los mantiene sincronizados con el estado. El DOM se construye una sola vez:
 *  las actualizaciones posteriores solo tocan lo que cambia, para no cerrar el
 *  panel de zona ni perder el foco cada vez que algo más se recalcula. */
export function montarControles(contenedor: HTMLElement, zonas: Zona[]): () => void {
  const zonasOrdenadas = [...zonas].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  contenedor.innerHTML = '';
  contenedor.className = 'controles';

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
    buscar.focus();
  }

  function cerrarPanel(): void {
    panelZona.hidden = true;
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

  // --- Filtro "solo abiertas ahora" (RF-31, CU-4) ---
  const filtro = document.createElement('label');
  filtro.className = 'controles__filtro';
  const checkAbiertas = document.createElement('input');
  checkAbiertas.type = 'checkbox';
  checkAbiertas.addEventListener('change', () => actualizarEstado({ soloAbiertas: checkAbiertas.checked }));
  filtro.append(checkAbiertas, document.createTextNode(' Solo abiertas ahora'));

  // --- Depósito en litros, 50 L por defecto (RF-33) ---
  const campoDeposito = document.createElement('label');
  campoDeposito.className = 'controles__deposito';
  campoDeposito.append(document.createTextNode('Depósito '));
  const inputDeposito = document.createElement('input');
  inputDeposito.type = 'number';
  inputDeposito.min = '1';
  inputDeposito.max = '300';
  inputDeposito.step = '1';
  inputDeposito.inputMode = 'numeric';
  inputDeposito.setAttribute('aria-label', 'Depósito en litros');
  inputDeposito.addEventListener('input', () => {
    const litros = Number(inputDeposito.value);
    if (Number.isFinite(litros) && litros > 0) {
      actualizarEstado({ deposito: litros });
    }
  });
  campoDeposito.append(inputDeposito, document.createTextNode(' L'));

  contenedor.append(bloqueZona, tabsCombustible, filtro, campoDeposito);

  function render(estado: EstadoApp): void {
    const zonaActual = zonasOrdenadas.find((z) => z.id === estado.zonaId);
    nombreZonaSpan.textContent = zonaActual?.nombre ?? estado.zonaId;

    for (const [clave, boton] of botonesCombustible) {
      const activo = clave === estado.combustible;
      boton.setAttribute('aria-pressed', String(activo));
      boton.classList.toggle('controles__pestana--activa', activo);
    }

    checkAbiertas.checked = estado.soloAbiertas;

    if (document.activeElement !== inputDeposito) {
      inputDeposito.value = String(estado.deposito);
    }
  }

  render(obtenerEstado());
  return suscribir(render);
}
