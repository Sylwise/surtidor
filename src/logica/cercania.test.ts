import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compararPorDistancia, distanciaKm, formatearDistancia } from './cercania.ts';
import type { EstacionZona } from './zona.ts';

function estacion(id: string, lat: number, lon: number): EstacionZona {
  return {
    id, lat, lon, rotulo: id, direccion: '', municipio: '', cp: '', horario: '',
    tipoVenta: 'P', margen: null, provinciaId: '01', provinciaNombre: 'ARABA/ALAVA',
    precios: { gasolina95e5: 1.5, gasoleoA: 1.4, gasolina98e5: null, gasoleoPremium: null, gasoleoB: null, glp: null },
  };
}

test('calcula una distancia geográfica conocida', () => {
  const km = distanciaKm({ lat: 40.4168, lon: -3.7038 }, { lat: 41.3874, lon: 2.1686 });
  assert.ok(km > 500 && km < 510);
});

test('ordena por cercanía y desempata de forma estable por id', () => {
  const posicion = { lat: 40, lon: -3 };
  const estaciones = [estacion('lejos', 41, -3), estacion('b', 40, -3), estacion('a', 40, -3)];
  estaciones.sort((a, b) => compararPorDistancia(posicion, a, b));
  assert.deepEqual(estaciones.map((e) => e.id), ['a', 'b', 'lejos']);
});

test('formatea metros, kilómetros con decimal y kilómetros largos', () => {
  assert.equal(formatearDistancia(0.846), '850 m');
  assert.equal(formatearDistancia(2.34), '2,3 km');
  assert.equal(formatearDistancia(12.6), '13 km');
});
