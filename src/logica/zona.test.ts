// Prueba obligatoria del hito H6 (docs/06-roadmap.md#H6): carga en paralelo
// y fusión de una zona con varias provincias, con Euskadi como caso real de
// tres. Incluye el fallo parcial (RF-36): una provincia que falla no debe
// tumbar las otras dos.

import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cargarZona } from './zona.ts';
import type { DatosProvincia, Estacion, ResumenProvincia, Zona } from '../../scripts/lib/tipos.ts';

function estacion(extra: Partial<Estacion> = {}): Estacion {
  return {
    id: '1',
    rotulo: 'BALLENOIL',
    direccion: 'CALLE FALSA 1',
    municipio: 'VITORIA-GASTEIZ',
    cp: '01013',
    lat: 42.8695,
    lon: -2.6716,
    horario: 'L-D: 24H',
    tipoVenta: 'P',
    margen: 'D',
    precios: {
      gasolina95e5: 1.409,
      gasoleoA: 1.489,
      gasolina98e5: null,
      gasoleoPremium: null,
    },
    ...extra,
  };
}

function datosProvincia(id: string, nombre: string, actualizado: string, estaciones: Estacion[]): DatosProvincia {
  return {
    provincia: { id, nombre },
    actualizado,
    fechaMiteco: '05/08/2026 11:00:00',
    estaciones,
  };
}

// Euskadi tal y como la declara docs/03-arquitectura.md: ccaa-16, tres
// provincias (Álava, Bizkaia, Gipuzkoa).
const ZONA_EUSKADI: Zona = {
  id: 'ccaa-16',
  nombre: 'Euskadi',
  tipo: 'ccaa',
  provincias: ['01', '48', '20'],
};

const CATALOGO_PROVINCIAS: ResumenProvincia[] = [
  { id: '01', nombre: 'ARABA/ALAVA', estaciones: 1, minimos: {} },
  { id: '48', nombre: 'BIZKAIA', estaciones: 1, minimos: {} },
  { id: '20', nombre: 'GIPUZKOA', estaciones: 1, minimos: {} },
];

const fetchOriginal = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

/** Sustituye `fetch` por un mock que responde según la ruta pedida, tal y
 *  como `cargarZona` la construye (`/data/provincias/{id}.json`). */
function mockearFetch(porProvincia: Record<string, DatosProvincia | 'error'>): void {
  globalThis.fetch = (async (entrada: RequestInfo | URL) => {
    const ruta = String(entrada);
    const id = ruta.match(/provincias\/(\d+)\.json/)?.[1];
    const datos = id ? porProvincia[id] : undefined;
    if (!datos || datos === 'error') {
      return { ok: false, status: 500, json: async () => ({}) } as Response;
    }
    return { ok: true, status: 200, json: async () => datos } as Response;
  }) as typeof fetch;
}

describe('cargarZona con Euskadi (tres provincias)', () => {
  it('fusiona las estaciones de las tres provincias con su origen adjunto', async () => {
    mockearFetch({
      '01': datosProvincia('01', 'ARABA/ALAVA', '2026-08-06T10:00:00Z', [estacion({ id: 'a1' })]),
      '48': datosProvincia('48', 'BIZKAIA', '2026-08-06T09:00:00Z', [estacion({ id: 'b1' }), estacion({ id: 'b2' })]),
      '20': datosProvincia('20', 'GIPUZKOA', '2026-08-06T11:00:00Z', [estacion({ id: 'g1' })]),
    });

    const resultado = await cargarZona(ZONA_EUSKADI, CATALOGO_PROVINCIAS);

    assert.equal(resultado.estaciones.length, 4);
    assert.equal(resultado.provinciasFallidas.length, 0);
    assert.equal(resultado.mock, false);

    const porId = new Map(resultado.estaciones.map((e) => [e.id, e]));
    assert.equal(porId.get('a1')?.provinciaId, '01');
    assert.equal(porId.get('a1')?.provinciaNombre, 'ARABA/ALAVA');
    assert.equal(porId.get('b2')?.provinciaId, '48');
    assert.equal(porId.get('g1')?.provinciaNombre, 'GIPUZKOA');

    // El dato de la zona es tan fresco como su provincia más antigua.
    assert.equal(resultado.actualizado, '2026-08-06T09:00:00Z');
  });

  it('propaga mock:true si alguna provincia cargada viene marcada como prueba', async () => {
    const bizkaiaMock: DatosProvincia = {
      ...datosProvincia('48', 'BIZKAIA', '2026-08-06T09:00:00Z', [estacion({ id: 'b1' })]),
      mock: true,
    };
    mockearFetch({
      '01': datosProvincia('01', 'ARABA/ALAVA', '2026-08-06T10:00:00Z', [estacion({ id: 'a1' })]),
      '48': bizkaiaMock,
      '20': datosProvincia('20', 'GIPUZKOA', '2026-08-06T11:00:00Z', [estacion({ id: 'g1' })]),
    });

    const resultado = await cargarZona(ZONA_EUSKADI, CATALOGO_PROVINCIAS);
    assert.equal(resultado.mock, true);
  });

  it('fallo parcial (RF-36): si una provincia falla, las otras dos se muestran igual', async () => {
    mockearFetch({
      '01': datosProvincia('01', 'ARABA/ALAVA', '2026-08-06T10:00:00Z', [estacion({ id: 'a1' })]),
      '48': 'error',
      '20': datosProvincia('20', 'GIPUZKOA', '2026-08-06T11:00:00Z', [estacion({ id: 'g1' })]),
    });

    const resultado = await cargarZona(ZONA_EUSKADI, CATALOGO_PROVINCIAS);

    assert.equal(resultado.estaciones.length, 2);
    assert.deepEqual(
      resultado.estaciones.map((e) => e.id).sort(),
      ['a1', 'g1'],
    );
    assert.equal(resultado.provinciasFallidas.length, 1);
    assert.equal(resultado.provinciasFallidas[0]?.id, '48');
    assert.equal(resultado.provinciasFallidas[0]?.nombre, 'BIZKAIA');

    // Con una provincia fallida, la frescura se calcula solo con las que sí
    // llegaron: Álava y Gipuzkoa, no la de Bizkaia que nunca llegó.
    assert.equal(resultado.actualizado, '2026-08-06T10:00:00Z');
  });

  it('fallo parcial: si fallan las tres, no hay estaciones pero se informa de las tres', async () => {
    mockearFetch({ '01': 'error', '48': 'error', '20': 'error' });

    const resultado = await cargarZona(ZONA_EUSKADI, CATALOGO_PROVINCIAS);

    assert.equal(resultado.estaciones.length, 0);
    assert.equal(resultado.provinciasFallidas.length, 3);
    assert.equal(resultado.actualizado, null);
  });
});
