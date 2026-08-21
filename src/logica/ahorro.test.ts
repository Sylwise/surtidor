import assert from 'node:assert/strict';
import test from 'node:test';
import { calcularAhorro, calcularPrecioMedio } from './ahorro.ts';

test('calcula la media simple sin ponderar los precios de la zona', () => {
  const media = calcularPrecioMedio([1.5, 1.6, 1.7]);
  assert.ok(media !== null && Math.abs(media - 1.6) < Number.EPSILON * 10);
});

test('una muestra vacía no se convierte en un precio cero', () => {
  assert.equal(calcularPrecioMedio([]), null);
});

test('calcula el ahorro de 50 litros frente a la media', () => {
  assert.equal(calcularAhorro(1.5, 1.6, 50), 5);
});

test('una estación en la media o por encima no presenta ahorro negativo', () => {
  assert.equal(calcularAhorro(1.6, 1.6, 50), 0);
  assert.equal(calcularAhorro(1.7, 1.6, 50), 0);
});
