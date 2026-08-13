import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cajaDeTitulo, formatearNumero } from './formato.ts';

test('formatearNumero separa los miles con punto, a la española', () => {
  assert.equal(formatearNumero(10986), '10.986');
});

test('formatearNumero deja intactos los números de menos de cuatro cifras', () => {
  assert.equal(formatearNumero(883), '883');
});

test('formatearNumero separa también los miles de cuatro cifras con un solo dígito inicial (CLDR minimumGroupingDigits)', () => {
  assert.equal(formatearNumero(5068), '5.068');
  assert.equal(formatearNumero(1000), '1.000');
});

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
