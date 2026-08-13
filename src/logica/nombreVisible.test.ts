import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nombreVisible } from './formato.ts';

const COMUNIDADES = [
  ['Castilla la Mancha', 'Castilla-La Mancha'],
  ['Comunidad Valenciana', 'Comunitat Valenciana'],
  ['Andalucia', 'Andalucía'],
  ['País Vasco', 'País Vasco'],
  ['Asturias', 'Asturias'],
  ['Castilla y León', 'Castilla y León'],
  ['Extremadura', 'Extremadura'],
  ['Baleares', 'Illes Balears'],
  ['Cataluña', 'Cataluña'],
  ['Cantabria', 'Cantabria'],
  ['Ceuta', 'Ceuta'],
  ['Galicia', 'Galicia'],
  ['Aragón', 'Aragón'],
  ['Madrid', 'Madrid'],
  ['Melilla', 'Melilla'],
  ['Murcia', 'Murcia'],
  ['Navarra', 'Navarra'],
  ['Canarias', 'Canarias'],
  ['Rioja (La)', 'La Rioja'],
] as const;

test('pinta las 19 comunidades con su nombre fijo', () => {
  assert.equal(COMUNIDADES.length, 19);
  for (const [clave, visible] of COMUNIDADES) {
    assert.equal(nombreVisible(clave, 'ccaa'), visible, clave);
  }
});

test('mueve al principio el artículo de una provincia', () => {
  assert.equal(nombreVisible('CORUÑA (A)', 'provincia'), 'A Coruña');
  assert.equal(nombreVisible('PALMAS (LAS)', 'provincia'), 'Las Palmas');
});

test('mueve al principio el artículo de un municipio', () => {
  assert.equal(nombreVisible('RODA (LA)', 'municipio'), 'La Roda');
});

test('no cambia la denominación de un nombre sin artículo', () => {
  assert.equal(nombreVisible('CASTELLÓN / CASTELLÓ', 'provincia'), 'Castellón / Castelló');
  assert.equal(nombreVisible('GIRONA', 'provincia'), 'Girona');
});

test('falla ante una comunidad desconocida e indica cuál falta', () => {
  assert.throws(
    () => nombreVisible('Comunidad inventada', 'ccaa'),
    /Falta el nombre visible de la comunidad autónoma "Comunidad inventada"/,
  );
});
