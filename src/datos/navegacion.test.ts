import test from 'node:test';
import assert from 'node:assert/strict';
import { EDITORIALES_HOY, HERRAMIENTAS_HOY, hrefEntradaHoy } from './navegacion.ts';

test('Hoy conserva ocho destinos HTML reales y correctos', () => {
  const entradas = [...EDITORIALES_HOY, ...HERRAMIENTAS_HOY];
  assert.equal(entradas.length, 8);
  assert.deepEqual(entradas.map((entrada) => hrefEntradaHoy(entrada, '01')), [
    '/hoy/provincias-mas-baratas/',
    '/hoy/cuanto-te-juegas/',
    '/hoy/marcas-mas-baratas/',
    '/hoy/capitales-de-provincia/',
    '/hoy/la-mas-barata-de-espana/',
    '/hoy/canarias-ceuta-melilla/',
    '/hoy/evolucion/01/',
    '/como-calculamos-los-datos/',
  ]);
});
