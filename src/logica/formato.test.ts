import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cajaDeTitulo, formatearFechaHora, formatearHora } from './formato.ts';

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

test('formatearFechaHora usa siempre hora peninsular española, en verano (CEST, UTC+2)', () => {
  assert.equal(formatearFechaHora('2026-08-12T21:23:00Z'), '12/8, 23:23');
});

test('formatearFechaHora usa siempre hora peninsular española, en invierno (CET, UTC+1)', () => {
  assert.equal(formatearFechaHora('2026-01-15T10:30:00Z'), '15/1, 11:30');
});

test('formatearHora usa la misma zona horaria que formatearFechaHora', () => {
  assert.equal(formatearHora('2026-08-12T21:23:00Z'), '23:23');
});
