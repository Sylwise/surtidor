import assert from 'node:assert/strict';
import test from 'node:test';
import { ORDEN_ESTADOS_HOJA, siguienteEstadoHoja } from './Hoja.ts';

test('la hoja conserva exactamente minimizada, media y completa', () => {
  assert.deepEqual(ORDEN_ESTADOS_HOJA, ['minimizada', 'media', 'completa']);
});

test('las flechas recorren los tres estados sin salir de los extremos', () => {
  assert.equal(siguienteEstadoHoja('minimizada', 1), 'media');
  assert.equal(siguienteEstadoHoja('media', 1), 'completa');
  assert.equal(siguienteEstadoHoja('completa', 1), 'completa');
  assert.equal(siguienteEstadoHoja('completa', -1), 'media');
  assert.equal(siguienteEstadoHoja('media', -1), 'minimizada');
  assert.equal(siguienteEstadoHoja('minimizada', -1), 'minimizada');
});
