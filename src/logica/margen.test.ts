import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ETIQUETA_MARGEN } from './margen.ts';

test('hay una etiqueta legible para cada valor de Margen que puede llegar del ministerio', () => {
  assert.equal(ETIQUETA_MARGEN.D, 'Margen derecho');
  assert.equal(ETIQUETA_MARGEN.I, 'Margen izquierdo');
  assert.equal(ETIQUETA_MARGEN.N, 'Sin margen (vía de doble sentido)');
});
