interface OpcionesSelectorZona {
  alElegirZona?: (zonaId: string) => void;
  antesDeAbrir?: () => void;
}

export interface SelectorZonaMontado {
  abrir: (origen?: HTMLElement | null) => void;
  cerrar: (devolverFoco?: boolean) => void;
}

export function normalizarBusquedaZona(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function montarSelectorZona(
  contenedor: HTMLElement,
  opciones: OpcionesSelectorZona = {},
): SelectorZonaMontado {
  const exigir = <T extends HTMLElement>(selector: string): T => {
    const elemento = contenedor.querySelector<T>(selector);
    if (!elemento) throw new Error(`Falta ${selector} en el selector de zona.`);
    return elemento;
  };

  const boton = exigir<HTMLButtonElement>('#boton-zona');
  const panel = exigir<HTMLElement>('#panel-zona');
  const fondo = exigir<HTMLElement>('#fondo-panel-zona');
  const cerrarBoton = exigir<HTMLButtonElement>('#cerrar-panel-zona');
  const buscar = exigir<HTMLInputElement>('#buscar-zona');
  const filas = Array.from(
    contenedor.querySelectorAll<HTMLLIElement>('[data-opcion-zona]'),
    (fila) => ({ fila, texto: normalizarBusquedaZona(fila.dataset.busqueda ?? '') }),
  );
  const grupos = Array.from(contenedor.querySelectorAll<HTMLElement>('[data-grupo-zona]'));
  const enlaces = Array.from(contenedor.querySelectorAll<HTMLAnchorElement>('[data-zona-id]'));
  let origenFoco: HTMLElement | null = null;

  function filtrar(consulta: string): void {
    const buscado = normalizarBusquedaZona(consulta.trim());
    for (const { fila, texto } of filas) fila.hidden = buscado !== '' && !texto.includes(buscado);
    for (const grupo of grupos) {
      grupo.hidden = !Array.from(grupo.querySelectorAll('li')).some((fila) => !(fila as HTMLLIElement).hidden);
    }
  }

  function abrir(origen: HTMLElement | null = null): void {
    opciones.antesDeAbrir?.();
    origenFoco = origen ?? (document.activeElement instanceof HTMLElement ? document.activeElement : boton);
    panel.hidden = false;
    fondo.hidden = false;
    boton.setAttribute('aria-expanded', 'true');
    buscar.value = '';
    filtrar('');
    document.body.classList.add('selector-zona-abierto');
    requestAnimationFrame(() => panel.classList.add('panel-zona--abierta'));
    buscar.focus();
  }

  function cerrar(devolverFoco = false): void {
    panel.hidden = true;
    fondo.hidden = true;
    panel.classList.remove('panel-zona--abierta');
    boton.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('selector-zona-abierto');
    if (devolverFoco) (origenFoco ?? boton).focus();
  }

  boton.addEventListener('click', () => panel.hidden ? abrir(boton) : cerrar(true));
  cerrarBoton.addEventListener('click', () => cerrar(true));
  fondo.addEventListener('click', () => cerrar(true));
  buscar.addEventListener('input', () => filtrar(buscar.value));

  for (const enlace of enlaces) {
    enlace.addEventListener('click', (evento) => {
      const zonaId = enlace.dataset.zonaId;
      if (!zonaId || !opciones.alElegirZona) return;
      evento.preventDefault();
      opciones.alElegirZona(zonaId);
      cerrar(true);
    });
  }

  document.addEventListener('keydown', (evento) => {
    if (panel.hidden) return;
    if (evento.key === 'Escape') {
      evento.preventDefault();
      evento.stopImmediatePropagation();
      cerrar(true);
      return;
    }
    if (evento.key !== 'Tab') return;
    const focables = Array.from(panel.querySelectorAll<HTMLElement>('a[href]:not([hidden]), button:not([disabled]), input:not([disabled])'))
      .filter((elemento) => elemento.offsetParent !== null);
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

  return { abrir, cerrar };
}
