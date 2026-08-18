import test from 'node:test';
import assert from 'node:assert/strict';
import { EDITORIALES_HOY, HERRAMIENTAS_HOY, hrefEntradaHoy, seccionHoyActiva } from './navegacion.ts';

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

test('Evolución conserva el municipio cuando la entrada parte de su página', () => {
  const evolucion = HERRAMIENTAS_HOY.find(({ slug }) => slug === 'evolucion')!;
  assert.equal(hrefEntradaHoy(evolucion, '01', 'Vitoria-Gasteiz'), '/hoy/evolucion/01/?municipio=Vitoria-Gasteiz');
});

test('la metodología pertenece a la sección Hoy y no a Precios', () => {
  assert.equal(seccionHoyActiva('/como-calculamos-los-datos/'), true);
  assert.equal(seccionHoyActiva('/hoy/provincias-mas-baratas/'), true);
  assert.equal(seccionHoyActiva('/'), false);
  assert.equal(seccionHoyActiva('/madrid/'), false);
});
