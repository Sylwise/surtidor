// Mapa interactivo: MapLibre GL JS + tiles de OpenFreeMap, estilo `positron`
// (ADR-0002). Marcadores tótem con sus cuatro estados (docs/05-diseno.md
// #Marcador) y sincronía en los dos sentidos con la lista (RF-21).
//
// Regla dura 2 de CLAUDE.md: el mapa es un extra, no el cimiento. Todo lo que
// puede fallar aquí (WebGL ausente, tiles caídos, timeout) se captura dentro
// de este módulo: nunca se deja escapar una excepción hacia index.astro, y
// nunca se toca src/logica/estado.ts para reportarlo. Si algo falla, este
// componente sustituye su propio contenedor por un mensaje y ya está: la
// lista, el tótem y los controles no dependen de este fichero para nada.

import { Map as MapaLibre, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../estilos/mapa.css';
import { actualizarEstado, obtenerEstado, suscribir, type EstadoApp } from '../logica/estado.ts';
import { crearEscala, preciosDeCombustible, type Escala } from '../logica/escala.ts';
import { estaAbierta } from '../../scripts/lib/horario.ts';
import { ETIQUETA } from '../logica/combustibles.ts';
import { formatearPrecio } from '../logica/formato.ts';
import type { EstacionZona } from '../logica/zona.ts';

const ESTILO_TILES = 'https://tiles.openfreemap.org/styles/positron';
// Centro y zoom antes de que lleguen las estaciones: España peninsular vista
// entera. En cuanto hay estaciones, `encuadrarTodas` lo sustituye.
const CENTRO_INICIAL: [number, number] = [-3.7038, 40.4168];
const ZOOM_INICIAL = 5;
// Regla dura 1 de CLAUDE.md: temporizador de rescate. Si el estilo no ha
// terminado de cargar en este plazo (tiles colgados, no caídos con error),
// se trata como fallo igualmente en vez de dejar un mapa gris para siempre.
const TIEMPO_ESPERA_MS = 10000;

interface EntradaMarcador {
  marker: Marker;
  boton: HTMLButtonElement;
  cartel: HTMLSpanElement;
}

function prefiereMovimientoReducido(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Sustituye el contenido de `contenedor` por un aviso de fallo. Mismo tono
 *  que el resto de estados de error de la interfaz (docs/05-diseno.md). */
function pintarFallo(contenedor: HTMLElement, motivo: string): void {
  contenedor.innerHTML = '';
  contenedor.removeAttribute('style');
  const p = document.createElement('p');
  p.textContent = `El mapa no se ha podido cargar (${motivo}). La lista y la ficha de la izquierda funcionan igual.`;
  contenedor.append(p);
}

/** Monta el mapa en `contenedor` y lo mantiene sincronizado con el estado.
 *  Devuelve una función para desuscribirse y liberar el mapa. */
export function montarMapa(contenedor: HTMLElement): () => void {
  let mapa: MapaLibre | null = null;
  let cargado = false;
  let fallido = false;
  let vigilante: ReturnType<typeof setTimeout> | null = null;
  let cancelarSuscripcion: () => void = () => {};
  const marcadores = new Map<string, EntradaMarcador>();
  let estacionAnterior: string | null = obtenerEstado().estacionId;
  let firmaEstacionesAnterior: string | null = null;

  function fallar(motivo: string): void {
    if (fallido) return;
    fallido = true;
    if (vigilante) clearTimeout(vigilante);
    cancelarSuscripcion();
    for (const entrada of marcadores.values()) entrada.marker.remove();
    marcadores.clear();
    try {
      mapa?.remove();
    } catch {
      // El mapa puede estar a medio construir cuando falla: da igual, el
      // contenedor se repinta entero a continuación.
    }
    mapa = null;
    pintarFallo(contenedor, motivo);
  }

  function saltarOVolar(centro: [number, number], zoom: number): void {
    if (!mapa) return;
    if (prefiereMovimientoReducido()) {
      mapa.jumpTo({ center: centro, zoom });
    } else {
      // 650 ms, ver la sección "Movimiento" de docs/05-diseno.md.
      mapa.flyTo({ center: centro, zoom, duration: 650 });
    }
  }

  /** Encuadre inicial de una zona: todas las estaciones visibles a la vez.
   *  No es un requisito explícito, pero sin esto el mapa se queda centrado
   *  en el punto de partida (España entera) cada vez que se cambia de zona,
   *  lo cual es peor experiencia que encuadrar lo que hay. Se dispara solo
   *  cuando cambia el conjunto de estaciones, nunca en cada render. */
  function encuadrarTodas(estaciones: EstacionZona[]): void {
    if (!mapa || estaciones.length === 0) return;
    if (estaciones.length === 1) {
      const [unica] = estaciones;
      saltarOVolar([unica.lon, unica.lat], Math.max(mapa.getZoom(), 12));
      return;
    }
    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;
    for (const e of estaciones) {
      minLon = Math.min(minLon, e.lon);
      maxLon = Math.max(maxLon, e.lon);
      minLat = Math.min(minLat, e.lat);
      maxLat = Math.max(maxLat, e.lat);
    }
    mapa.fitBounds(
      [
        [minLon, minLat],
        [maxLon, maxLat],
      ],
      { padding: 48, maxZoom: 13, duration: prefiereMovimientoReducido() ? 0 : 650 }
    );
  }

  function crearMarcador(estacion: EstacionZona): EntradaMarcador {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'marcador';

    const cartel = document.createElement('span');
    cartel.className = 'marcador__cartel';
    const poste = document.createElement('span');
    poste.className = 'marcador__poste';
    boton.append(cartel, poste);

    // RF-14: pulsar un marcador selecciona su estación. El centrado del
    // mapa no se hace aquí: se hace en `render`, que reacciona igual al
    // cambio de estado venga de un clic en el mapa o de un clic en la
    // lista (RF-21, sincronía en los dos sentidos).
    boton.addEventListener('click', () => {
      actualizarEstado({ estacionId: estacion.id });
    });

    // anchor: 'bottom' ancla el poste al punto exacto de la estación
    // (RF-11), no el cartel.
    const marker = new Marker({ element: boton, anchor: 'bottom' }).setLngLat([estacion.lon, estacion.lat]);
    if (mapa) marker.addTo(mapa);

    return { marker, boton, cartel };
  }

  function actualizarMarcador(entrada: EntradaMarcador, estacion: EstacionZona, estado: EstadoApp, escala: Escala): void {
    const precio = estacion.precios[estado.combustible];
    const abierta = estaAbierta(estacion.horario, new Date());
    const seleccionada = estacion.id === estado.estacionId;

    const clases = ['marcador'];
    let texto: string;
    let etiqueta: string;

    if (precio === null) {
      // Criterio propio (no hay caso específico en los documentos): la
      // estación se sigue viendo y se puede seleccionar, pero como no
      // vende este combustible no hay precio que enseñar. Se atenúa y se
      // usa un guion, nunca "0,000" (mismo espíritu que RF-23 en la ficha).
      clases.push('marcador--sin-dato');
      texto = '—';
      etiqueta = `${estacion.rotulo}, ${estacion.municipio}: no vende ${ETIQUETA[estado.combustible].toLowerCase()}`;
    } else {
      const barata = escala.esMasBarata(precio);
      clases.push(barata ? 'marcador--barata' : `marcador--${escala.banda(precio)}`);
      texto = formatearPrecio(precio);
      etiqueta = `${estacion.rotulo}, ${estacion.municipio}: ${texto} euros${barata ? ', la más barata de la zona' : ''}`;
    }

    if (!abierta) {
      clases.push('marcador--cerrada');
      etiqueta += ', cerrada ahora';
    }
    if (seleccionada) clases.push('marcador--activa');

    entrada.boton.className = clases.join(' ');
    entrada.boton.setAttribute('aria-label', etiqueta);
    entrada.boton.setAttribute('aria-pressed', String(seleccionada));
    entrada.cartel.textContent = texto;
  }

  function render(estado: EstadoApp): void {
    if (!mapa || fallido || !cargado) return;

    // RF-15: cerradas atenuadas pero visibles, salvo que el filtro de solo
    // abiertas esté activo (entonces, igual que en la lista, no se enseñan).
    const visibles = estado.soloAbiertas
      ? estado.estaciones.filter((e) => estaAbierta(e.horario, new Date()))
      : estado.estaciones;

    const idsVisibles = new Set(visibles.map((e) => e.id));
    for (const [id, entrada] of marcadores) {
      if (!idsVisibles.has(id)) {
        entrada.marker.remove();
        marcadores.delete(id);
      }
    }

    // RF-12: la banda de color sale del percentil dentro de la zona y
    // combustible mostrados, la misma escala que usa la lista.
    const escala = crearEscala(preciosDeCombustible(estado.estaciones, estado.combustible));

    for (const estacion of visibles) {
      let entrada = marcadores.get(estacion.id);
      if (!entrada) {
        entrada = crearMarcador(estacion);
        marcadores.set(estacion.id, entrada);
      }
      actualizarMarcador(entrada, estacion, estado, escala);
    }

    const firma = visibles
      .map((e) => e.id)
      .sort()
      .join(',');
    if (firma !== firmaEstacionesAnterior) {
      firmaEstacionesAnterior = firma;
      encuadrarTodas(visibles);
    }

    // RF-14 / RF-21: centrado en la estación seleccionada, sea cual sea el
    // origen del cambio (clic en el mapa o clic en la lista).
    if (estado.estacionId !== estacionAnterior) {
      estacionAnterior = estado.estacionId;
      if (estado.estacionId) {
        const estacion = estado.estaciones.find((e) => e.id === estado.estacionId);
        if (estacion) saltarOVolar([estacion.lon, estacion.lat], Math.max(mapa.getZoom(), 13));
      }
    }
  }

  try {
    const lienzo = document.createElement('div');
    lienzo.className = 'mapa-lienzo';
    contenedor.innerHTML = '';
    contenedor.setAttribute('style', 'position:relative;padding:0;display:block');
    contenedor.append(lienzo);

    mapa = new MapaLibre({
      container: lienzo,
      style: ESTILO_TILES,
      center: CENTRO_INICIAL,
      zoom: ZOOM_INICIAL,
      attributionControl: {},
    });

    // Endurecimiento: si el contenedor todavía no tenía su tamaño final
    // cuando se construyó el mapa (el `<script>` puede ejecutarse antes de
    // que el layout flex termine de asentarse), MapLibre calcula el lienzo
    // con un tamaño equivocado y se queda sin pedir los tiles del visor
    // real, sin que ningún evento de error lo delate: el mapa se queda
    // colgado hasta que salta el vigilante. Forzar un resize en el siguiente
    // frame corrige el tamaño del lienzo sin coste si ya era correcto.
    requestAnimationFrame(() => mapa?.resize());

    vigilante = setTimeout(() => {
      if (!cargado) fallar('está tardando demasiado en responder');
    }, TIEMPO_ESPERA_MS);

    mapa.on('load', () => {
      cargado = true;
      if (vigilante) clearTimeout(vigilante);
      render(obtenerEstado());
    });

    // Un error antes de terminar de cargar el estilo (tiles.openfreemap.org
    // caído, DNS bloqueado, CORS) impide que el mapa llegue a verse: se
    // trata como fallo total. Un error después de cargar (un tile suelto
    // que da 404 en el borde del mundo, por ejemplo) no derriba un mapa que
    // ya funciona.
    mapa.on('error', (evento) => {
      if (cargado) return;
      const error = (evento as unknown as { error?: unknown }).error;
      const motivo = error instanceof Error ? error.message : 'no se han podido descargar los tiles';
      fallar(motivo);
    });
  } catch (error) {
    fallar(error instanceof Error ? error.message : 'error desconocido al iniciar MapLibre');
    return () => {};
  }

  cancelarSuscripcion = suscribir(render);

  return () => {
    cancelarSuscripcion();
    if (vigilante) clearTimeout(vigilante);
    for (const entrada of marcadores.values()) entrada.marker.remove();
    marcadores.clear();
    try {
      mapa?.remove();
    } catch {
      // Desmontaje: si ya ha fallado antes, el mapa puede ser null o estar
      // a medio destruir. No es un problema real, se ignora.
    }
    mapa = null;
  };
}
