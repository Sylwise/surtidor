import assert from 'node:assert/strict';
import test from 'node:test';
import { clasificarGestoGrafico } from './gestoGrafico.ts';

test('un movimiento corto sigue siendo un toque', () => {
  assert.equal(clasificarGestoGrafico(0, 0), 'pendiente');
  assert.equal(clasificarGestoGrafico(7, -7), 'pendiente');
});

test('el arrastre predominantemente horizontal recorre los días', () => {
  assert.equal(clasificarGestoGrafico(12, 3), 'recorrer');
  assert.equal(clasificarGestoGrafico(-18, 6), 'recorrer');
});

test('el gesto vertical y el diagonal se reservan al scroll', () => {
  assert.equal(clasificarGestoGrafico(3, 12), 'desplazar');
  assert.equal(clasificarGestoGrafico(10, 10), 'desplazar');
});
