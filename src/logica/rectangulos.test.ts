import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fraccionVisible } from './rectangulos.ts';
import type { Rectangulo } from '../../scripts/lib/tipos.ts';

const VISTA: Rectangulo = { minLat: 0, maxLat: 10, minLon: 0, maxLon: 10 }; // área 100

describe('fraccionVisible', () => {
  it('1 cuando el rectángulo cubre la vista entera (o más)', () => {
    const rectangulo: Rectangulo = { minLat: -5, maxLat: 15, minLon: -5, maxLon: 15 };
    assert.equal(fraccionVisible(rectangulo, VISTA), 1);
  });

  it('0 cuando no hay solape', () => {
    const rectangulo: Rectangulo = { minLat: 20, maxLat: 30, minLon: 20, maxLon: 30 };
    assert.equal(fraccionVisible(rectangulo, VISTA), 0);
  });

  it('0 cuando los rectángulos solo se tocan por el borde (área de intersección cero)', () => {
    const rectangulo: Rectangulo = { minLat: 10, maxLat: 20, minLon: 0, maxLon: 10 };
    assert.equal(fraccionVisible(rectangulo, VISTA), 0);
  });

  it('la mitad de la vista da 0,5', () => {
    const rectangulo: Rectangulo = { minLat: 0, maxLat: 10, minLon: 0, maxLon: 5 }; // área 50
    assert.equal(fraccionVisible(rectangulo, VISTA), 0.5);
  });

  it('un cuarto de la vista (solape parcial en las dos dimensiones) da 0,25', () => {
    const rectangulo: Rectangulo = { minLat: 5, maxLat: 15, minLon: 5, maxLon: 15 }; // intersección [5,10]x[5,10] = área 25
    assert.equal(fraccionVisible(rectangulo, VISTA), 0.25);
  });

  it('es la fracción de la VISTA, no de la provincia: una provincia mucho más grande que la vista puede dar 1', () => {
    const provinciaEnorme: Rectangulo = { minLat: -100, maxLat: 100, minLon: -100, maxLon: 100 };
    assert.equal(fraccionVisible(provinciaEnorme, VISTA), 1);
  });

  it('0 si la vista tiene área cero', () => {
    const vistaDegenerada: Rectangulo = { minLat: 5, maxLat: 5, minLon: 5, maxLon: 5 };
    const rectangulo: Rectangulo = { minLat: 0, maxLat: 10, minLon: 0, maxLon: 10 };
    assert.equal(fraccionVisible(rectangulo, vistaDegenerada), 0);
  });
});
