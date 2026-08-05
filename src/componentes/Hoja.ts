// Hoja inferior arrastrable (ADR-0006): tres estados — colapsada, media,
// completa — que reparten el espacio entre el mapa (capa de fondo, regla
// dura 2 de CLAUDE.md: es un extra) y los controles rápidos + lista/ficha.
//
// El estado de la hoja es puramente de interfaz: nunca entra en
// src/logica/estado.ts ni en localStorage (regla dura 4), igual que la
// frescura de los datos en src/pages/index.astro se mantiene fuera del
// estado global a propósito.
//
// Solo tiene efecto por debajo de 760px: en escritorio la hoja es la barra
// lateral fija de siempre (ver interfaz.css) y este módulo no cambia nada
// de su aspecto, aunque los listeners sigan montados.

import { obtenerEstado, suscribir } from '../logica/estado.ts';

type EstadoHoja = 'colapsada' | 'media' | 'completa';

const ORDEN: EstadoHoja[] = ['colapsada', 'media', 'completa'];
const CONSULTA_MOVIL = '(max-width: 760px)';
const UMBRAL_ARRASTRE_PX = 4;

// Mismos números que --hoja-colapsada/--hoja-media/--hoja-completa en
// interfaz.css. Duplicarlos aquí es más simple y más robusto que hacer que
// el arrastre lea `getComputedStyle` en cada movimiento del puntero.
function alturaDeEstado(estado: EstadoHoja): number {
  if (estado === 'colapsada') return 110;
  if (estado === 'media') return window.innerHeight * 0.55;
  return window.innerHeight * 0.9;
}

function prefiereMovimientoReducido(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Monta el comportamiento de arrastre y teclado de la hoja inferior.
 * Devuelve una función de limpieza.
 */
export function montarHoja(hoja: HTMLElement, asa: HTMLButtonElement): () => void {
  let estado: EstadoHoja = 'media';
  let arrastrando = false;
  let seMovio = false;
  let inicioY = 0;
  let alturaInicio = 0;

  function aplicar(nuevo: EstadoHoja, animar: boolean): void {
    estado = nuevo;
    hoja.style.removeProperty('height');
    hoja.style.transition = animar && !prefiereMovimientoReducido() ? '' : 'none';
    hoja.dataset.estado = nuevo;
    asa.setAttribute('aria-expanded', String(nuevo !== 'colapsada'));
    asa.setAttribute(
      'aria-label',
      `Panel de estaciones: ${nuevo}. Flecha arriba o abajo para cambiar de tamaño.`,
    );
  }

  function siguiente(direccion: 1 | -1): EstadoHoja {
    const indice = ORDEN.indexOf(estado);
    const nuevoIndice = Math.min(ORDEN.length - 1, Math.max(0, indice + direccion));
    return ORDEN[nuevoIndice] as EstadoHoja;
  }

  function estadoMasCercano(alturaPx: number): EstadoHoja {
    let mejor: EstadoHoja = 'media';
    let mejorDistancia = Infinity;
    for (const candidato of ORDEN) {
      const distancia = Math.abs(alturaDeEstado(candidato) - alturaPx);
      if (distancia < mejorDistancia) {
        mejorDistancia = distancia;
        mejor = candidato;
      }
    }
    return mejor;
  }

  // Clic simple (sin arrastre de por medio): alterna colapsada ↔ siguiente
  // estado hacia arriba. Es el atajo para quien no quiere arrastrar.
  function alClic(): void {
    if (seMovio) return;
    aplicar(estado === 'completa' ? 'colapsada' : siguiente(1), true);
  }

  function alTeclado(evento: KeyboardEvent): void {
    if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      aplicar(siguiente(1), true);
    } else if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      aplicar(siguiente(-1), true);
    }
  }

  function alPuntero(evento: PointerEvent): void {
    if (!window.matchMedia(CONSULTA_MOVIL).matches) return;
    arrastrando = true;
    seMovio = false;
    inicioY = evento.clientY;
    alturaInicio = hoja.getBoundingClientRect().height;
    hoja.style.transition = 'none';
    asa.setPointerCapture(evento.pointerId);
  }

  function alMover(evento: PointerEvent): void {
    if (!arrastrando) return;
    const delta = inicioY - evento.clientY;
    if (Math.abs(delta) > UMBRAL_ARRASTRE_PX) seMovio = true;
    const techo = window.innerHeight * 0.92;
    const nuevaAltura = Math.min(techo, Math.max(60, alturaInicio + delta));
    hoja.style.height = `${nuevaAltura}px`;
  }

  function alSoltar(): void {
    if (!arrastrando) return;
    arrastrando = false;
    if (!seMovio) return; // fue un clic, ya lo gestiona alClic
    const alturaActual = hoja.getBoundingClientRect().height;
    aplicar(estadoMasCercano(alturaActual), true);
  }

  asa.addEventListener('click', alClic);
  asa.addEventListener('keydown', alTeclado);
  asa.addEventListener('pointerdown', alPuntero);
  asa.addEventListener('pointermove', alMover);
  asa.addEventListener('pointerup', alSoltar);
  asa.addEventListener('pointercancel', alSoltar);

  // Al seleccionar una estación estando colapsada, la hoja sube sola a
  // "media" para que la ficha se vea sin un gesto adicional.
  let estacionAnterior = obtenerEstado().estacionId;
  const cancelarSuscripcion = suscribir((estadoApp) => {
    if (estadoApp.estacionId && estadoApp.estacionId !== estacionAnterior && estado === 'colapsada') {
      aplicar('media', true);
    }
    estacionAnterior = estadoApp.estacionId;
  });

  aplicar('media', false);

  return () => {
    cancelarSuscripcion();
    asa.removeEventListener('click', alClic);
    asa.removeEventListener('keydown', alTeclado);
    asa.removeEventListener('pointerdown', alPuntero);
    asa.removeEventListener('pointermove', alMover);
    asa.removeEventListener('pointerup', alSoltar);
    asa.removeEventListener('pointercancel', alSoltar);
  };
}
