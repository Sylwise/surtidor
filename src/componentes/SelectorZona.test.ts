import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizarBusquedaZona } from './SelectorZona.ts';

test('la búsqueda territorial ignora mayúsculas y diacríticos', () => {
  assert.equal(normalizarBusquedaZona('Álava'), 'alava');
  assert.equal(normalizarBusquedaZona('COMUNIDAD DE MADRID'), 'comunidad de madrid');
});
