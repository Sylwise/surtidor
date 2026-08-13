// RF-89: calcularListaCombustible/calcularListasPorCombustible alimentan
// tanto el HTML servido en el build (los cuatro combustibles a la vez, ver
// AppInteractiva.astro) como la lista reactiva del cliente
// (src/componentes/Lista.ts). Las dos vías tienen que dar el mismo
// resultado, así que la prueba es del cálculo puro.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularListaCombustible, calcularListasPorCombustible } from './listaEstaciones.ts';
import { ORDEN_COMBUSTIBLES } from './combustibles.ts';
import type { EstacionZona } from './zona.ts';

function estacion(extra: Partial<EstacionZona> = {}): EstacionZona {
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
    provinciaId: '01',
    provinciaNombre: 'ARABA/ALAVA',
    ...extra,
  };
}

test('las filas se ordenan de más barata a más cara y llevan puesto 1-based', () => {
  const filas = calcularListaCombustible(
    [
      estacion({ id: 'a', precios: { gasolina95e5: 1.5, gasoleoA: null, gasolina98e5: null, gasoleoPremium: null } }),
      estacion({ id: 'b', precios: { gasolina95e5: 1.3, gasoleoA: null, gasolina98e5: null, gasoleoPremium: null } }),
      estacion({ id: 'c', precios: { gasolina95e5: 1.4, gasoleoA: null, gasolina98e5: null, gasoleoPremium: null } }),
    ],
    'gasolina95e5',
  );
  assert.deepEqual(
    filas.map((f) => [f.estacion.id, f.puesto]),
    [
      ['b', 1],
      ['c', 2],
      ['a', 3],
    ],
  );
});

test('las estaciones sin el combustible activo no aparecen', () => {
  const filas = calcularListaCombustible(
    [
      estacion({ id: 'sin-dato', precios: { gasolina95e5: null, gasoleoA: 1.2, gasolina98e5: null, gasoleoPremium: null } }),
      estacion({ id: 'con-dato', precios: { gasolina95e5: 1.3, gasoleoA: null, gasolina98e5: null, gasoleoPremium: null } }),
    ],
    'gasolina95e5',
  );
  assert.deepEqual(filas.map((f) => f.estacion.id), ['con-dato']);
});

test('las estaciones sin venta al público (RF-48) no entran en la lista', () => {
  const filas = calcularListaCombustible(
    [estacion({ id: 'p1', tipoVenta: 'P' }), estacion({ id: 'r1', tipoVenta: 'R' })],
    'gasolina95e5',
  );
  assert.deepEqual(filas.map((f) => f.estacion.id), ['p1']);
});

test('la más barata lleva banda "barata"', () => {
  const filas = calcularListaCombustible(
    [
      estacion({ id: 'a', precios: { gasolina95e5: 1.5, gasoleoA: null, gasolina98e5: null, gasoleoPremium: null } }),
      estacion({ id: 'b', precios: { gasolina95e5: 1.3, gasoleoA: null, gasolina98e5: null, gasoleoPremium: null } }),
    ],
    'gasolina95e5',
  );
  const barata = filas.find((f) => f.estacion.id === 'b');
  assert.equal(barata?.banda, 'barata');
});

test('la lista comparte los extremos de la escala visual: barata y p5', () => {
  const filas = calcularListaCombustible(
    Array.from({ length: 8 }, (_, indice) => estacion({
      id: String(indice),
      precios: { gasolina95e5: 1.3 + indice * .05, gasoleoA: null, gasolina98e5: null, gasoleoPremium: null },
    })),
    'gasolina95e5',
  );
  assert.equal(filas.at(0)?.banda, 'barata');
  assert.equal(filas.at(-1)?.banda, 'p5');
});

test('calcularListasPorCombustible devuelve las cuatro claves (RF-89)', () => {
  const listas = calcularListasPorCombustible([estacion({ id: 'a' })]);
  assert.deepEqual(Object.keys(listas).sort(), [...ORDEN_COMBUSTIBLES].sort());
  assert.deepEqual(listas.gasolina95e5.map((f) => f.estacion.id), ['a']);
  // gasolina98e5 y gasoleoPremium son null en la fixture: la lista de ese
  // combustible está vacía, no rompe.
  assert.deepEqual(listas.gasolina98e5, []);
});
