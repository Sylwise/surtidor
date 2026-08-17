import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AMPLITUD_MINIMA_ESCALA_MILESIMAS,
  MINIMO_MUESTRA_ESCALA,
  bandaPrecio,
  crearEscala,
  explicacionEscalaSuprimida,
} from './escala.ts';

test('declara los umbrales únicos de ADR-0025', () => {
  assert.equal(MINIMO_MUESTRA_ESCALA, 2);
  assert.equal(AMPLITUD_MINIMA_ESCALA_MILESIMAS, 20);
});

test('con menos de dos precios usa p3 y no destaca una más barata', () => {
  const vacia = crearEscala([]);
  const unica = crearEscala([1.455]);

  assert.equal(vacia.motivoSupresion, 'muestra');
  assert.equal(explicacionEscalaSuprimida(vacia), null);
  assert.equal(unica.motivoSupresion, 'muestra');
  assert.equal(unica.banda(1.455), 'p3');
  assert.equal(unica.esMasBarata(1.455), false);
  assert.match(explicacionEscalaSuprimida(unica) ?? '', /Solo hay un precio comparable/);
});

test('por debajo de 20 milésimas neutraliza las bandas y conserva todos los empates mínimos', () => {
  const escala = crearEscala([1.455, 1.455, 1.464, 1.465]);

  assert.equal(escala.motivoSupresion, 'dispersion');
  assert.equal(bandaPrecio(1.455, escala), 'barata');
  assert.equal(bandaPrecio(1.464, escala), 'p3');
  assert.equal(bandaPrecio(1.465, escala), 'p3');
  assert.match(explicacionEscalaSuprimida(escala) ?? '', /menos de 2 céntimos/);
});

test('Melilla conserva destacadas sus cinco estaciones empatadas en el mínimo', () => {
  const precios = [1.464, 1.464, 1.464, 1.464, 1.455, 1.455, 1.464, 1.464, 1.455, 1.465, 1.455, 1.455];
  const escala = crearEscala(precios);

  assert.equal(escala.motivoSupresion, 'dispersion');
  assert.equal(precios.filter((precio) => bandaPrecio(precio, escala) === 'barata').length, 5);
  assert.ok(precios.filter((precio) => precio !== 1.455).every((precio) => bandaPrecio(precio, escala) === 'p3'));
});

test('una amplitud de exactamente 20 milésimas sí aplica las bandas', () => {
  const escala = crearEscala([1.739, 1.755, 1.759]);

  assert.equal(escala.motivoSupresion, null);
  assert.equal(bandaPrecio(1.739, escala), 'barata');
  assert.equal(bandaPrecio(1.759, escala), 'p5');
});

test('dos precios muy separados conservan la comparación cromática', () => {
  const escala = crearEscala([1.5, 1.65]);

  assert.equal(escala.motivoSupresion, null);
  assert.equal(bandaPrecio(1.5, escala), 'barata');
  assert.equal(bandaPrecio(1.65, escala), 'p5');
});
