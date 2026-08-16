// Hoja inferior arrastrable (ADR-0006): tres estados — minimizada, media,
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

export type EstadoHoja = 'minimizada' | 'media' | 'completa';

export const ORDEN_ESTADOS_HOJA: EstadoHoja[] = ['minimizada', 'media', 'completa'];
const CONSULTA_MOVIL = '(max-width: 760px)';
const UMBRAL_ARRASTRE_PX = 4;

export function siguienteEstadoHoja(estado: EstadoHoja, direccion: 1 | -1): EstadoHoja {
  const indice = ORDEN_ESTADOS_HOJA.indexOf(estado);
  const nuevoIndice = Math.min(ORDEN_ESTADOS_HOJA.length - 1, Math.max(0, indice + direccion));
  return ORDEN_ESTADOS_HOJA[nuevoIndice] as EstadoHoja;
}

// Alto real de la cabecera (--cabecera-alto, ResizeObserver en los .astro,
// fijada antes de llamar a montarHoja). El respaldo de 56 coincide con el
// que usa interfaz.css en var(--cabecera-alto, 56px).
function alturaCabecera(): number {
  const valor = getComputedStyle(document.documentElement).getPropertyValue('--cabecera-alto');
  const px = parseFloat(valor);
  return Number.isFinite(px) && px > 0 ? px : 56;
}

// Techo real del arrastre libre: nunca más allá del hueco que dejan la
// topbar y la fila territorial/combustibles (52 px), para que el borde
// superior de la hoja no tape esos controles.
function techoUtil(): number {
  return window.innerHeight - alturaCabecera() - 52;
}

// Mismos números que --hoja-minimizada/--hoja-media/--hoja-completa en
// interfaz.css. Duplicarlos aquí es más simple y más robusto que hacer que
// el arrastre lea `getComputedStyle` en cada movimiento del puntero.
function alturaDeEstado(estado: EstadoHoja): number {
  if (estado === 'minimizada') return 44;
  if (estado === 'media') return Math.min(462, window.innerHeight * 0.55);
  return techoUtil();
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
  let estado: EstadoHoja = 'minimizada';
  let arrastrando = false;
  let seMovio = false;
  let inicioY = 0;
  let alturaInicio = 0;

  function aplicar(nuevo: EstadoHoja, animar: boolean): void {
    estado = nuevo;
    hoja.style.removeProperty('height');
    hoja.style.transition = animar && !prefiereMovimientoReducido() ? '' : 'none';
    hoja.dataset.estado = nuevo;
    // Mapa.ts usa la altura final únicamente cuando una acción explícita
    // necesita encuadrar algo mientras la transición aún está empezando.
    // Mover la hoja por sí solo nunca vuelve a centrar la cámara.
    hoja.dataset.alturaObjetivo = String(alturaDeEstado(nuevo));
    asa.setAttribute('aria-expanded', String(nuevo !== 'minimizada'));
    asa.setAttribute(
      'aria-label',
      `Panel de estaciones: ${nuevo}. Flecha arriba o abajo para cambiar de tamaño.`,
    );

    // RF-83: arrastrar (o el atajo de un toque en el asa) hasta la posición
    // asomada es una de las tres formas de cerrar la ficha, igual que tocar
    // el mapa (Mapa.ts) o la X (Totem.ts).
    if (nuevo === 'minimizada' && obtenerEstado().estacionId) {
      actualizarEstado({ estacionId: null });
    }
  }

  function siguiente(direccion: 1 | -1): EstadoHoja {
    return siguienteEstadoHoja(estado, direccion);
  }

  function estadoMasCercano(alturaPx: number): EstadoHoja {
    let mejor: EstadoHoja = 'media';
    let mejorDistancia = Infinity;
    for (const candidato of ORDEN_ESTADOS_HOJA) {
      const distancia = Math.abs(alturaDeEstado(candidato) - alturaPx);
      if (distancia < mejorDistancia) {
        mejorDistancia = distancia;
        mejor = candidato;
      }
    }
    return mejor;
  }

  // Clic simple (sin arrastre de por medio): abre la pestaña minimizada en
  // media; desde los otros estados recorre el orden sin saltos.
  // estado hacia arriba. Es el atajo para quien no quiere arrastrar.
  function alClic(): void {
    if (seMovio) return;
    aplicar(estado === 'completa' ? 'media' : siguiente(1), true);
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
    const nuevaAltura = Math.min(techo, Math.max(44, alturaInicio + delta));
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

  // Al seleccionar una estación, la hoja sube a la lectura media del nuevo
  // diseño: deja mapa y contexto visibles mientras enseña la ficha.
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
  let frameDesplazamiento: number | null = null;

  let estacionAnterior = obtenerEstado().estacionId;
  const cancelarSuscripcion = suscribir((estadoApp) => {
    const haySeleccion = estadoApp.estacionId !== null;
    const habiaSeleccion = estacionAnterior !== null;

    if (estadoApp.estacionId && estadoApp.estacionId !== estacionAnterior) {
      aplicar('media', true);
    }

    if (cuerpo && estadoApp.estacionId !== estacionAnterior) {
      const comportamiento: ScrollBehavior = prefiereMovimientoReducido() ? 'auto' : 'smooth';
      if (haySeleccion) {
        // Solo se guarda al abrir la primera ficha. Cambiar de estación con
        // una ficha ya abierta debe volver a subir, pero no sustituir el
        // punto de la lista al que regresaremos cuando se cierre.
        if (!habiaSeleccion) scrollListaGuardado = cuerpo.scrollTop;
        // Hoja se suscribe antes que Tótem. Si desplazamos aquí de forma
        // síncrona, la ficha todavía sigue oculta; al aparecer después, el
        // anclaje de scroll del navegador compensa su altura para mantener
        // la fila pulsada en pantalla y parece que no hemos subido. Esperar
        // al siguiente frame deja que todos los suscriptores terminen y que
        // el navegador calcule primero la altura real de la ficha.
        if (frameDesplazamiento !== null) cancelAnimationFrame(frameDesplazamiento);
        frameDesplazamiento = requestAnimationFrame(() => {
          frameDesplazamiento = null;
          if (obtenerEstado().estacionId !== null) {
            cuerpo.scrollTo({ top: 0, behavior: comportamiento });
          }
        });
      } else if (habiaSeleccion) {
        if (frameDesplazamiento !== null) cancelAnimationFrame(frameDesplazamiento);
        frameDesplazamiento = requestAnimationFrame(() => {
          frameDesplazamiento = null;
          if (obtenerEstado().estacionId === null) {
            cuerpo.scrollTo({ top: scrollListaGuardado, behavior: comportamiento });
          }
        });
      }
    }

    estacionAnterior = estadoApp.estacionId;
  });

  const selectorExcluidoMapa = '.maplibregl-marker, .marcador, .marcador-provincia, .maplibregl-control-container, .maplibregl-ctrl, .maplibregl-ctrl-attrib';

  function esFondoInteractivoMapa(objetivo: EventTarget | null): boolean {
    return !(objetivo instanceof Element) || !objetivo.closest(selectorExcluidoMapa);
  }

  function minimizarPorNavegacionMapa(): void {
    if (!window.matchMedia(CONSULTA_MOVIL).matches) return;
    if (estado !== 'minimizada') aplicar('minimizada', true);
  }

  // Se minimiza al INICIO del gesto. No se cancela ni consume: el mismo
  // pointerdown sigue llegando a MapLibre y mueve o amplía el mapa. Los
  // marcadores, controles, GPS y atribución quedan fuera explícitamente.
  function alIniciarInteraccionMapa(evento: PointerEvent | WheelEvent): void {
    if (!esFondoInteractivoMapa(evento.target)) return;
    minimizarPorNavegacionMapa();
  }
  mapa.addEventListener('pointerdown', alIniciarInteraccionMapa, { passive: true });
  mapa.addEventListener('wheel', alIniciarInteraccionMapa, { passive: true });
  // Los racimos confirman primero el click y solicitan entonces minimizar la
  // hoja. Hacerlo en pointerdown movería el mapa y el marcador antes del
  // pointerup, pudiendo cancelar o deformar el click que debe hacer zoom.
  mapa.addEventListener('surtidor:minimizar-hoja', minimizarPorNavegacionMapa);

  const contadorMinimizado = asa.querySelector<HTMLElement>('[data-contador-hoja]');
  function sincronizarContador(): void {
    const contadorLista = hoja.querySelector<HTMLElement>('.lista__contador');
    const siguienteContador = contadorLista?.textContent?.trim() || '0';
    if (contadorMinimizado && contadorMinimizado.textContent !== siguienteContador) {
      contadorMinimizado.textContent = siguienteContador;
    }
  }
  const observadorContador = new MutationObserver(sincronizarContador);
  observadorContador.observe(hoja, { childList: true, subtree: true, characterData: true });
  sincronizarContador();

  aplicar('media', false);

  return () => {
    if (frameDesplazamiento !== null) cancelAnimationFrame(frameDesplazamiento);
    cancelarSuscripcion();
    observadorContador.disconnect();
    asa.removeEventListener('click', alClic);
    asa.removeEventListener('keydown', alTeclado);
    asa.removeEventListener('pointerdown', alPuntero);
    asa.removeEventListener('pointermove', alMover);
    asa.removeEventListener('pointerup', alSoltar);
    asa.removeEventListener('pointercancel', alSoltar);
    mapa.removeEventListener('pointerdown', alIniciarInteraccionMapa);
    mapa.removeEventListener('wheel', alIniciarInteraccionMapa);
    mapa.removeEventListener('surtidor:minimizar-hoja', minimizarPorNavegacionMapa);
  };
}
