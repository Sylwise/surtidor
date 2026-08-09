import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcularCostePorNoComparar } from './cuanto-te-juegas.ts';

describe('calcularCostePorNoComparar', () => {
  it('expresa en euros la diferencia entre la media y el mínimo para 50 litros', () => {
    const coste = calcularCostePorNoComparar({ media: 1.6, minimo: 1.5, n: 20 });
    assert.ok(coste !== null && Math.abs(coste - 5) < Number.EPSILON * 50);
  });

  it('no inventa un coste cuando no hay estaciones que vendan el combustible', () => {
    assert.equal(calcularCostePorNoComparar({ media: null, minimo: null, n: 0 }), null);
  });

  it('devuelve cero cuando una sola estación hace coincidir media y mínimo', () => {
    assert.equal(calcularCostePorNoComparar({ media: 1.5, minimo: 1.5, n: 1 }), 0);
  });
});
