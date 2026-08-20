import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COMBUSTIBLES_COMPARTIR,
  COMBUSTIBLES_EDITORIALES,
  COMBUSTIBLES_EVOLUCION,
  COMBUSTIBLES_PRECIOS,
  combustibleDisponibleEnEvolucion,
  esClavePrecio,
} from './combustibles.ts';

test('ADR-0028 declara 6, 5, 4 y 2 combustibles por sección', () => {
  assert.equal(COMBUSTIBLES_PRECIOS.length, 6);
  assert.equal(COMBUSTIBLES_EDITORIALES.length, 5);
  assert.equal(COMBUSTIBLES_EVOLUCION.length, 4);
  assert.equal(COMBUSTIBLES_COMPARTIR.length, 2);
  assert.deepEqual(COMBUSTIBLES_EDITORIALES, COMBUSTIBLES_PRECIOS.slice(0, 5));
  assert.deepEqual(COMBUSTIBLES_EVOLUCION, COMBUSTIBLES_PRECIOS.slice(0, 4));
  assert.deepEqual(COMBUSTIBLES_COMPARTIR, COMBUSTIBLES_PRECIOS.slice(0, 2));
});

test('valida claves globales y disponibilidad histórica sin aceptar cadenas arbitrarias', () => {
  assert.equal(esClavePrecio('glp'), true);
  assert.equal(esClavePrecio('queroseno'), false);
  assert.equal(combustibleDisponibleEnEvolucion('gasolina95e5'), true);
  assert.equal(combustibleDisponibleEnEvolucion('gasoleoB'), false);
  assert.equal(combustibleDisponibleEnEvolucion('glp'), false);
});
