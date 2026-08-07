import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcularCentro, calcularRectangulo } from './geo.ts';

describe('calcularRectangulo', () => {
  it('envuelve todas las coordenadas', () => {
    const rectangulo = calcularRectangulo([
      { lat: 42.85, lon: -2.67 },
      { lat: 42.9, lon: -2.7 },
      { lat: 42.8, lon: -2.6 },
    ]);
    assert.deepEqual(rectangulo, { minLat: 42.8, maxLat: 42.9, minLon: -2.7, maxLon: -2.6 });
  });

  it('una sola estación da un rectángulo degenerado (área cero)', () => {
    const rectangulo = calcularRectangulo([{ lat: 42.85, lon: -2.67 }]);
    assert.deepEqual(rectangulo, { minLat: 42.85, maxLat: 42.85, minLon: -2.67, maxLon: -2.67 });
  });

  it('descarta (0, 0), Null Island, igual que Mapa.ts', () => {
    const rectangulo = calcularRectangulo([
      { lat: 0, lon: 0 },
      { lat: 42.85, lon: -2.67 },
      { lat: 42.9, lon: -2.7 },
    ]);
    assert.deepEqual(rectangulo, { minLat: 42.85, maxLat: 42.9, minLon: -2.7, maxLon: -2.67 });
  });

  it('null si ninguna estación tiene coordenadas válidas', () => {
    assert.equal(calcularRectangulo([{ lat: 0, lon: 0 }]), null);
    assert.equal(calcularRectangulo([]), null);
  });

  it('descarta coordenadas fuera de España (caso real: Latitud/Longitud intercambiadas en el origen)', () => {
    const rectangulo = calcularRectangulo([
      { lat: 42.85, lon: -2.67 },
      { lat: 42.9, lon: -2.7 },
      { lat: -8.659472, lon: 42.037472 }, // MITECO id 16268, "GUAY", Tui (Pontevedra)
    ]);
    assert.deepEqual(rectangulo, { minLat: 42.85, maxLat: 42.9, minLon: -2.7, maxLon: -2.67 });
  });
});

describe('calcularCentro', () => {
  it('es la media de las coordenadas válidas', () => {
    const centro = calcularCentro([
      { lat: 42.8, lon: -2.6 },
      { lat: 42.9, lon: -2.7 },
    ]);
    assert.ok(Math.abs(centro.lat - 42.85) < 1e-9);
    assert.ok(Math.abs(centro.lon - -2.65) < 1e-9);
  });

  it('descarta (0, 0)', () => {
    const centro = calcularCentro([
      { lat: 0, lon: 0 },
      { lat: 40, lon: -4 },
    ]);
    assert.deepEqual(centro, { lat: 40, lon: -4 });
  });

  it('{ lat: 0, lon: 0 } si ninguna estación tiene coordenadas válidas', () => {
    assert.deepEqual(calcularCentro([{ lat: 0, lon: 0 }]), { lat: 0, lon: 0 });
    assert.deepEqual(calcularCentro([]), { lat: 0, lon: 0 });
  });
});
