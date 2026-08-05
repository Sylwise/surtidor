// Estado de la aplicación: un objeto plano con suscriptores, sin librería de
// gestión de estado (ADR-0004). Si esto se queda corto, la señal es escribir
// un ADR nuevo, no traer Redux desde el principio.
//
// Regla dura 4 de CLAUDE.md: solo zona, combustible y depósito van a
// localStorage (RF-34). Nada de telemetría, nada más en ningún otro sitio.

import type { ClavePrecio } from '../../scripts/lib/tipos.ts';
import type { EstacionZona, FalloProvincia } from './zona.ts';

export interface EstadoApp {
  /** Id de la zona activa (Zona.id en indice.json). */
  zonaId: string;
  /** Nombre para mostrar de la zona activa, resuelto contra el índice. */
  zonaNombre: string;
  /** Combustible activo: ordena la lista, colorea las píldoras y fija el
   *  combustible del cálculo de ahorro. */
  combustible: ClavePrecio;
  /** Id de la estación elegida en la lista, o null si no hay ninguna. */
  estacionId: string | null;
  /** Filtro "solo abiertas ahora" (CU-4). */
  soloAbiertas: boolean;
  /** Tamaño del depósito en litros, para el cálculo de ahorro (RF-33). */
  deposito: number;

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

interface Preferencias {
  zonaId?: string;
  combustible?: ClavePrecio;
  deposito?: number;
}

function leerPreferencias(): Preferencias {
  try {
    const crudo = localStorage.getItem(CLAVE_LOCALSTORAGE);
    if (!crudo) return {};
    const datos = JSON.parse(crudo) as Record<string, unknown>;
    const resultado: Preferencias = {};
    if (typeof datos.zonaId === 'string') resultado.zonaId = datos.zonaId;
    if (typeof datos.combustible === 'string') resultado.combustible = datos.combustible as ClavePrecio;
    if (typeof datos.deposito === 'number' && Number.isFinite(datos.deposito) && datos.deposito > 0) {
      resultado.deposito = datos.deposito;
    }
    return resultado;
  } catch {
    // localStorage puede no existir (SSR) o fallar (modo privado, cuota).
    // Se pierde la persistencia, no la aplicación.
    return {};
  }
}

function guardarPreferencias(estado: EstadoApp): void {
  try {
    const preferencias: Preferencias = {
      zonaId: estado.zonaId,
      combustible: estado.combustible,
      deposito: estado.deposito,
    };
    localStorage.setItem(CLAVE_LOCALSTORAGE, JSON.stringify(preferencias));
  } catch {
    // Ídem: no es crítico.
  }
}

// Por defecto, hasta que exista detección por geolocalización (RF-37, fuera
// de H6): "Euskadi y alrededores" es la zona multi-provincia de la fixture y
// deja la aplicación usable nada más abrir.
const ZONA_POR_DEFECTO = 'euskadi-plus';
const COMBUSTIBLE_POR_DEFECTO: ClavePrecio = 'gasolina95e5';
const DEPOSITO_POR_DEFECTO = 50;

const guardado = typeof localStorage === 'undefined' ? {} : leerPreferencias();

let estado: EstadoApp = {
  zonaId: guardado.zonaId ?? ZONA_POR_DEFECTO,
  zonaNombre: '',
  combustible: guardado.combustible ?? COMBUSTIBLE_POR_DEFECTO,
  estacionId: null,
  soloAbiertas: false,
  deposito: guardado.deposito ?? DEPOSITO_POR_DEFECTO,
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

const CLAVES_PERSISTIDAS = new Set<keyof EstadoApp>(['zonaId', 'combustible', 'deposito']);

/** Aplica un parche al estado y avisa a quien esté suscrito. Si el parche
 *  toca zona, combustible o depósito, se persiste (RF-34). */
export function actualizarEstado(cambios: Partial<EstadoApp>): void {
  estado = { ...estado, ...cambios };
  if (Object.keys(cambios).some((clave) => CLAVES_PERSISTIDAS.has(clave as keyof EstadoApp))) {
    guardarPreferencias(estado);
  }
  for (const fn of suscriptores) fn(estado);
}
