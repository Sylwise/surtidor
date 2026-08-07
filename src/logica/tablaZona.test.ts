// RF-88 (ADR-0016): calcularTablaZona alimenta tanto el frontmatter de
// src/pages/[zona]/index.astro (build) como la regeneración en cliente de
// #tabla-zona al cambiar de zona sin recargar. Las dos vías tienen que dar
// el mismo resultado, así que la prueba es del cálculo puro.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularTablaZona, hrefMunicipioZona, LIMITE_TABLA_ZONA } from './tablaZona.ts';
import { MINIMO_ESTACIONES_MUNICIPIO } from '../../scripts/lib/tipos.ts';
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

test('las filas se ordenan por gasolina 95, más barata primero', () => {
  const { filas } = calcularTablaZona([
    estacion({ id: 'a', precios: { gasolina95e5: 1.5, gasoleoA: null, gasolina98e5: null, gasoleoPremium: null } }),
    estacion({ id: 'b', precios: { gasolina95e5: 1.3, gasoleoA: null, gasolina98e5: null, gasoleoPremium: null } }),
    estacion({ id: 'c', precios: { gasolina95e5: 1.4, gasoleoA: null, gasolina98e5: null, gasoleoPremium: null } }),
  ]);
  assert.deepEqual(filas.map((e) => e.id), ['b', 'c', 'a']);
});

test('las estaciones sin gasolina 95 se quedan al final', () => {
  const { filas } = calcularTablaZona([
    estacion({ id: 'sin-dato', precios: { gasolina95e5: null, gasoleoA: 1.2, gasolina98e5: null, gasoleoPremium: null } }),
    estacion({ id: 'con-dato', precios: { gasolina95e5: 1.3, gasoleoA: null, gasolina98e5: null, gasoleoPremium: null } }),
  ]);
  assert.deepEqual(filas.map((e) => e.id), ['con-dato', 'sin-dato']);
});

test('se acota a LIMITE_TABLA_ZONA filas aunque haya más estaciones', () => {
  const estaciones = Array.from({ length: LIMITE_TABLA_ZONA + 10 }, (_, i) =>
    estacion({ id: `e${i}`, precios: { gasolina95e5: 1 + i / 100, gasoleoA: null, gasolina98e5: null, gasoleoPremium: null } }),
  );
  const { filas } = calcularTablaZona(estaciones);
  assert.equal(filas.length, LIMITE_TABLA_ZONA);
  assert.equal(filas[0]?.id, 'e0');
});

test('las estaciones sin venta al público (RF-48) no entran en la tabla', () => {
  const { filas, resumenMunicipios } = calcularTablaZona([
    estacion({ id: 'p1', tipoVenta: 'P' }),
    estacion({ id: 'r1', tipoVenta: 'R' }),
  ]);
  assert.deepEqual(filas.map((e) => e.id), ['p1']);
  assert.equal(resumenMunicipios.length, 1);
  assert.equal(resumenMunicipios[0]?.estaciones, 1);
});

test('multiProvincia es true solo cuando hay más de una provincia visible', () => {
  const unaProvincia = calcularTablaZona([estacion({ id: 'a' }), estacion({ id: 'b' })]);
  assert.equal(unaProvincia.multiProvincia, false);

  const dosProvincias = calcularTablaZona([
    estacion({ id: 'a', provinciaId: '01', provinciaNombre: 'ARABA/ALAVA' }),
    estacion({ id: 'b', provinciaId: '48', provinciaNombre: 'BIZKAIA' }),
  ]);
  assert.equal(dosProvincias.multiProvincia, true);
});

test('el resumen por municipio agrupa y se queda con el precio mínimo de gasolina 95', () => {
  const { resumenMunicipios } = calcularTablaZona([
    estacion({ id: 'a', municipio: 'VITORIA-GASTEIZ', precios: { gasolina95e5: 1.5, gasoleoA: null, gasolina98e5: null, gasoleoPremium: null } }),
    estacion({ id: 'b', municipio: 'VITORIA-GASTEIZ', precios: { gasolina95e5: 1.3, gasoleoA: null, gasolina98e5: null, gasoleoPremium: null } }),
    estacion({ id: 'c', municipio: 'LLODIO', precios: { gasolina95e5: 1.4, gasoleoA: null, gasolina98e5: null, gasoleoPremium: null } }),
  ]);
  assert.equal(resumenMunicipios.length, 2);
  const vitoria = resumenMunicipios.find((m) => m.municipio === 'VITORIA-GASTEIZ');
  assert.equal(vitoria?.estaciones, 2);
  assert.equal(vitoria?.precioMinimo, 1.3);
});

test('hrefMunicipioZona es null por debajo del mínimo de estaciones (RF-60)', () => {
  assert.equal(MINIMO_ESTACIONES_MUNICIPIO, 3);
  const href = hrefMunicipioZona({
    municipio: 'PUEBLO PEQUEÑO',
    provinciaId: '01',
    provinciaNombre: 'ARABA/ALAVA',
    estaciones: 2,
    precioMinimo: 1.4,
  });
  assert.equal(href, null);
});

test('hrefMunicipioZona genera la URL con los slugs de provincia y municipio', () => {
  const href = hrefMunicipioZona({
    municipio: 'VITORIA-GASTEIZ',
    provinciaId: '01',
    provinciaNombre: 'ARABA/ALAVA',
    estaciones: 5,
    precioMinimo: 1.4,
  });
  assert.equal(href, '/araba-alava/vitoria-gasteiz/');
});
