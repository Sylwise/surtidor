// RF-89/RF-74: resumenMunicipiosDe alimenta las pastillas que cierran la
// lista de una página de zona. RF-94: el precio que llevan esas pastillas
// sigue al combustible activo, con "no vende" cuando el municipio no lo
// tiene — nunca el precio de otro. Antes probaba tablaZona.ts junto al
// cálculo de la tabla de 30 más baratas (ya no existe, ver
// docs/05-diseno.md#La-lista-es-el-contenido); esta prueba se queda solo con
// lo que sigue teniendo consumidores.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumenMunicipiosDe, hrefMunicipioZona, multiProvinciaDe, calcularEnlacesMunicipio } from './municipios.ts';
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
      gasoleoB: null,
      glp: null,
    },
    provinciaId: '01',
    provinciaNombre: 'ARABA/ALAVA',
    ...extra,
  };
}

test('las estaciones sin venta al público (RF-48) no entran en el resumen', () => {
  const resumen = resumenMunicipiosDe([estacion({ id: 'p1', tipoVenta: 'P' }), estacion({ id: 'r1', tipoVenta: 'R' })]);
  assert.equal(resumen.length, 1);
  assert.equal(resumen[0]?.estaciones, 1);
});

test('el resumen agrupa por municipio+provincia y se queda con el precio mínimo de cada combustible por separado (RF-94)', () => {
  const resumen = resumenMunicipiosDe([
    estacion({
      id: 'a',
      municipio: 'VITORIA-GASTEIZ',
      precios: { gasolina95e5: 1.5, gasoleoA: null, gasolina98e5: 1.7, gasoleoPremium: null, gasoleoB: null, glp: null },
    }),
    estacion({
      id: 'b',
      municipio: 'VITORIA-GASTEIZ',
      precios: { gasolina95e5: 1.3, gasoleoA: null, gasolina98e5: null, gasoleoPremium: null, gasoleoB: null, glp: null },
    }),
    estacion({
      id: 'c',
      municipio: 'LLODIO',
      precios: { gasolina95e5: 1.4, gasoleoA: null, gasolina98e5: null, gasoleoPremium: null, gasoleoB: null, glp: null },
    }),
  ]);
  assert.equal(resumen.length, 2);
  const vitoria = resumen.find((m) => m.municipio === 'VITORIA-GASTEIZ');
  assert.equal(vitoria?.estaciones, 2);
  // El mínimo de cada combustible es el suyo propio, no el de otro: la
  // gasolina 98 mínima de Vitoria es 1.7 (la única estación que la vende),
  // no se contamina con el 1.3 de la 95.
  assert.equal(vitoria?.precios.gasolina95e5, 1.3);
  assert.equal(vitoria?.precios.gasolina98e5, 1.7);
  assert.equal(vitoria?.precios.gasoleoA, null);
});

test('el mismo nombre de municipio en provincias distintas no se mezcla (ADR-0007)', () => {
  const resumen = resumenMunicipiosDe([
    estacion({ id: 'a', municipio: 'AGUILAR', provinciaId: '01', provinciaNombre: 'ARABA/ALAVA' }),
    estacion({ id: 'b', municipio: 'AGUILAR', provinciaId: '39', provinciaNombre: 'CANTABRIA' }),
  ]);
  assert.equal(resumen.length, 2);
});

test('hrefMunicipioZona es null por debajo del mínimo de estaciones (RF-60)', () => {
  assert.equal(MINIMO_ESTACIONES_MUNICIPIO, 3);
  const href = hrefMunicipioZona({
    municipio: 'PUEBLO PEQUEÑO',
    provinciaId: '01',
    provinciaNombre: 'ARABA/ALAVA',
    estaciones: 2,
    precios: { gasolina95e5: 1.4, gasoleoA: null, gasolina98e5: null, gasoleoPremium: null, gasoleoB: null, glp: null },
  });
  assert.equal(href, null);
});

test('hrefMunicipioZona genera la URL con los slugs de provincia y municipio', () => {
  const href = hrefMunicipioZona({
    municipio: 'VITORIA-GASTEIZ',
    provinciaId: '01',
    provinciaNombre: 'ARABA/ALAVA',
    estaciones: 5,
    precios: { gasolina95e5: 1.4, gasoleoA: null, gasolina98e5: null, gasoleoPremium: null, gasoleoB: null, glp: null },
  });
  assert.equal(href, '/araba-alava/vitoria-gasteiz/');
});

test('multiProvinciaDe es true solo cuando hay más de una provincia visible', () => {
  assert.equal(multiProvinciaDe([estacion({ id: 'a' }), estacion({ id: 'b' })]), false);
  assert.equal(
    multiProvinciaDe([
      estacion({ id: 'a', provinciaId: '01', provinciaNombre: 'ARABA/ALAVA' }),
      estacion({ id: 'b', provinciaId: '48', provinciaNombre: 'BIZKAIA' }),
    ]),
    true,
  );
});

test('calcularEnlacesMunicipio (RF-94): un municipio que no vende el combustible activo sale con precio y banda null, no con el precio de otro combustible', () => {
  const filas = calcularEnlacesMunicipio(
    [
      {
        href: '/a/',
        nombre: 'Vitoria-Gasteiz',
        precios: { gasolina95e5: 1.3, gasoleoA: null, gasolina98e5: 1.9, gasoleoPremium: null, gasoleoB: null, glp: null },
      },
      {
        href: '/b/',
        nombre: 'Llodio',
        precios: { gasolina95e5: 1.5, gasoleoA: null, gasolina98e5: null, gasoleoPremium: null, gasoleoB: null, glp: null },
      },
    ],
    'gasolina98e5',
  );
  const vitoria = filas.find((f) => f.nombre === 'Vitoria-Gasteiz');
  const llodio = filas.find((f) => f.nombre === 'Llodio');
  assert.equal(vitoria?.precio, 1.9);
  assert.equal(llodio?.precio, null);
  assert.equal(llodio?.banda, null);
});

test('calcularEnlacesMunicipio calcula la banda de color solo con los precios del combustible pedido', () => {
  const filas = calcularEnlacesMunicipio(
    [
      { href: '/a/', nombre: 'A', precios: { gasolina95e5: 1.0, gasoleoA: 5.0, gasolina98e5: null, gasoleoPremium: null, gasoleoB: null, glp: null } },
      { href: '/b/', nombre: 'B', precios: { gasolina95e5: 2.0, gasoleoA: null, gasolina98e5: null, gasoleoPremium: null, gasoleoB: null, glp: null } },
    ],
    'gasolina95e5',
  );
  const a = filas.find((f) => f.nombre === 'A');
  // El más barato del combustible activo, aunque su gasóleo A (que no se
  // pide aquí) sea el más caro con diferencia: la banda no se contamina
  // entre combustibles.
  assert.equal(a?.banda, 'barata');
});

test('calcularEnlacesMunicipio no asigna banda cromática al GLP', () => {
  const filas = calcularEnlacesMunicipio(
    [
      { href: '/a/', nombre: 'A', precios: { gasolina95e5: null, gasoleoA: null, gasolina98e5: null, gasoleoPremium: null, gasoleoB: null, glp: 0.91 } },
      { href: '/b/', nombre: 'B', precios: { gasolina95e5: null, gasoleoA: null, gasolina98e5: null, gasoleoPremium: null, gasoleoB: null, glp: 0.99 } },
    ],
    'glp',
  );
  assert.deepEqual(filas.map((fila) => fila.banda), [null, null]);
});
