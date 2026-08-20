// Contrato de datos, ver docs/03-arquitectura.md.
// Única fuente de verdad de estos tipos: los usan scripts/ y src/logica/ por igual.

export type ClavePrecio =
  | 'gasolina95e5'
  | 'gasoleoA'
  | 'gasolina98e5'
  | 'gasoleoPremium'
  | 'gasoleoB'
  | 'glp';

export type Precios = Record<ClavePrecio, number | null>;

/** La ventana histórica anterior a V2-12 conserva su contrato de cuatro
 * series. Los nuevos combustibles entran en datos actuales y editoriales;
 * ampliar el artefacto histórico requiere una migración propia. */
export type ClavePrecioHistorico = Exclude<ClavePrecio, 'gasoleoB' | 'glp'>;

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

export interface MediaProvinciaNacional {
  media: number | null;
  n: number;
}

export interface ProvinciaNacional {
  id: string;
  nombre: string;
  centro: { lat: number; lon: number };
  combustibles: Record<ClavePrecio, MediaProvinciaNacional>;
}

/** Resumen ligero que consume exclusivamente la vista nacional de V2-18. */
export interface ResumenNacional {
  actualizado: string;
  mock?: true;
  provincias: ProvinciaNacional[];
}
