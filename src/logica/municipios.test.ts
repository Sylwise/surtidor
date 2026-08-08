// RF-89/RF-74: resumenMunicipiosDe alimenta las pastillas que cierran la
// lista de una página de zona. Antes probaba tablaZona.ts junto al cálculo
// de la tabla de 30 más baratas (ya no existe, ver
// docs/05-diseno.md#La-lista-es-el-contenido); esta prueba se queda solo con
// lo que sigue teniendo consumidores.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumenMunicipiosDe, hrefMunicipioZona, multiProvinciaDe } from './municipios.ts';
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

test('las estaciones sin venta al público (RF-48) no entran en el resumen', () => {
  const resumen = resumenMunicipiosDe([estacion({ id: 'p1', tipoVenta: 'P' }), estacion({ id: 'r1', tipoVenta: 'R' })]);
  assert.equal(resumen.length, 1);
  assert.equal(resumen[0]?.estaciones, 1);
});

test('el resumen agrupa por municipio+provincia y se queda con el precio mínimo de gasolina 95', () => {
  const resumen = resumenMunicipiosDe([
    estacion({ id: 'a', municipio: 'VITORIA-GASTEIZ', precios: { gasolina95e5: 1.5, gasoleoA: null, gasolina98e5: null, gasoleoPremium: null } }),
    estacion({ id: 'b', municipio: 'VITORIA-GASTEIZ', precios: { gasolina95e5: 1.3, gasoleoA: null, gasolina98e5: null, gasoleoPremium: null } }),
    estacion({ id: 'c', municipio: 'LLODIO', precios: { gasolina95e5: 1.4, gasoleoA: null, gasolina98e5: null, gasoleoPremium: null } }),
  ]);
  assert.equal(resumen.length, 2);
  const vitoria = resumen.find((m) => m.municipio === 'VITORIA-GASTEIZ');
  assert.equal(vitoria?.estaciones, 2);
  assert.equal(vitoria?.precioMinimo, 1.3);
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
