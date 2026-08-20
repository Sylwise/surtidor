import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { gzipSync } from 'node:zlib';
import { calcularResumenNacional } from './resumen-nacional.ts';
import type { DatosProvincia, Estacion, Precios } from './tipos.ts';

const SIN_PRECIOS: Precios = {
  gasolina95e5: null,
  gasoleoA: null,
  gasolina98e5: null,
  gasoleoPremium: null,
  gasoleoB: null,
  glp: null,
};

function estacion(id: string, precio: number | null, lat: number, lon: number, tipoVenta: 'P' | 'R' = 'P'): Estacion {
  return {
    id,
    rotulo: id,
    direccion: '',
    municipio: '',
    cp: '',
    lat,
    lon,
    horario: '',
    tipoVenta,
    margen: null,
    precios: { ...SIN_PRECIOS, gasolina95e5: precio },
  };
}

function provincia(estaciones: Estacion[]): DatosProvincia {
  return {
    provincia: { id: '01', nombre: 'ARABA/ALAVA' },
    actualizado: '2026-08-09T10:00:00Z',
    fechaMiteco: '',
    estaciones,
  };
}

describe('calcularResumenNacional', () => {
  it('calcula media simple y n sin convertir null en cero', () => {
    const resultado = calcularResumenNacional([
      provincia([
        estacion('1', 1.4, 42, -2),
        estacion('2', null, 43, -3),
        estacion('3', 1.6, 44, -4),
      ]),
    ], '2026-08-09T10:00:00Z');

    assert.deepEqual(resultado.provincias[0]?.combustibles.gasolina95e5, { media: 1.5, n: 2 });
  });

  it('devuelve media null y n cero cuando nadie vende el combustible', () => {
    const resultado = calcularResumenNacional(
      [provincia([estacion('1', null, 42, -2)])],
      '2026-08-09T10:00:00Z',
    );
    assert.deepEqual(resultado.provincias[0]?.combustibles.gasolina95e5, { media: null, n: 0 });
  });

  it('excluye venta restringida de la media, n y centroide', () => {
    const resultado = calcularResumenNacional([
      provincia([
        estacion('publica', 1.5, 42, -2),
        estacion('restringida', 0.5, 20, 10, 'R'),
      ]),
    ], '2026-08-09T10:00:00Z');
    const resumen = resultado.provincias[0];
    assert.deepEqual(resumen?.combustibles.gasolina95e5, { media: 1.5, n: 1 });
    assert.deepEqual(resumen?.centro, { lat: 42, lon: -2 });
  });

  it('marca los datos mock y el contrato de 52 provincias cabe en 10 KB comprimidos', () => {
    const datos = Array.from({ length: 52 }, (_, indice) => ({
      ...provincia([estacion(String(indice), 1.5, 36 + indice / 10, -9 + indice / 10)]),
      provincia: { id: String(indice).padStart(2, '0'), nombre: `PROVINCIA ${indice}` },
    }));
    const resultado = calcularResumenNacional(datos, '2026-08-09T10:00:00Z', true);
    assert.equal(resultado.mock, true);
    assert.ok(gzipSync(JSON.stringify(resultado)).byteLength < 10_000);
  });
});
