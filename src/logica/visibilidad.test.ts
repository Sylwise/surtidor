// Prueba del filtro RF-48: las estaciones sin venta al público
// (`tipoVenta !== "P"`) se excluyen de lista, ficha y mapa. Sin datos reales
// que disparen esta ruta hoy (el servicio REST solo devuelve "P" — ver
// docs/04-fuente-datos.md), así que el único sitio donde se puede verificar
// es con fixtures sintéticas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estacionesQueVenden, estacionesVisibles } from './visibilidad.ts';
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
      gasoleoB: null,
      glp: null,
    },
    provinciaId: '01',
    provinciaNombre: 'ARABA/ALAVA',
    ...extra,
  };
}

test('una estación con tipoVenta "P" es visible', () => {
  const visibles = estacionesVisibles([estacion({ id: 'p1', tipoVenta: 'P' })]);
  assert.deepEqual(visibles.map((e) => e.id), ['p1']);
});

test('una estación con tipoVenta "R" se excluye', () => {
  const visibles = estacionesVisibles([estacion({ id: 'r1', tipoVenta: 'R' })]);
  assert.deepEqual(visibles, []);
});

test('una estación con tipoVenta "A" también se excluye', () => {
  const visibles = estacionesVisibles([estacion({ id: 'a1', tipoVenta: 'A' })]);
  assert.deepEqual(visibles, []);
});

test('en una lista mixta, solo sobreviven las de venta al público', () => {
  const visibles = estacionesVisibles([
    estacion({ id: 'p1', tipoVenta: 'P' }),
    estacion({ id: 'r1', tipoVenta: 'R' }),
    estacion({ id: 'a1', tipoVenta: 'A' }),
    estacion({ id: 'p2', tipoVenta: 'P' }),
  ]);
  assert.deepEqual(visibles.map((e) => e.id).sort(), ['p1', 'p2']);
});

test('sin estaciones, no hay nada visible', () => {
  assert.deepEqual(estacionesVisibles([]), []);
});

test('solo se representan estaciones que venden el combustible seleccionado', () => {
  const estaciones = [
    estacion({ id: 'vende-95' }),
    estacion({
      id: 'solo-diesel',
      precios: { gasolina95e5: null, gasoleoA: 1.489, gasolina98e5: null, gasoleoPremium: null, gasoleoB: null, glp: null },
    }),
  ];

  assert.deepEqual(estacionesQueVenden(estaciones, 'gasolina95e5').map((e) => e.id), ['vende-95']);
  assert.deepEqual(estacionesQueVenden(estaciones, 'gasoleoA').map((e) => e.id), ['vende-95', 'solo-diesel']);
});
