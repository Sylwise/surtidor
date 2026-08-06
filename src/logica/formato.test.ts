import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cajaDeTitulo } from './formato.ts';

test('capitaliza cada palabra y deja las partículas en minúscula (RF-86)', () => {
  assert.equal(cajaDeTitulo('AVENIDA DE LOS HUETOS, 64'), 'Avenida de los Huetos, 64');
});

test('la primera palabra se capitaliza aunque sea una partícula', () => {
  assert.equal(cajaDeTitulo('LA CORUÑA'), 'La Coruña');
});

test('capitaliza a los dos lados de un guion', () => {
  assert.equal(cajaDeTitulo('VITORIA-GASTEIZ'), 'Vitoria-Gasteiz');
});

test('deja los números intactos', () => {
  assert.equal(cajaDeTitulo('CALLE MAYOR, 12'), 'Calle Mayor, 12');
});
