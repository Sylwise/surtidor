import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ETIQUETA_MARGEN } from './margen.ts';

test('hay una etiqueta legible para los valores de Margen con lado que decir (RF-87)', () => {
  assert.equal(ETIQUETA_MARGEN.D, 'A la derecha de la vía');
  assert.equal(ETIQUETA_MARGEN.I, 'A la izquierda de la vía');
});
