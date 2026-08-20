import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolverAmbitoCombustible } from './ambitoCombustible.ts';
import type { EstacionZona } from './zona.ts';

function estacion(id: string, municipio: string, glp: number | null): EstacionZona {
  return {
    id,
    rotulo: 'PRUEBA',
    direccion: 'CALLE PRUEBA',
    municipio,
    cp: '01001',
    lat: 42.85,
    lon: -2.67,
    horario: 'L-D: 24H',
    tipoVenta: 'P',
    margen: 'D',
    precios: {
      gasolina95e5: 1.5,
      gasoleoA: 1.4,
      gasolina98e5: null,
      gasoleoPremium: null,
      gasoleoB: null,
      glp,
    },
    provinciaId: '01',
    provinciaNombre: 'ARABA/ALAVA',
  };
}

test('mantiene el municipio cuando vende el combustible', () => {
  const municipio = [estacion('municipio', 'VITORIA-GASTEIZ', 0.95)];
  const resultado = resolverAmbitoCombustible(municipio, municipio, 'glp');
  assert.equal(resultado.ampliado, false);
  assert.equal(resultado.estaciones, municipio);
});

test('ensancha a provincia cuando el municipio no vende y la provincia sí', () => {
  const municipio = [estacion('municipio', 'VITORIA-GASTEIZ', null)];
  const provincia = [...municipio, estacion('provincia', 'LLODIO', 0.95)];
  const resultado = resolverAmbitoCombustible(municipio, provincia, 'glp');
  assert.equal(resultado.ampliado, true);
  assert.equal(resultado.estaciones, provincia);
});

test('no ensancha a una lista igualmente vacía cuando tampoco vende la provincia', () => {
  const municipio = [estacion('municipio', 'VITORIA-GASTEIZ', null)];
  const provincia = [...municipio, estacion('provincia', 'LLODIO', null)];
  const resultado = resolverAmbitoCombustible(municipio, provincia, 'glp');
  assert.equal(resultado.ampliado, false);
  assert.equal(resultado.estaciones, municipio);
});
