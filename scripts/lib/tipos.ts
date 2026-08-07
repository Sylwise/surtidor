// Contrato de datos, ver docs/03-arquitectura.md.
// Única fuente de verdad de estos tipos: los usan scripts/ y src/logica/ por igual.

export type ClavePrecio =
  | 'gasolina95e5'
  | 'gasoleoA'
  | 'gasolina98e5'
  | 'gasoleoPremium';

export type Precios = Record<ClavePrecio, number | null>;

export type TipoVenta = 'P' | 'R' | 'A';

export type Margen = 'D' | 'I' | 'N' | null;

export interface Estacion {
  id: string;
  rotulo: string;
  direccion: string;
  municipio: string;
  cp: string;
  lat: number;
  lon: number;
  horario: string;
  tipoVenta: TipoVenta;
  margen: Margen;
  precios: Precios;
}

export interface DatosProvincia {
  provincia: { id: string; nombre: string };
  actualizado: string;
  fechaMiteco: string;
  mock?: true;
  estaciones: Estacion[];
}

export interface ResumenProvincia {
  id: string;
  nombre: string;
  estaciones: number;
  minimos: Partial<Record<ClavePrecio, number>>;
  /** Centro de la provincia: media de las coordenadas de sus estaciones, no
   *  un límite administrativo. Solo sirve para encontrar la provincia más
   *  cercana a una posición (RF-37); no es una forma de dibujar fronteras. */
  centro: { lat: number; lon: number };
}

export type TipoZona = 'provincia' | 'ccaa';

export interface Zona {
  id: string;
  nombre: string;
  tipo: TipoZona;
  provincias: string[];
}

/** Un municipio con al menos una estación visible (RF-48), tal como lo
 *  cruza scripts/descargar-datos.ts entre `Listados/Municipios` y las
 *  estaciones reales de su provincia. `nombre` es el nombre canónico del
 *  catálogo del ministerio (RF-76): las páginas de municipio (H10, segunda
 *  mitad) se generan solo para los que llegan a RF-60 (3 estaciones o más);
 *  los slugs de URL se derivan de `nombre` con scripts/lib/slug.ts, siempre
 *  en el momento de usarse, nunca guardados aquí. */
export interface ResumenMunicipio {
  nombre: string;
  provinciaId: string;
  estaciones: number;
}

/** RF-60: mínimo de estaciones visibles para que un municipio tenga página
 *  propia. Por debajo no se genera: `public/_redirects` (generado en el
 *  mismo paso que `indice.json`) manda esas URLs a la página de su
 *  provincia. */
export const MINIMO_ESTACIONES_MUNICIPIO = 3;

export interface Indice {
  actualizado: string;
  mock?: true;
  provincias: ResumenProvincia[];
  zonas: Zona[];
  municipios: ResumenMunicipio[];
}
