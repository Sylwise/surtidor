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

import { Map as MapaLibre, Marker, MercatorCoordinate, type IControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../estilos/mapa.css';
import { actualizarEstado, obtenerEstado, suscribir, type EstadoApp } from '../logica/estado.ts';
import { crearEscala, preciosDeCombustible, type Escala } from '../logica/escala.ts';
import {
  agruparEnRacimos,
  claveRacimo,
  idsAgrupados,
  resolverColisiones,
  type PuntoColision,
  type Racimo,
} from '../logica/colisiones.ts';
import { estaAbierta } from '../../scripts/lib/horario.ts';
import { ETIQUETA } from '../logica/combustibles.ts';
import { formatearPrecio } from '../logica/formato.ts';
import { estacionesQueVenden, estacionesVisibles } from '../logica/visibilidad.ts';
import {
  cargarResumenNacional,
  compararProvincias,
  modoMapaParaZoom,
  ZOOM_SALIDA_NACIONAL,
  type ModoMapa,
} from '../logica/vistaNacional.ts';
import type { EstacionZona } from '../logica/zona.ts';
import type { ProvinciaNacional, ResumenNacional } from '../../scripts/lib/tipos.ts';

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
// Lado de la celda de la rejilla global de agrupación, en píxeles al zoom
// actual (ADR-0021).
const RADIO_RACIMO_PX = 64;
const TAMANO_TILE_PX = 512;

// En la vista nacional las etiquetas locales compiten con el nombre de las
// provincias. Se conservan países, agua, costas y toda la geometría; solo se
// apaga el texto operativo que vuelve a ser útil al acercarse.
const CAPAS_OCULTAS_EN_VISTA_NACIONAL = [
  'waterway_line_label',
  'highway-name-path',
  'highway-name-minor',
  'highway-name-major',
  'highway-shield-non-us',
  'highway-shield-us-interstate',
  'road_shield_us',
  'airport',
  'label_other',
  'label_village',
  'label_town',
  'label_state',
  'label_city',
  'label_city_capital',
] as const;

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
  /** Ids de las estaciones que representa este racimo. */
  ids: string[];
}

interface EntradaProvincia {
  marker: Marker;
  boton: HTMLButtonElement;
  nombre: HTMLSpanElement;
  precio: HTMLSpanElement;
  cuenta: HTMLSpanElement;
  provincia: ProvinciaNacional;
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

// RF-17: botón de "mi ubicación". Icono propio (regla dura 5: nada de
// librerías de iconos por treinta líneas de SVG), un aro con una mira, igual
// de familiar en cualquier mapa sin tomarlo prestado de ningún sitio.
const ICONO_UBICACION =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="6.5"/><path d="M12 2v3.2M12 18.8V22M2 12h3.2M18.8 12H22"/></svg>';

// El aviso de error se retira solo: es la única forma de que un mensaje
// junto a un control tan pequeño no se quede pegado para siempre compitiendo
// con el mapa (docs/05-diseno.md, "nada parpadea, nada interrumpe, nada
// reaparece" — y tampoco nada se queda).
const DURACION_AVISO_UBICACION_MS = 6000;
// Timeout explícito de la propia geolocalización: mismo espíritu que la
// regla dura 1 de CLAUDE.md aunque no sea una petición de red — sin límite,
// un GPS que no responde deja el botón pendiente para siempre.
const TIEMPO_ESPERA_GEOLOCALIZACION_MS = 10000;

function mensajeErrorGeolocalizacion(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Permiso de ubicación denegado.';
    case error.POSITION_UNAVAILABLE:
      return 'No se ha podido determinar tu ubicación.';
    case error.TIMEOUT:
      return 'La ubicación ha tardado demasiado en responder.';
    default:
      return 'No se ha podido obtener tu ubicación.';
  }
}

/** Control de MapLibre para el botón "mi ubicación" (RF-17). Va con el resto
 *  de controles del mapa (docs/05-diseno.md: nada de controles nuevos en la
 *  cabecera, y este no cuenta contra el presupuesto de cinco porque vive
 *  sobre el mapa, no en el estrato 1).
 *
 *  Solo pide permiso al pulsarlo, nunca al montar el mapa (regla dura 1 de
 *  CLAUDE.md, RF-49). La posición se usa para centrar el mapa en la misma
 *  función (RNF-31: nunca sale de aquí hacia una petición de red) y, si se
 *  ha dado `alEncontrarUbicacion`, para avisar a quien montó el mapa de las
 *  coordenadas (RF-37: la página decide qué zona corresponde y la cambia;
 *  este componente no conoce ni provincias ni zonas). Si se deniega o
 *  falla, un aviso breve junto al botón y el mapa se queda como estaba: sin
 *  reintentos automáticos ni volver a pedir permiso por su cuenta. */
class ControlUbicacion implements IControl {
  private mapa: MapaLibre | null = null;
  private contenedor: HTMLDivElement | null = null;
  private boton: HTMLButtonElement | null = null;
  private aviso: HTMLParagraphElement | null = null;
  private temporizadorAviso: ReturnType<typeof setTimeout> | null = null;
  private pendiente = false;
  private marcadorUbicacion: Marker | null = null;

  constructor(private alEncontrarUbicacion?: (posicion: { lat: number; lon: number }) => void) {}

  onAdd(mapa: MapaLibre): HTMLElement {
    this.mapa = mapa;

    const contenedor = document.createElement('div');
    contenedor.className = 'maplibregl-ctrl maplibregl-ctrl-group control-ubicacion';

    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'control-ubicacion__boton';
    boton.setAttribute('aria-label', 'Usar mi ubicación para centrar el mapa y ordenar por cercanía');
    boton.title = 'Mi ubicación';
    boton.innerHTML = ICONO_UBICACION;
    boton.addEventListener('click', () => this.pedirUbicacion());

    // role="status": el mismo patrón que #avisos en las páginas (RF-36,
    // RF-40), en miniatura y sin tocar el estado global.
    const aviso = document.createElement('p');
    aviso.className = 'control-ubicacion__aviso';
    aviso.setAttribute('role', 'status');
    aviso.hidden = true;

    contenedor.append(boton, aviso);
    this.contenedor = contenedor;
    this.boton = boton;
    this.aviso = aviso;
    return contenedor;
  }

  onRemove(): void {
    if (this.temporizadorAviso) clearTimeout(this.temporizadorAviso);
    this.marcadorUbicacion?.remove();
    this.marcadorUbicacion = null;
    this.contenedor?.remove();
    this.mapa = null;
    this.contenedor = null;
    this.boton = null;
    this.aviso = null;
  }

  private mostrarAviso(texto: string): void {
    if (!this.aviso) return;
    if (this.temporizadorAviso) clearTimeout(this.temporizadorAviso);
    this.aviso.textContent = texto;
    this.aviso.hidden = false;
    this.temporizadorAviso = setTimeout(() => {
      if (this.aviso) this.aviso.hidden = true;
    }, DURACION_AVISO_UBICACION_MS);
  }

  private pedirUbicacion(): void {
    if (this.pendiente || !this.mapa) return;
    if (!('geolocation' in navigator)) {
      this.mostrarAviso('Este navegador no admite geolocalización.');
      return;
    }

    this.pendiente = true;
    this.boton?.classList.add('control-ubicacion__boton--pendiente');

    const terminar = (): void => {
      this.pendiente = false;
      this.boton?.classList.remove('control-ubicacion__boton--pendiente');
    };

    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        terminar();
        if (!this.mapa) return;
        // Solo centra: el zoom actual y la zona activa no cambian.
        const centro: [number, number] = [posicion.coords.longitude, posicion.coords.latitude];
        if (!this.marcadorUbicacion) {
          const punto = document.createElement('div');
          punto.className = 'marcador-ubicacion';
          punto.setAttribute('role', 'img');
          punto.setAttribute('aria-label', 'Tu ubicación aproximada');
          this.marcadorUbicacion = new Marker({ element: punto, anchor: 'center' }).setLngLat(centro).addTo(this.mapa);
        } else {
          this.marcadorUbicacion.setLngLat(centro);
        }
        const zoom = Math.max(this.mapa.getZoom(), 13);
        if (prefiereMovimientoReducido()) {
          this.mapa.jumpTo({ center: centro, zoom });
        } else {
          this.mapa.flyTo({ center: centro, zoom, duration: 650 });
        }
        this.alEncontrarUbicacion?.({ lat: posicion.coords.latitude, lon: posicion.coords.longitude });
      },
      (error) => {
        terminar();
        this.mostrarAviso(mensajeErrorGeolocalizacion(error));
      },
      { enableHighAccuracy: false, timeout: TIEMPO_ESPERA_GEOLOCALIZACION_MS, maximumAge: 0 }
    );
  }
}

/** Monta el mapa en `contenedor` y lo mantiene sincronizado con el estado.
 *  `alEncontrarUbicacion` (RF-37) se invoca con las coordenadas cuando el
 *  botón "mi ubicación" las consigue; quien monte el mapa decide qué zona
 *  corresponde y la aplica, este módulo no conoce zonas.
 *  Devuelve una función para desuscribirse y liberar el mapa. */
export function montarMapa(
  contenedor: HTMLElement,
  alEncontrarUbicacion?: (posicion: { lat: number; lon: number }) => void,
  alElegirProvincia?: (idProvincia: string) => boolean,
): () => void {
  let mapa: MapaLibre | null = null;
  let cargado = false;
  let fallido = false;
  let vigilante: ReturnType<typeof setTimeout> | null = null;
  let cancelarSuscripcion: () => void = () => {};
  let observador: ResizeObserver | null = null;
  const marcadores = new Map<string, EntradaMarcador>();
  const racimoMarkers = new Map<string, EntradaRacimo>();
  const provinciaMarkers = new Map<string, EntradaProvincia>();
  let resumenNacional: ResumenNacional | null = null;
  let modoMapa: ModoMapa = 'zona';
  let modoEtiquetasAplicado: ModoMapa | null = null;
  let provinciaConFoco: string | null = null;
  // Pulsar una provincia ya coloca la cámara en el umbral de salida nacional. El primer cambio de
  // estaciones que llega después pertenece a esa elección: si fitBounds
  // intentase encajar la provincia completa en un móvil, podría alejar otra
  // vez por debajo del umbral de entrada y devolver al usuario a la vista nacional.
  let omitirSiguienteEncuadrePorProvincia = false;
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
    for (const entrada of racimoMarkers.values()) entrada.marker.remove();
    racimoMarkers.clear();
    for (const entrada of provinciaMarkers.values()) entrada.marker.remove();
    provinciaMarkers.clear();
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

  function crearMarcadorProvincia(provincia: ProvinciaNacional): EntradaProvincia {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'marcador-provincia';
    // Se crea antes de que el resumen y el estilo puedan haber terminado de
    // coordinarse. Oculto evita un fotograma de 52 carteles vacíos; la
    // disposición nacional lo muestra solo después de rellenarlo.
    boton.hidden = true;

    const cartel = document.createElement('span');
    cartel.className = 'marcador-provincia__cartel';
    const nombre = document.createElement('span');
    nombre.className = 'marcador-provincia__nombre';
    const precio = document.createElement('span');
    precio.className = 'marcador-provincia__precio';
    const cuenta = document.createElement('span');
    cuenta.className = 'marcador-provincia__cuenta';
    const poste = document.createElement('span');
    poste.className = 'marcador-provincia__poste';
    cartel.append(nombre, precio, cuenta);
    boton.append(cartel, poste);

    const entrada: EntradaProvincia = {
      marker: new Marker({ element: boton, anchor: 'bottom' }).setLngLat([
        provincia.centro.lon,
        provincia.centro.lat,
      ]),
      boton,
      nombre,
      precio,
      cuenta,
      provincia,
    };

    boton.addEventListener('focus', () => {
      provinciaConFoco = provincia.id;
      recalcularDisposicion();
    });
    boton.addEventListener('blur', () => {
      if (provinciaConFoco === provincia.id) {
        provinciaConFoco = null;
        recalcularDisposicion();
      }
    });
    boton.addEventListener('click', (evento) => {
      evento.stopPropagation();
      // La respuesta visual no espera a que termine la carga territorial:
      // salimos de la vista nacional en el acto y el flujo de RF-88 hará
      // después la carga. Ese primer resultado no vuelve a ejecutar
      // fitBounds: se conserva este acercamiento para que las estaciones
      // aparezcan con una sola pulsación también en móvil.
      omitirSiguienteEncuadrePorProvincia = alElegirProvincia?.(provincia.id) ?? false;
      saltarOVolar([provincia.centro.lon, provincia.centro.lat], ZOOM_SALIDA_NACIONAL);
    });

    if (mapa) entrada.marker.addTo(mapa);
    return entrada;
  }

  function actualizarProvincia(entrada: EntradaProvincia, estado: EstadoApp): void {
    const { media, n } = entrada.provincia.combustibles[estado.combustible];
    const combustible = ETIQUETA[estado.combustible].toLowerCase();
    entrada.nombre.textContent = entrada.provincia.nombre;
    if (media === null) {
      entrada.precio.textContent = `No vende ${ETIQUETA[estado.combustible]}`;
      entrada.cuenta.textContent = '0 estaciones';
      entrada.boton.setAttribute(
        'aria-label',
        `${entrada.provincia.nombre}. Ninguna estación vende ${combustible}. Pulsa para abrir la provincia.`,
      );
      return;
    }

    const textoPrecio = formatearPrecio(media);
    entrada.precio.textContent = `${textoPrecio} €/L`;
    entrada.cuenta.textContent = `${n} ${n === 1 ? 'estación' : 'estaciones'}`;
    entrada.boton.setAttribute(
      'aria-label',
      `${entrada.provincia.nombre}. Precio medio de ${combustible}: ${textoPrecio} euros por litro, ` +
        `calculado sobre ${n} ${n === 1 ? 'estación' : 'estaciones'}. Pulsa para abrir la provincia.`,
    );
  }

  function recalcularVistaNacional(): void {
    if (!mapa || !resumenNacional) return;
    for (const entrada of marcadores.values()) entrada.boton.hidden = true;
    for (const entrada of racimoMarkers.values()) entrada.boton.hidden = true;

    const ordenadas = [...resumenNacional.provincias].sort((a, b) =>
      compararProvincias(a, b, ultimoEstado.combustible, provinciaConFoco),
    );
    const puntos: PuntoColision[] = [];
    for (const [prioridad, provincia] of ordenadas.entries()) {
      const entrada = provinciaMarkers.get(provincia.id);
      if (!entrada) continue;
      entrada.boton.hidden = false;
      actualizarProvincia(entrada, ultimoEstado);
      const punto = mapa.project([provincia.centro.lon, provincia.centro.lat]);
      puntos.push({
        id: provincia.id,
        x: punto.x,
        y: punto.y,
        precio: prioridad,
        ancho: Math.max(entrada.boton.offsetWidth, 116),
        alto: Math.max(entrada.boton.offsetHeight, 64),
      });
    }

    const visibles = resolverColisiones(puntos, { ancho: 116, alto: 64 }, 5);
    for (const [id, entrada] of provinciaMarkers) entrada.boton.hidden = !visibles.has(id);
  }

  function actualizarEtiquetasBase(modo: ModoMapa): void {
    if (!mapa || modoEtiquetasAplicado === modo) return;
    const visibilidad = modo === 'nacional' ? 'none' : 'visible';
    for (const idCapa of CAPAS_OCULTAS_EN_VISTA_NACIONAL) {
      // El estilo remoto puede evolucionar. La ausencia de una etiqueta no
      // debe convertir un retoque visual en un fallo total del mapa.
      if (mapa.getLayer(idCapa)) mapa.setLayoutProperty(idCapa, 'visibility', visibilidad);
    }
    modoEtiquetasAplicado = modo;
  }

  /** Recalcula qué se ve como marcador individual, qué se agrupa en racimo
   *  y qué se oculta por colisión (ADR-0006). Se llama al terminar cada
   *  gesto del mapa (moveend/zoomend) y tras cada render por cambio de
   *  estado, nunca en cada fotograma de un arrastre. */
  function recalcularDisposicion(): void {
    if (!mapa || fallido || !cargado) return;
    const zoomActual = mapa.getZoom();
    modoMapa = modoMapaParaZoom(zoomActual, modoMapa);
    if (modoMapa === 'nacional' && resumenNacional) {
      actualizarEtiquetasBase('nacional');
      recalcularVistaNacional();
      return;
    }
    actualizarEtiquetasBase('zona');
    for (const entrada of provinciaMarkers.values()) entrada.boton.hidden = true;

    const proyectadas = ultimasVisibles.map((estacion) => {
      const punto = mapa!.project([estacion.lon, estacion.lat]);
      const mercator = MercatorCoordinate.fromLngLat([estacion.lon, estacion.lat]);
      const tamanoMundo = TAMANO_TILE_PX * 2 ** zoomActual;
      return {
        id: estacion.id,
        x: punto.x,
        y: punto.y,
        rejillaX: mercator.x * tamanoMundo,
        rejillaY: mercator.y * tamanoMundo,
        precio: estacion.precios[ultimoEstado.combustible],
      };
    });

    const racimos: Racimo[] = zoomActual < UMBRAL_ZOOM_RACIMOS ? agruparEnRacimos(proyectadas, RADIO_RACIMO_PX) : [];
    const idsEnRacimo = idsAgrupados(racimos);

    const puntosColision: PuntoColision[] = [];
    for (const p of proyectadas) {
      if (idsEnRacimo.has(p.id)) continue;
      const destacada = p.precio !== null && ultimaEscala.esMasBarata(p.precio);
      puntosColision.push({ id: p.id, x: p.x, y: p.y, precio: p.precio, ...(destacada ? CAJA_DESTACADA : CAJA_NORMAL) });
    }
    const racimosPorClave = new Map(racimos.map((racimo) => [claveRacimo(racimo.ids), racimo]));
    for (const [clave, racimo] of racimosPorClave) {
      puntosColision.push({ id: clave, x: racimo.x, y: racimo.y, precio: racimo.precioMinimo, ...CAJA_DESTACADA });
    }

    const visibles = resolverColisiones(puntosColision);

    for (const [id, entrada] of marcadores) {
      entrada.boton.hidden = idsEnRacimo.has(id) || !visibles.has(id);
    }

    for (const [clave, entrada] of racimoMarkers) {
      if (racimosPorClave.has(clave)) continue;
      entrada.marker.remove();
      racimoMarkers.delete(clave);
    }

    for (const [clave, racimo] of racimosPorClave) {
      let entrada = racimoMarkers.get(clave);
      if (!entrada) {
        entrada = crearMarcadorRacimo();
        racimoMarkers.set(clave, entrada);
      }
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
      entrada.boton.hidden = !visibles.has(clave);
    }
  }

  function render(estado: EstadoApp): void {
    if (!mapa || fallido || !cargado) return;

    // RF-48: las estaciones sin venta al público se excluyen, igual que en
    // la lista y la ficha. RF-15: cerradas atenuadas pero visibles, salvo
    // que el filtro de solo abiertas esté activo (entonces, igual que en la
    // lista, no se enseñan). Una estación que no vende el combustible activo
    // tampoco genera marcador ni entra en racimos o colisiones. Además, solo
    // las que tienen coordenadas de verdad: ver tieneCoordenadas.
    const visiblesTipoVenta = estacionesVisibles(estado.estaciones);
    const visiblesPorApertura = (
      estado.soloAbiertas ? visiblesTipoVenta.filter((e) => estaAbierta(e.horario, new Date())) : visiblesTipoVenta
    );
    const visibles = estacionesQueVenden(visiblesPorApertura, estado.combustible).filter(tieneCoordenadas);

    const idsVisibles = new Set(visibles.map((e) => e.id));
    for (const [id, entrada] of marcadores) {
      if (!idsVisibles.has(id)) {
        entrada.marker.remove();
        marcadores.delete(id);
      }
    }

    // RF-12: la banda de color sale del percentil dentro de la zona y
    // combustible mostrados, la misma escala que usa la lista.
    const escala = crearEscala(preciosDeCombustible(visiblesTipoVenta, estado.combustible));

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
      if (omitirSiguienteEncuadrePorProvincia) {
        omitirSiguienteEncuadrePorProvincia = false;
      } else {
        encuadrarTodas(visibles);
      }
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

    // RF-17: sobre el mapa, junto al resto de controles de MapLibre — no en
    // la cabecera (presupuesto de interfaz, docs/05-diseno.md).
    mapa.addControl(new ControlUbicacion(alEncontrarUbicacion), 'top-right');

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
      modoMapa = modoMapaParaZoom(mapa!.getZoom(), 'zona');
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

  void cargarResumenNacional().then((resumen) => {
    if (!resumen || !mapa || fallido) return;
    resumenNacional = resumen;
    for (const provincia of resumen.provincias) {
      if (provinciaMarkers.has(provincia.id)) continue;
      provinciaMarkers.set(provincia.id, crearMarcadorProvincia(provincia));
    }
    recalcularDisposicion();
  });

  return () => {
    cancelarSuscripcion();
    if (vigilante) clearTimeout(vigilante);
    observador?.disconnect();
    for (const entrada of marcadores.values()) entrada.marker.remove();
    marcadores.clear();
    for (const entrada of racimoMarkers.values()) entrada.marker.remove();
    racimoMarkers.clear();
    for (const entrada of provinciaMarkers.values()) entrada.marker.remove();
    provinciaMarkers.clear();
    try {
      mapa?.remove();
    } catch {
      // Desmontaje: si ya ha fallado antes, el mapa puede ser null o estar
      // a medio destruir. No es un problema real, se ignora.
    }
    mapa = null;
  };
}
