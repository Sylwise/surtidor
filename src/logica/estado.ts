// Estado de la aplicación: un objeto plano con suscriptores, sin librería de
// gestión de estado (ADR-0004). Si esto se queda corto, la señal es escribir
// un ADR nuevo, no traer Redux desde el principio.
//
// Regla dura 4 de CLAUDE.md: solo preferencias del propio usuario van a
// localStorage (RF-34). Nada de telemetría, nada más en ningún otro sitio.

import type { ClavePrecio } from '../../scripts/lib/tipos.ts';
import type { EstacionZona, FalloProvincia } from './zona.ts';
import type { PosicionUsuario } from './cercania.ts';

export type OrdenLista = 'precio' | 'distancia';

export interface EstadoApp {
  /** Id de la zona activa (Zona.id en indice.json), o null si todavía no se
   *  ha resuelto ninguna (RF-49: sin zona por defecto, cada página decide). */
  zonaId: string | null;
  /** Nombre para mostrar de la zona activa, resuelto contra el índice. */
  zonaNombre: string;
  /** Combustible activo: ordena la lista, colorea las píldoras y fija el
   *  combustible del cálculo de ahorro. */
  combustible: ClavePrecio;
  /** Id de la estación elegida en la lista, o null si no hay ninguna. */
  estacionId: string | null;
  /** Filtro "solo abiertas ahora" (CU-4). */
  soloAbiertas: boolean;
  /** Litros a repostar, para el cálculo de ahorro (RF-33). No "depósito":
   *  casi nadie llena desde vacío. */
  litros: number;
  /** Posición concedida durante esta carga. Es efímera: RNF-31 y V2-13. */
  ubicacionUsuario: PosicionUsuario | null;
  /** Orden actual de la lista. Tampoco se persiste entre visitas. */
  ordenLista: OrdenLista;

  /** Estaciones fusionadas de la zona activa (src/logica/zona.ts). */
  estaciones: EstacionZona[];
  /** Provincias de la zona que no se han podido cargar (RF-36). */
  provinciasFallidas: FalloProvincia[];
  /** true mientras se está cargando la zona activa. */
  cargando: boolean;
  /** Mensaje de error si la zona no ha podido cargar nada en absoluto. */
  error: string | null;
  /** true si alguno de los ficheros cargados es de prueba (`mock: true`). */
  mock: boolean;
}

const CLAVE_LOCALSTORAGE = 'surtidor:preferencias';

export interface Preferencias {
  zonaId?: string;
  combustible?: ClavePrecio;
  litros?: number;
}

export function normalizarPreferencias(valor: unknown): Preferencias {
  if (!valor || typeof valor !== 'object') return {};
  const datos = valor as Record<string, unknown>;
  const resultado: Preferencias = {};
  if (typeof datos.zonaId === 'string') resultado.zonaId = datos.zonaId;
  if (typeof datos.combustible === 'string') resultado.combustible = datos.combustible as ClavePrecio;
  if (typeof datos.litros === 'number' && Number.isFinite(datos.litros) && datos.litros > 0) resultado.litros = datos.litros;
  return resultado;
}

function leerPreferencias(): Preferencias {
  try {
    const crudo = localStorage.getItem(CLAVE_LOCALSTORAGE);
    if (!crudo) return {};
    return normalizarPreferencias(JSON.parse(crudo));
  } catch {
    // localStorage puede no existir (SSR) o fallar (modo privado, cuota).
    // Se pierde la persistencia, no la aplicación.
    return {};
  }
}

function guardarPreferencias(estado: EstadoApp): void {
  try {
    const preferencias: Preferencias = {
      zonaId: estado.zonaId ?? undefined,
      combustible: estado.combustible,
      litros: estado.litros,
    };
    localStorage.setItem(CLAVE_LOCALSTORAGE, JSON.stringify(preferencias));
  } catch {
    // Ídem: no es crítico.
  }
}

// No hay zona por defecto (RF-49; ver la corrección de 2026-08-06 en
// ADR-0005): elegir una de entrada por el usuario es la misma decisión
// editorial que se acaba de retirar. Sin zona guardada, `zonaId` queda a
// `null` y cada página decide qué hacer mientras tanto: src/pages/index.astro
// abre el selector, src/pages/[zona]/index.astro usa la zona de su URL.
const COMBUSTIBLE_POR_DEFECTO: ClavePrecio = 'gasolina95e5';
const LITROS_POR_DEFECTO = 20;

const guardado = typeof localStorage === 'undefined' ? {} : leerPreferencias();

let estado: EstadoApp = {
  zonaId: guardado.zonaId ?? null,
  zonaNombre: '',
  combustible: guardado.combustible ?? COMBUSTIBLE_POR_DEFECTO,
  estacionId: null,
  soloAbiertas: false,
  litros: guardado.litros ?? LITROS_POR_DEFECTO,
  ubicacionUsuario: null,
  ordenLista: 'precio',
  estaciones: [],
  provinciasFallidas: [],
  cargando: true,
  error: null,
  mock: false,
};

type Suscriptor = (estado: EstadoApp) => void;
const suscriptores = new Set<Suscriptor>();

/** Estado actual. Siempre el mismo objeto hasta la próxima actualización, para
 *  que comparar referencias sea barato. */
export function obtenerEstado(): EstadoApp {
  return estado;
}

/** Se suscribe a cualquier cambio de estado. Devuelve la función para
 *  desuscribirse. */
export function suscribir(fn: Suscriptor): () => void {
  suscriptores.add(fn);
  return () => suscriptores.delete(fn);
}

const CLAVES_PERSISTIDAS = new Set<keyof EstadoApp>(['zonaId', 'combustible', 'litros']);

/** Aplica un parche al estado y avisa a quien esté suscrito. Si el parche
 *  toca zona, combustible o litros, se persiste (RF-34). */
export function actualizarEstado(cambios: Partial<EstadoApp>): void {
  estado = { ...estado, ...cambios };
  if (Object.keys(cambios).some((clave) => CLAVES_PERSISTIDAS.has(clave as keyof EstadoApp))) {
    guardarPreferencias(estado);
  }
  for (const fn of suscriptores) fn(estado);
}
