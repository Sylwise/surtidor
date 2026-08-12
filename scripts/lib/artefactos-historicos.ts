import { expandirTerritorios, validarEstadoHistorico, type EstadoHistorico } from './estado-historico.ts';
import type { ClavePrecio } from './tipos.ts';
import type { PrecioHistorico } from './historico.ts';

export type PuntoAgregadoHistorico = [
  sumaMilesimas: number,
  observaciones: number,
  minimoMilesimas: number | null,
];

export type AgregadoHistorico = Record<ClavePrecio, PuntoAgregadoHistorico[]>;

export type SerieHistoricaPublica = [
  id: string,
  municipioIdActual: string | null,
  presencia: Array<0 | 1>,
  gasolina95e5: PrecioHistorico[],
  gasoleoA: PrecioHistorico[],
  gasolina98e5: PrecioHistorico[],
  gasoleoPremium: PrecioHistorico[],
];

export interface HistoricoProvincia {
  version: 1;
  provinciaId: string;
  fechas: string[];
  /** Copia de `EstadoHistorico.mock`: `comprobar-datos-reales.ts` la detecta
   *  igual que `DatosProvincia.mock` (RNF-43/RNF-44). */
  mock?: true;
  estaciones: SerieHistoricaPublica[];
  provincia: AgregadoHistorico;
  municipios: Record<string, AgregadoHistorico>;
}

const CLAVES_PRECIO: ClavePrecio[] = [
  'gasolina95e5',
  'gasoleoA',
  'gasolina98e5',
  'gasoleoPremium',
];

function agregadoVacio(dias: number): AgregadoHistorico {
  return Object.fromEntries(
    CLAVES_PRECIO.map((clave) => [
      clave,
      Array.from({ length: dias }, (): PuntoAgregadoHistorico => [0, 0, null]),
    ]),
  ) as AgregadoHistorico;
}

function acumular(punto: PuntoAgregadoHistorico, precio: PrecioHistorico): void {
  if (precio === null) return;
  punto[0] += precio;
  punto[1] += 1;
  punto[2] = punto[2] === null ? precio : Math.min(punto[2], precio);
}

interface ProvinciaMutable {
  estaciones: SerieHistoricaPublica[];
  provincia: AgregadoHistorico;
  municipios: Map<string, AgregadoHistorico>;
}

export function construirHistoricosProvincia(
  estado: EstadoHistorico,
): Map<string, HistoricoProvincia> {
  validarEstadoHistorico(estado);
  const dias = estado.fechas.length;
  const provincias = new Map<string, ProvinciaMutable>();
  const obtenerProvincia = (provinciaId: string): ProvinciaMutable => {
    let provincia = provincias.get(provinciaId);
    if (!provincia) {
      provincia = { estaciones: [], provincia: agregadoVacio(dias), municipios: new Map() };
      provincias.set(provinciaId, provincia);
    }
    return provincia;
  };

  for (const serie of estado.estaciones) {
    const territorios = expandirTerritorios(serie[1], dias);
    const presencia = territorios.map<0 | 1>((territorio) => (territorio === null ? 0 : 1));
    const publica: SerieHistoricaPublica = [
      serie[0],
      null,
      presencia,
      [...serie[2]],
      [...serie[3]],
      [...serie[4]],
      [...serie[5]],
    ];
    const seriesPrecios = [serie[2], serie[3], serie[4], serie[5]] as const;
    const provinciasObservadas = new Set(
      territorios
        .map((territorio) => territorio?.[0])
        .filter((provinciaId): provinciaId is string => provinciaId !== undefined),
    );
    for (const provinciaId of provinciasObservadas) {
      const copia: SerieHistoricaPublica = [...publica];
      copia[1] = [...territorios].reverse().find((territorio) => territorio?.[0] === provinciaId)?.[1] ?? null;
      obtenerProvincia(provinciaId).estaciones.push(copia);
    }

    for (const [indiceDia, territorio] of territorios.entries()) {
      if (territorio === null) continue;
      const [provinciaId, municipioId] = territorio;
      const provincia = obtenerProvincia(provinciaId);
      let municipio = provincia.municipios.get(municipioId);
      if (!municipio) {
        municipio = agregadoVacio(dias);
        provincia.municipios.set(municipioId, municipio);
      }
      for (const [indicePrecio, clave] of CLAVES_PRECIO.entries()) {
        const precio = seriesPrecios[indicePrecio]![indiceDia] ?? null;
        acumular(provincia.provincia[clave][indiceDia]!, precio);
        acumular(municipio[clave][indiceDia]!, precio);
      }
    }
  }

  return new Map(
    [...provincias.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([provinciaId, valor]) => [
      provinciaId,
      {
        version: 1,
        provinciaId,
        fechas: estado.fechas,
        ...(estado.mock ? { mock: true as const } : {}),
        estaciones: valor.estaciones,
        provincia: valor.provincia,
        municipios: Object.fromEntries([...valor.municipios.entries()].sort(([a], [b]) => a.localeCompare(b))),
      },
    ]),
  );
}
