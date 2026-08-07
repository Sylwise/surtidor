// "El mapa manda" (ADR-0014, H12): orquesta lo que decide src/logica/
// vistaDinamica.ts — pide y suelta ficheros de provincia, fusiona, y aplica
// los tres efectos que dependen de lo cargado (estado global, selector,
// dirección) a través de un "puente" que implementa cada página. Root
// (src/pages/index.astro) y zona (src/componentes/AppInteractiva.astro, solo
// cuando `mapaManda` es `true`) instancian su propio controlador; municipio
// no lo instancia nunca — ADR-0014 punto 4 — así que nada de este fichero se
// ejecuta ahí.
//
// El puente existe para que este módulo no sepa nada de navegación de
// páginas: cada página decide cómo aplicar un cambio de estado sin disparar
// la navegación que sí dispara un cambio de zona hecho a mano en el selector
// (ver `aplicarEstadoDesdeMapa` más abajo y su uso en AppInteractiva.astro /
// index.astro).

import { cargarProvincias, fusionarProvincias, type FalloProvincia } from './zona.ts';
import { calcularVista, UMBRAL_ZOOM_CARGA_DINAMICA } from './vistaDinamica.ts';
import { construirUrlZonas } from './zonasUrl.ts';
import type { EstadoApp, OrigenCambio } from './estado.ts';
import type { DatosProvincia, Indice, Rectangulo } from '../../scripts/lib/tipos.ts';

export interface PuenteMapaManda {
  /** `null` mientras el índice todavía no ha llegado: `alMoverVista` no hace
   *  nada hasta entonces (no hay con qué calcular la vista). */
  obtenerIndice(): Indice | null;
  /** Fuerza el texto "Personalizado" en el selector (más de una provincia
   *  cargada) o lo devuelve a lo normal (una sola, o vacío). No añade ninguna
   *  entrada a la lista desplegable: ver Controles.ts. */
  establecerPersonalizado(activo: boolean): void;
  /** Aplica cambios de estado que vienen de "el mapa manda". A diferencia de
   *  llamar a `actualizarEstado` a secas, la página que implemente esto debe
   *  recordar que el cambio de `zonaId` que puede venir aquí NO tiene que
   *  navegar a la página estática de esa zona (a diferencia de un click en
   *  el selector, RF-32): la dirección la cambia este módulo con
   *  `reemplazarDireccion`, sin recargar. `origen` viaja tal cual hasta
   *  `actualizarEstado` (ADR-0014, punto 3 bis): `'eleccion'` desde
   *  `cargarDesdeUrl` (llegar con `?zonas=` es una elección explícita),
   *  `'movimiento'` desde `alMoverVista` — nunca al revés. */
  aplicarEstadoDesdeMapa(cambios: Partial<EstadoApp>, origen: OrigenCambio): void;
  /** `history.replaceState` a `href`, sin recargar y sin tocar `<title>` ni
   *  el resto del HTML servido (ADR-0014). */
  reemplazarDireccion(href: string): void;
}

export interface ControladorMapaManda {
  /** Al terminar un movimiento del mapa (agrupado, ver Mapa.ts): recalcula
   *  qué provincias deberían estar cargadas y aplica la diferencia. */
  alMoverVista(vista: Rectangulo, zoom: number): void;
  /** Reconstruye un conjunto ya conocido (típicamente desde `?zonas=` al
   *  cargar la página, ADR-0014). */
  cargarDesdeUrl(idsProvincia: string[]): Promise<void>;
  /** Reintenta la última vista conocida: lo que faltó por cargar (fallo de
   *  red o presupuesto) se recalcula desde cero, así que si ya cabe o ya
   *  responde, se añade solo. */
  reintentar(): void;
}

const MOTIVO_PRESUPUESTO = 'no cargada: esta vista supera el límite de 300 KB comprimidos (ADR-0005)';

export function crearControladorMapaManda(puente: PuenteMapaManda): ControladorMapaManda {
  // Provincias que tenemos en memoria ahora mismo, con sus datos completos
  // (no solo el id): así, cuando el conjunto cambia, solo hay que pedir las
  // que faltan — las que se mantienen no se vuelven a descargar.
  const cargados = new Map<string, DatosProvincia>();
  let ultimaVista: Rectangulo | null = null;
  let ultimoZoom: number | null = null;

  function hrefDe(ids: string[]): string {
    return ids.length === 1 ? `/p-${ids[0]}/` : construirUrlZonas(ids);
  }

  async function aplicarConjunto(
    idsObjetivo: string[],
    origen: OrigenCambio,
    excluidasPorPresupuesto: string[] = [],
  ): Promise<void> {
    // Vista de mar adentro o de fuera de España: nada supera el umbral. Se
    // conserva lo que ya había en vez de vaciar la pantalla — "se sueltan al
    // salir de la vista" habla de provincias que pierden sitio ante otras,
    // no de dejar la aplicación sin nada que enseñar.
    if (idsObjetivo.length === 0) return;

    const indice = puente.obtenerIndice();
    if (!indice) return;

    const idsAFaltar = idsObjetivo.filter((id) => !cargados.has(id));
    const idsASoltar = [...cargados.keys()].filter((id) => !idsObjetivo.includes(id));

    for (const id of idsASoltar) cargados.delete(id);

    let fallidas: FalloProvincia[] = [];
    if (idsAFaltar.length > 0) {
      const resultado = await cargarProvincias(idsAFaltar, indice.provincias);
      for (const [id, datos] of resultado.cargadas) cargados.set(id, datos);
      fallidas = resultado.provinciasFallidas;
    }

    // Orden: idsObjetivo ya llega de calcularVista de más a menos pantalla
    // ocupada, así que la primera que sí tengamos cargada es la dominante
    // (ADR-0014 punto 3).
    const idsCargados = idsObjetivo.filter((id) => cargados.has(id));
    const datosCargados = idsCargados.map((id) => cargados.get(id) as DatosProvincia);
    const { estaciones, mock } = fusionarProvincias(datosCargados);

    const dominanteId = idsCargados[0] ?? null;
    const dominante = dominanteId ? indice.provincias.find((p) => p.id === dominanteId) : undefined;

    const fallidasPresupuesto: FalloProvincia[] = excluidasPorPresupuesto.map((id) => ({
      id,
      nombre: indice.provincias.find((p) => p.id === id)?.nombre ?? id,
      motivo: MOTIVO_PRESUPUESTO,
    }));

    puente.establecerPersonalizado(idsCargados.length > 1);
    puente.aplicarEstadoDesdeMapa(
      {
        zonaId: dominante ? `p-${dominante.id}` : null,
        zonaNombre: dominante?.nombre ?? '',
        estaciones,
        provinciasFallidas: [...fallidas, ...fallidasPresupuesto],
        mock,
        cargando: false,
        error:
          idsCargados.length === 0 && fallidas.length > 0
            ? 'No se han podido cargar los datos de esta vista del mapa.'
            : null,
      },
      origen,
    );

    if (idsCargados.length > 0) {
      puente.reemplazarDireccion(hrefDe([...idsCargados].sort()));
    }
  }

  function alMoverVista(vista: Rectangulo, zoom: number): void {
    ultimaVista = vista;
    ultimoZoom = zoom;
    const indice = puente.obtenerIndice();
    if (!indice) return;

    // Traza deliberada (encargo de corrección de H12): mientras esta guarda
    // provisional (ADR-0014, punto 5, a sustituir por V2-18) esté activa, se
    // avisa por consola de que está suprimiendo la carga dinámica. Que se
    // apagara en silencio es lo que hizo que el bucle de encuadre de más
    // abajo pareciera "el mapa no vuelve a cargar nada" en vez de lo que
    // era: un bucle de fitBounds que acababa alejando el zoom hasta pisar
    // esta guarda.
    if (zoom < UMBRAL_ZOOM_CARGA_DINAMICA) {
      console.info(
        `[ADR-0014] Guarda de zoom provisional activa (zoom ${zoom.toFixed(2)} < ${UMBRAL_ZOOM_CARGA_DINAMICA}): ` +
          'se suprime la carga dinámica y se conserva lo que ya había cargado. La sustituirá V2-18 (vista nacional).',
      );
    }

    const resultado = calcularVista(indice.provincias, vista, zoom, [...cargados.keys()]);
    void aplicarConjunto(
      resultado.provincias.map((p) => p.id),
      'movimiento',
      resultado.excluidasPorPresupuesto.map((p) => p.id),
    );
  }

  function reintentar(): void {
    if (ultimaVista && ultimoZoom !== null) alMoverVista(ultimaVista, ultimoZoom);
  }

  async function cargarDesdeUrl(idsProvincia: string[]): Promise<void> {
    // Llegar con `?zonas=` es una elección explícita (ADR-0014, punto 3
    // bis): sí dispara el encuadre inicial, igual que abrir cualquier zona.
    await aplicarConjunto(idsProvincia, 'eleccion');
  }

  return { alMoverVista, cargarDesdeUrl, reintentar };
}
