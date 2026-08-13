import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AgregadoHistorico, HistoricoProvincia } from './artefactos-historicos.ts';
import type { AgregadoRotulo, AgregadoZona, AgregadosEditoriales, MediaConN, ResumenCombustible } from './agregados.ts';
import type { AgregadoCapital, AgregadosCapitales } from './capitales.ts';
import type { AgregadosMinimos, MinimoConOrigen } from './minimos.ts';
import {
  calcularResumenesPanelHoy,
  formatearResumenHoy,
  type FuentesResumenesHoy,
  type ResumenAhorroHoy,
  type ResumenEvolucionHoy,
  type ResumenPrecioHoy,
} from './resumenes-hoy.ts';
import type { ClavePrecio } from './tipos.ts';

const claves: ClavePrecio[] = ['gasolina95e5', 'gasoleoA', 'gasolina98e5', 'gasoleoPremium'];
const actualizado = '2026-08-12T21:23:00Z';

function combustibles(media: number | null, minimo: number | null = media): Record<ClavePrecio, ResumenCombustible> {
  return Object.fromEntries(claves.map((clave) => [clave, clave === 'gasolina95e5'
    ? { media, minimo, n: media === null ? 0 : 10 }
    : { media: null, minimo: null, n: 0 }])) as Record<ClavePrecio, ResumenCombustible>;
}

function medias(media: number | null): Record<ClavePrecio, MediaConN> {
  return Object.fromEntries(claves.map((clave) => [clave, clave === 'gasolina95e5'
    ? { media, n: media === null ? 0 : 100 }
    : { media: null, n: 0 }])) as Record<ClavePrecio, MediaConN>;
}

function zona(id: string, nombre: string, media: number | null, minimo = media, fiscal = false): AgregadoZona & { fiscal?: boolean } {
  return { id, nombre, tipo: 'provincia', provincias: [fiscal ? '35' : id], combustibles: combustibles(media, minimo), fiscal };
}

function minimoNacional(valor: number | null): MinimoConOrigen {
  return {
    minimo: valor,
    n: valor === null ? 0 : 30,
    origenes: valor === null ? [] : [{ municipio: 'TORÀ', provinciaId: '25', provinciaNombre: 'LLEIDA', href: '/lleida/tora/', destino: 'municipio' }],
  };
}

function historico(diferenciaMilesimas: number | null): HistoricoProvincia | null {
  if (diferenciaMilesimas === null) return null;
  const puntos = Array.from({ length: 31 }, (_, indice) => {
    const valor = indice === 30 ? 1500 + diferenciaMilesimas : 1500;
    return [valor, 1, valor] as [number, number, number];
  });
  const vacios = Array.from({ length: 31 }, () => [0, 0, null] as [number, number, null]);
  const provincia = {
    gasolina95e5: puntos,
    gasoleoA: vacios,
    gasolina98e5: vacios,
    gasoleoPremium: vacios,
  } satisfies AgregadoHistorico;
  return {
    version: 1,
    provinciaId: '01',
    fechas: Array.from({ length: 31 }, (_, indice) => `2026-07-${String(indice + 1).padStart(2, '0')}`),
    estaciones: [],
    provincia,
    municipios: {},
  };
}

function fuentes(opciones: { sinDatos?: boolean; cambio?: number | null } = {}): FuentesResumenesHoy {
  const sinDatos = opciones.sinDatos ?? false;
  const general = sinDatos
    ? [zona('28', 'MADRID', null, null)]
    : [zona('25', 'LLEIDA', 1.646, 1.6), zona('28', 'MADRID', 1.7, 1.5)];
  const fiscales = [zona('las-palmas', 'PALMAS (LAS)', sinDatos ? null : 1.429, sinDatos ? null : 1.4, true)];
  const rotulo: AgregadoRotulo = { rotulo: 'BALLENOIL', estaciones: 120, combustibles: medias(sinDatos ? null : 1.549) };
  const agregados: AgregadosEditoriales = {
    actualizado,
    zonas: { general, canariasCeutaMelilla: fiscales },
    rotulos: { general: [rotulo], canariasCeutaMelilla: [], mercadosFiscales: [] },
  };
  const capital: AgregadoCapital = {
    nombre: 'CÓRDOBA', provinciaId: '14', provinciaNombre: 'CÓRDOBA', href: '/cordoba/cordoba/',
    combustibles: combustibles(sinDatos ? null : 1.579),
  };
  const capitales: AgregadosCapitales = { actualizado, general: [capital], canariasCeutaMelilla: [] };
  const minimo = minimoNacional(sinDatos ? null : 1.4);
  const minimos: AgregadosMinimos = {
    actualizado,
    nacional: Object.fromEntries(claves.map((clave) => [clave, clave === 'gasolina95e5' ? minimo : minimoNacional(null)])) as Record<ClavePrecio, MinimoConOrigen>,
    comunidades: [],
    canariasCeutaMelilla: [],
  };
  return { agregados, capitales, minimos, historico: historico(opciones.cambio === undefined ? -21 : opciones.cambio) };
}

describe('resúmenes vivos del panel Hoy', () => {
  it('calcula las seis editoriales con las mismas medias, mínimos, rótulos y ámbitos', () => {
    const items = calcularResumenesPanelHoy(fuentes()).items;
    assert.deepEqual(items['provincias-mas-baratas'], { tipo: 'precio', entidad: 'Lleida', combustible: 'gasolina95e5', valor: 1.646 });
    assert.deepEqual(items['marcas-mas-baratas'], { tipo: 'precio', entidad: 'BALLENOIL', combustible: 'gasolina95e5', valor: 1.549 });
    assert.deepEqual(items['capitales-de-provincia'], { tipo: 'precio', entidad: 'Córdoba', combustible: 'gasolina95e5', valor: 1.579 });
    assert.deepEqual(items['la-mas-barata-de-espana'], { tipo: 'precio', entidad: 'Torà', combustible: 'gasolina95e5', valor: 1.4 });
    assert.deepEqual(items['canarias-ceuta-melilla'], { tipo: 'precio', entidad: 'Las Palmas', combustible: 'gasolina95e5', valor: 1.429 });
    const ahorro = items['cuanto-te-juegas'];
    assert.equal(ahorro.tipo, 'ahorro');
    if (ahorro.tipo === 'ahorro') {
      assert.deepEqual({ ...ahorro, valor: 10 }, { tipo: 'ahorro', entidad: 'Madrid', combustible: 'gasolina95e5', valor: 10, litros: 50, referencia: 'media provincial' });
      assert.ok(Math.abs(ahorro.valor - 10) < Number.EPSILON * 50);
    }
  });

  it('mantiene separados el mercado general y Canarias, Ceuta y Melilla', () => {
    const items = calcularResumenesPanelHoy(fuentes()).items;
    assert.equal(items['provincias-mas-baratas'].tipo === 'precio' && items['provincias-mas-baratas'].entidad, 'Lleida');
    assert.equal(items['canarias-ceuta-melilla'].tipo === 'precio' && items['canarias-ceuta-melilla'].entidad, 'Las Palmas');
  });

  it('calcula el ahorro frente a la media provincial para exactamente 50 litros', () => {
    const resumen = calcularResumenesPanelHoy(fuentes()).items['cuanto-te-juegas'];
    assert.equal(resumen.tipo, 'ahorro');
    if (resumen.tipo === 'ahorro') {
      assert.equal(resumen.litros, 50);
      assert.equal(resumen.referencia, 'media provincial');
      assert.equal(resumen.valor, (1.7 - 1.5) * 50);
    }
  });

  it('no convierte null en cero y produce fallbacks específicos', () => {
    const items = calcularResumenesPanelHoy(fuentes({ sinDatos: true, cambio: null })).items;
    for (const slug of ['provincias-mas-baratas', 'cuanto-te-juegas', 'marcas-mas-baratas', 'capitales-de-provincia', 'la-mas-barata-de-espana', 'canarias-ceuta-melilla', 'evolucion'] as const) {
      assert.equal(items[slug].tipo, 'sin-datos');
      assert.doesNotMatch(formatearResumenHoy(items[slug]), /(^|\D)0(?:[,.]0+)?(?:\D|$)/);
    }
  });
});

describe('formato de cifras del panel Hoy', () => {
  it('conserva tres decimales en precios y el nombre canónico del combustible', () => {
    assert.equal(formatearResumenHoy({ tipo: 'precio', entidad: 'Lleida', combustible: 'gasolina95e5', valor: 1.646 } satisfies ResumenPrecioHoy), 'Lleida · Gasolina 95 · 1,646 €/L');
  });

  it('explica importe, referencia y volumen del ahorro', () => {
    assert.equal(formatearResumenHoy({ tipo: 'ahorro', entidad: 'Madrid', combustible: 'gasolina95e5', valor: 8.2, litros: 50, referencia: 'media provincial' } satisfies ResumenAhorroHoy), 'Madrid · Gasolina 95 · 8,20 € menos que la media · 50 L');
  });

  it('expresa signo, magnitud y periodo de evolución', () => {
    assert.equal(formatearResumenHoy({ tipo: 'evolucion', combustible: 'gasolina95e5', diferenciaMilesimas: -21, dias: 30 } satisfies ResumenEvolucionHoy), 'Gasolina 95 · −2,1 cts/L · 30 días');
  });

  it('conserva literalmente un fallback honesto', () => {
    assert.equal(formatearResumenHoy({ tipo: 'sin-datos', texto: 'Sin mínimo nacional publicado para Gasolina 95' }), 'Sin mínimo nacional publicado para Gasolina 95');
  });
});
