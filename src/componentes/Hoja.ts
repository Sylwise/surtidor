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

import { actualizarEstado, obtenerEstado, suscribir } from '../logica/estado.ts';

type EstadoHoja = 'colapsada' | 'media' | 'completa';

const ORDEN: EstadoHoja[] = ['colapsada', 'media', 'completa'];
const CONSULTA_MOVIL = '(max-width: 760px)';
const UMBRAL_ARRASTRE_PX = 4;

// Alto real de la cabecera (--cabecera-alto, ResizeObserver en los .astro,
// fijada antes de llamar a montarHoja). El respaldo de 56 coincide con el
// que usa interfaz.css en var(--cabecera-alto, 56px).
function alturaCabecera(): number {
  const valor = getComputedStyle(document.documentElement).getPropertyValue('--cabecera-alto');
  const px = parseFloat(valor);
  return Number.isFinite(px) && px > 0 ? px : 56;
}

// Techo real del arrastre libre: nunca más allá del hueco que deja la
// cabecera, para que el borde superior de la hoja (y su asa) no quede
// escondido detrás de ella sin forma de volver a agarrarla.
function techoUtil(): number {
  return window.innerHeight - alturaCabecera() - 8;
}

// Mismos números que --hoja-colapsada/--hoja-media/--hoja-completa en
// interfaz.css. Duplicarlos aquí es más simple y más robusto que hacer que
// el arrastre lea `getComputedStyle` en cada movimiento del puntero.
function alturaDeEstado(estado: EstadoHoja): number {
  if (estado === 'colapsada') return 110;
  if (estado === 'media') return window.innerHeight * 0.55;
  return Math.min(window.innerHeight * 0.9, techoUtil());
}

function prefiereMovimientoReducido(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Monta el comportamiento de arrastre y teclado de la hoja inferior.
 * `mapa` es el contenedor del mapa de fondo: un click ahí (mismo patrón que
 * Google Maps) baja la hoja del todo para despejarlo, haya o no una
 * estación seleccionada — los botones de los marcadores hacen
 * `stopPropagation()` (Mapa.ts) así que un click sobre uno de ellos nunca
 * llega hasta aquí.
 * Devuelve una función de limpieza.
 */
export function montarHoja(hoja: HTMLElement, asa: HTMLButtonElement, mapa: HTMLElement): () => void {
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

    // RF-83: arrastrar (o el atajo de un toque en el asa) hasta la posición
    // asomada es una de las tres formas de cerrar la ficha, igual que tocar
    // el mapa (Mapa.ts) o la X (Totem.ts).
    if (nuevo === 'colapsada' && obtenerEstado().estacionId) {
      actualizarEstado({ estacionId: null }, 'eleccion');
    }
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
    const techo = techoUtil();
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

  // Al seleccionar una estación (desde el mapa o desde la lista), la hoja
  // sube del todo para que la ficha quepa entera sin depender de medir su
  // alto real.
  //
  // La ficha se pinta ENCIMA de la lista dentro del mismo contenedor con
  // scroll (.hoja__cuerpo, RF-39): si se ha bajado por la lista para tocar
  // una fila lejana, la ficha se abre fuera de la vista, por encima del
  // scroll actual, y quedaba en silencio hasta que alguien se daba cuenta y
  // subía a mano. Se sube el scroll a la ficha al abrir, y se devuelve a
  // donde estaba la lista al cerrar (por cualquiera de las tres formas de
  // RF-83: la X, tocar el mapa o arrastrar la hoja hacia abajo, todas pasan
  // por el mismo cambio de estacionId a null).
  const cuerpo = hoja.querySelector<HTMLElement>('.hoja__cuerpo');
  let scrollListaGuardado = 0;

  let estacionAnterior = obtenerEstado().estacionId;
  const cancelarSuscripcion = suscribir((estadoApp) => {
    const haySeleccion = estadoApp.estacionId !== null;
    const habiaSeleccion = estacionAnterior !== null;

    if (estadoApp.estacionId && estadoApp.estacionId !== estacionAnterior) {
      aplicar('completa', true);
    }

    if (cuerpo && haySeleccion !== habiaSeleccion) {
      const comportamiento: ScrollBehavior = prefiereMovimientoReducido() ? 'auto' : 'smooth';
      if (haySeleccion) {
        scrollListaGuardado = cuerpo.scrollTop;
        cuerpo.scrollTo({ top: 0, behavior: comportamiento });
      } else {
        cuerpo.scrollTo({ top: scrollListaGuardado, behavior: comportamiento });
      }
    }

    estacionAnterior = estadoApp.estacionId;
  });

  // Tocar el mapa de fondo despeja la hoja (colapsada), haya o no
  // selección: es lo que se acaba de pedir al tocar el mapa, no una
  // consecuencia indirecta de deseleccionar.
  function alTocarMapa(): void {
    if (!window.matchMedia(CONSULTA_MOVIL).matches) return;
    if (estado !== 'colapsada') aplicar('colapsada', true);
  }
  mapa.addEventListener('click', alTocarMapa);

  aplicar('media', false);

  return () => {
    cancelarSuscripcion();
    asa.removeEventListener('click', alClic);
    asa.removeEventListener('keydown', alTeclado);
    asa.removeEventListener('pointerdown', alPuntero);
    asa.removeEventListener('pointermove', alMover);
    asa.removeEventListener('pointerup', alSoltar);
    asa.removeEventListener('pointercancel', alSoltar);
    mapa.removeEventListener('click', alTocarMapa);
  };
}
