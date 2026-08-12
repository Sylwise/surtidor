import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizarPreferencias } from './estado.ts';

test('la zona guardada se recupera sin incorporar estado efímero de la hoja', () => {
  assert.deepEqual(normalizarPreferencias({ zonaId: 'araba-alava', combustible: 'gasoleoA', litros: 35, hoja: 'completa' }), {
    zonaId: 'araba-alava',
    combustible: 'gasoleoA',
    litros: 35,
  });
});

test('preferencias corruptas no crean una zona guardada', () => {
  assert.deepEqual(normalizarPreferencias({ zonaId: 1, litros: -4 }), {});
});
