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
}

export type TipoZona = 'provincia' | 'ccaa' | 'medida';

export interface Zona {
  id: string;
  nombre: string;
  tipo: TipoZona;
  provincias: string[];
}

export interface Indice {
  actualizado: string;
  mock?: true;
  provincias: ResumenProvincia[];
  zonas: Zona[];
}
