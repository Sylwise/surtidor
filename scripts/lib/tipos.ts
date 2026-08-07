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

/** Rectángulo envolvente en WGS84. Aproximación grosera a propósito
 *  (ADR-0014): se solapa con el de provincias vecinas, y eso es barato y
 *  correcto — que sobre es inofensivo, que falte es el fallo a evitar. */
export interface Rectangulo {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
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
  /** Rectángulo envolvente de las estaciones de la provincia (ADR-0014,
   *  H12): decide qué se carga al mover el mapa. */
  rectangulo: Rectangulo;
  /** Peso en bytes del fichero de la provincia comprimido con gzip, medido
   *  en el build sobre el JSON real que se escribe. Vigila el listón de 300
   *  KB de ADR-0005 cuando "el mapa manda" (ADR-0014) suma provincias. */
  pesoComprimido: number;
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
 *  propia. Por debajo no se genera: `functions/[provincia]/[municipio].js`
 *  (ver ADR-0010) manda esas URLs a la página de su provincia. */
export const MINIMO_ESTACIONES_MUNICIPIO = 3;

/** Índice del catálogo de municipios, en `datos-build/municipios.json`.
 *  Deliberadamente FUERA de `public/`: no lo lee nunca el navegador, solo
 *  `getStaticPaths` de `src/pages/[provincia]/[municipio]/index.astro` y
 *  `src/pages/sitemap.xml.ts`, en el build. Separado de `Indice` porque
 *  `Indice` sí viaja al navegador en cada página (el selector de zona lo
 *  pide siempre) y el catálogo de municipios no le sirve para nada: llevarlo
 *  ahí añadía ~28 KB comprimidos a cada una de las 1161 páginas. */
export interface IndiceMunicipios {
  actualizado: string;
  municipios: ResumenMunicipio[];
}

export interface Indice {
  actualizado: string;
  mock?: true;
  provincias: ResumenProvincia[];
  zonas: Zona[];
}
