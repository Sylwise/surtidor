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
//
// Marcadores del DOM con agrupación y colisiones propias: ver ADR-0006. La
// disposición (qué se agrupa en racimo, qué se oculta por colisión) se
// recalcula en moveend/zoomend, nunca en cada fotograma del arrastre.

import { Map as MapaLibre, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../estilos/mapa.css';
import { actualizarEstado, obtenerEstado, suscribir, type EstadoApp } from '../logica/estado.ts';
import { crearEscala, preciosDeCombustible, type Escala } from '../logica/escala.ts';
import {
  agruparEnRacimos,
  idsAgrupados,
  resolverColisiones,
  type PuntoColision,
  type Racimo,
} from '../logica/colisiones.ts';
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

// ADR-0006: por debajo de este zoom, las estaciones se agrupan en racimos en
// vez de mostrarse una a una. Con datos reales, es donde el racimo de
// Vitoria-Gasteiz deja de caber sin solaparse.
const UMBRAL_ZOOM_RACIMOS = 11;
// Lado de la celda de la rejilla de agrupación, en píxeles de pantalla.
const RADIO_RACIMO_PX = 64;

// Tamaño aproximado del cartel para la detección de colisiones. No hace
// falta el ancho exacto de cada texto (ver src/logica/colisiones.ts): estos
// valores solo tienen que ser parecidos al tamaño real en pantalla.
const CAJA_NORMAL = { ancho: 56, alto: 24 };
const CAJA_DESTACADA = { ancho: 72, alto: 30 }; // más barata y racimos: un punto más grandes

// Alto garantizado de la hoja inferior en su estado "asomada" (mismo número
// que --hoja-colapsada en interfaz.css y el caso 'colapsada' en Hoja.ts).
const ALTURA_MINIMA_HOJA_PX = 110;

interface EntradaMarcador {
  marker: Marker;
  boton: HTMLButtonElement;
  cartel: HTMLSpanElement;
}

interface EntradaRacimo {
  marker: Marker;
  boton: HTMLButtonElement;
  precioSpan: HTMLSpanElement;
  cuenta: HTMLSpanElement;
  /** Ids de las estaciones que representa ahora mismo este hueco del pool.
   *  Mutable: el mismo marcador del DOM se reutiliza para racimos distintos
   *  entre un recálculo y el siguiente. */
  ids: string[];
}

/** Descarta estaciones con coordenadas ausentes que la fuente representa
 *  como (0, 0) — "Null Island", en el golfo de Guinea, nunca un punto real
 *  de España. No se toca el normalizador (regla de CLAUDE.md): el dato tal
 *  cual sigue disponible en la lista y la ficha, que no usan lat/lon. Sin
 *  este filtro, una sola estación así arrastra el `fitBounds` de la zona
 *  entera a un zoom absurdo (RF-19: el resto de estaciones quedan reducidas
 *  a un punto y el mapa se aleja hasta encajar también el (0, 0)). */
function tieneCoordenadas(estacion: EstacionZona): boolean {
  return !(estacion.lat === 0 && estacion.lon === 0);
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
  let observador: ResizeObserver | null = null;
  const marcadores = new Map<string, EntradaMarcador>();
  const racimoMarkers: EntradaRacimo[] = [];
  let estacionAnterior: string | null = obtenerEstado().estacionId;
  let firmaEstacionesAnterior: string | null = null;
  // Snapshot del último render(), para que moveend/zoomend puedan recalcular
  // la disposición sin depender de que también haya cambiado el estado.
  let ultimasVisibles: EstacionZona[] = [];
  let ultimoEstado: EstadoApp = obtenerEstado();
  let ultimaEscala: Escala = crearEscala([]);

  function fallar(motivo: string): void {
    if (fallido) return;
    fallido = true;
    if (vigilante) clearTimeout(vigilante);
    observador?.disconnect();
    cancelarSuscripcion();
    for (const entrada of marcadores.values()) entrada.marker.remove();
    marcadores.clear();
    for (const entrada of racimoMarkers) entrada.marker.remove();
    racimoMarkers.length = 0;
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

  /** Margen del encuadre inicial (RF-19): 8% del tamaño visible del mapa. En
   *  móvil se suma el alto mínimo garantizado de la hoja inferior (su
   *  estado "asomada": asa + controles rápidos), no su alto por defecto —
   *  contar con el estado "media" (55% de la pantalla) por defecto dejaría
   *  solo una franja diminuta para encuadrar y forzaría un zoom absurdo en
   *  zonas grandes. La hoja es arrastrable: el usuario que la quiera fuera
   *  del medio la baja, y la lista sigue siendo la vía principal para
   *  llegar a lo que quede tapado. */
  function calcularRelleno(): { top: number; right: number; bottom: number; left: number } {
    const rect = contenedor.getBoundingClientRect();
    const margen = Math.round(Math.min(rect.width, rect.height) * 0.08);
    const relleno = { top: margen, right: margen, bottom: margen, left: margen };
    if (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 760px)').matches) {
      relleno.bottom += ALTURA_MINIMA_HOJA_PX;
    }
    return relleno;
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
      { padding: calcularRelleno(), maxZoom: 13, duration: prefiereMovimientoReducido() ? 0 : 650 }
    );
  }

  /** Acerca el mapa a las estaciones de un racimo al pulsarlo. */
  function volarARacimo(ids: string[]): void {
    if (!mapa) return;
    const miembros = ultimasVisibles.filter((e) => ids.includes(e.id));
    if (miembros.length === 0) return;
    if (miembros.length === 1) {
      const [unico] = miembros;
      saltarOVolar([unico.lon, unico.lat], Math.max(mapa.getZoom() + 2, UMBRAL_ZOOM_RACIMOS + 2));
      return;
    }
    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;
    for (const e of miembros) {
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
      { padding: 64, maxZoom: 16, duration: prefiereMovimientoReducido() ? 0 : 650 }
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
    //
    // stopPropagation es imprescindible: el botón del marcador vive dentro
    // del mismo contenedor donde MapLibre escucha los clics del mapa
    // (.maplibregl-canvas-container), así que sin esto el clic también
    // llegaba al handler de "tocar el mapa deselecciona" y deshacía la
    // selección en el mismo instante — parecía que pulsar un marcador no
    // hacía nada.
    boton.addEventListener('click', (evento) => {
      evento.stopPropagation();
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

    const clases: string[] = [];
    let texto: string;
    let etiqueta: string;
    // Con muchas estaciones muy juntas, los carteles se solapan: la
    // detección de colisiones (ADR-0006, recalcularDisposicion) oculta las
    // que pierdan, pero mientras tanto la que quede visible por encima de
    // otra en el instante de la animación debe ser la más informativa.
    let prioridad = 1; // sin dato

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
      prioridad = barata ? 3 : 2;
    }

    if (!abierta) {
      clases.push('marcador--cerrada');
      etiqueta += ', cerrada ahora';
    }
    if (seleccionada) {
      clases.push('marcador--activa');
      prioridad = 4; // la seleccionada siempre por encima, se ha pedido explícitamente
    }
    entrada.boton.style.zIndex = String(prioridad);

    // Nunca `className =`: MapLibre añade su propia clase `maplibregl-marker`
    // al elemento que le pasamos (de ahí saca su `position: absolute`, ver
    // maplibre-gl.css). Sobrescribir className entero se la comía, el
    // marcador caía al flujo normal del documento y todos se apilaban fuera
    // de la vista salvo los primeros — el bug real de "los marcadores no
    // están anclados a sus puntos". `classList.remove/add` toca solo las
    // clases de estado que gestionamos aquí, deja el resto intacto.
    entrada.boton.classList.remove(
      'marcador--sin-dato',
      'marcador--barata',
      'marcador--p1',
      'marcador--p2',
      'marcador--p3',
      'marcador--p4',
      'marcador--p5',
      'marcador--cerrada',
      'marcador--activa',
    );
    entrada.boton.classList.add(...clases);
    entrada.boton.setAttribute('aria-label', etiqueta);
    entrada.boton.setAttribute('aria-pressed', String(seleccionada));
    entrada.cartel.textContent = texto;
  }

  function claseBanda(precio: number | null, escala: Escala): string {
    if (precio === null) return 'marcador--sin-dato';
    return escala.esMasBarata(precio) ? 'marcador--barata' : `marcador--${escala.banda(precio)}`;
  }

  function crearMarcadorRacimo(): EntradaRacimo {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'marcador marcador--racimo';

    const cartel = document.createElement('span');
    cartel.className = 'marcador__cartel';
    const precioSpan = document.createElement('span');
    const cuenta = document.createElement('span');
    cuenta.className = 'marcador__cuenta';
    cartel.append(precioSpan, cuenta);

    const poste = document.createElement('span');
    poste.className = 'marcador__poste';
    boton.append(cartel, poste);

    const entrada: EntradaRacimo = {
      // setLngLat antes de addTo: Marker.addTo() actualiza su posición en el
      // acto, y sin coordenadas todavía puestas revienta leyendo `.lng` de
      // un LngLat inexistente (mismo motivo por el que crearMarcador, más
      // abajo, pone las coordenadas antes de añadir el marcador al mapa).
      marker: new Marker({ element: boton, anchor: 'bottom' }).setLngLat([0, 0]),
      boton,
      precioSpan,
      cuenta,
      ids: [],
    };

    // Al pulsar un racimo, el mapa se acerca sobre sus estaciones (ADR-0006).
    boton.addEventListener('click', (evento) => {
      evento.stopPropagation();
      volarARacimo(entrada.ids);
    });

    if (mapa) entrada.marker.addTo(mapa);
    return entrada;
  }

  /** Recalcula qué se ve como marcador individual, qué se agrupa en racimo
   *  y qué se oculta por colisión (ADR-0006). Se llama al terminar cada
   *  gesto del mapa (moveend/zoomend) y tras cada render por cambio de
   *  estado, nunca en cada fotograma de un arrastre. */
  function recalcularDisposicion(): void {
    if (!mapa || fallido || !cargado) return;
    const zoomActual = mapa.getZoom();

    const proyectadas = ultimasVisibles.map((estacion) => {
      const punto = mapa!.project([estacion.lon, estacion.lat]);
      return { id: estacion.id, x: punto.x, y: punto.y, precio: estacion.precios[ultimoEstado.combustible] };
    });

    const racimos: Racimo[] = zoomActual < UMBRAL_ZOOM_RACIMOS ? agruparEnRacimos(proyectadas, RADIO_RACIMO_PX) : [];
    const idsEnRacimo = idsAgrupados(racimos);

    const puntosColision: PuntoColision[] = [];
    for (const p of proyectadas) {
      if (idsEnRacimo.has(p.id)) continue;
      const destacada = p.precio !== null && ultimaEscala.esMasBarata(p.precio);
      puntosColision.push({ id: p.id, x: p.x, y: p.y, precio: p.precio, ...(destacada ? CAJA_DESTACADA : CAJA_NORMAL) });
    }
    const clavesRacimo = racimos.map((_, indice) => `racimo-${indice}`);
    racimos.forEach((racimo, indice) => {
      puntosColision.push({ id: clavesRacimo[indice]!, x: racimo.x, y: racimo.y, precio: racimo.precioMinimo, ...CAJA_DESTACADA });
    });

    const visibles = resolverColisiones(puntosColision);

    for (const [id, entrada] of marcadores) {
      entrada.boton.hidden = idsEnRacimo.has(id) || !visibles.has(id);
    }

    while (racimoMarkers.length < racimos.length) racimoMarkers.push(crearMarcadorRacimo());

    racimos.forEach((racimo, indice) => {
      const entrada = racimoMarkers[indice]!;
      entrada.ids = racimo.ids;
      const lngLat = mapa!.unproject([racimo.x, racimo.y]);
      entrada.marker.setLngLat(lngLat);

      entrada.boton.classList.remove(
        'marcador--sin-dato',
        'marcador--barata',
        'marcador--p1',
        'marcador--p2',
        'marcador--p3',
        'marcador--p4',
        'marcador--p5',
      );
      entrada.boton.classList.add(claseBanda(racimo.precioMinimo, ultimaEscala));

      const textoPrecio = racimo.precioMinimo === null ? '—' : formatearPrecio(racimo.precioMinimo);
      entrada.precioSpan.textContent = textoPrecio;
      entrada.cuenta.textContent = String(racimo.ids.length);
      entrada.boton.setAttribute(
        'aria-label',
        racimo.precioMinimo === null
          ? `${racimo.ids.length} estaciones agrupadas, sin dato de ${ETIQUETA[ultimoEstado.combustible].toLowerCase()}. Pulsa para acercar.`
          : `${racimo.ids.length} estaciones agrupadas, desde ${textoPrecio} euros. Pulsa para acercar.`
      );
      entrada.boton.hidden = !visibles.has(clavesRacimo[indice]!);
    });
    for (let i = racimos.length; i < racimoMarkers.length; i++) {
      racimoMarkers[i]!.boton.hidden = true;
      racimoMarkers[i]!.ids = [];
    }
  }

  function render(estado: EstadoApp): void {
    if (!mapa || fallido || !cargado) return;

    // RF-15: cerradas atenuadas pero visibles, salvo que el filtro de solo
    // abiertas esté activo (entonces, igual que en la lista, no se enseñan).
    // Además, solo las que tienen coordenadas de verdad: ver tieneCoordenadas.
    const visibles = (
      estado.soloAbiertas ? estado.estaciones.filter((e) => estaAbierta(e.horario, new Date())) : estado.estaciones
    ).filter(tieneCoordenadas);

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

    ultimasVisibles = visibles;
    ultimoEstado = estado;
    ultimaEscala = escala;

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

    // Un cambio de combustible o de filtro no mueve el mapa (no dispara
    // moveend), pero cambia qué es "la más barata" y qué estaciones hay que
    // colocar: hace falta recalcular la disposición aquí también, no solo
    // en moveend/zoomend.
    recalcularDisposicion();
  }

  try {
    const lienzo = document.createElement('div');
    lienzo.className = 'mapa-lienzo';
    contenedor.innerHTML = '';
    // `position` no se toca aquí: lo decide interfaz.css (position:relative
    // en escritorio, position:fixed en móvil, ADR-0006). Un estilo en línea
    // pisaría con más especificidad la regla del media query.
    contenedor.setAttribute('style', 'padding:0;display:block');
    contenedor.append(lienzo);

    mapa = new MapaLibre({
      container: lienzo,
      style: ESTILO_TILES,
      center: CENTRO_INICIAL,
      zoom: ZOOM_INICIAL,
      attributionControl: {},
    });

    // Endurecimiento: el contenedor vive dentro de un layout flex (RNF-24,
    // rail que hace scroll interno) cuyo tamaño final puede no estar fijado
    // todavía cuando se construye el mapa, y además puede seguir cambiando
    // después (barra de scroll que aparece, fuentes que terminan de cargar,
    // redimensionar la ventana). Si el tamaño interno que maneja MapLibre se
    // queda desincronizado del tamaño real del contenedor, la proyección de
    // coordenadas a píxel se calcula mal: los marcadores aparecen
    // desplazados de su punto real y muchos caen fuera de lo visible. Un
    // único resize() tras el primer frame no basta si el contenedor cambia
    // más adelante, así que se vigila con un ResizeObserver mientras el mapa
    // esté vivo, no solo una vez.
    observador = new ResizeObserver(() => mapa?.resize());
    observador.observe(lienzo);

    vigilante = setTimeout(() => {
      if (!cargado) fallar('está tardando demasiado en responder');
    }, TIEMPO_ESPERA_MS);

    mapa.on('load', () => {
      cargado = true;
      if (vigilante) clearTimeout(vigilante);
      render(obtenerEstado());
    });

    // ADR-0006: la disposición (racimos + colisiones) se recalcula al
    // terminar cada gesto, nunca en cada fotograma del arrastre. Durante el
    // gesto los carteles pueden solaparse un instante; se recolocan al
    // soltar.
    mapa.on('moveend', recalcularDisposicion);
    mapa.on('zoomend', recalcularDisposicion);

    // Tocar el mapa fuera de un marcador deselecciona la estación activa
    // (mismo patrón que Google Maps). Un marcador es un elemento aparte
    // superpuesto al lienzo, no un descendiente del canvas: un clic sobre
    // él nunca llega a este evento, así que no hace falta comprobar el
    // objetivo del clic a mano.
    mapa.on('click', () => {
      if (obtenerEstado().estacionId) actualizarEstado({ estacionId: null });
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
    observador?.disconnect();
    for (const entrada of marcadores.values()) entrada.marker.remove();
    marcadores.clear();
    for (const entrada of racimoMarkers) entrada.marker.remove();
    racimoMarkers.length = 0;
    try {
      mapa?.remove();
    } catch {
      // Desmontaje: si ya ha fallado antes, el mapa puede ser null o estar
      // a medio destruir. No es un problema real, se ignora.
    }
    mapa = null;
  };
}
