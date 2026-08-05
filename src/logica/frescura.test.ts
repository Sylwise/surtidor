import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { datosDesactualizados } from './frescura.ts';

const AHORA = new Date('2026-08-05T18:00:00Z');

describe('datosDesactualizados', () => {
  it('no está desactualizado si acaba de actualizarse', () => {
    assert.equal(datosDesactualizados('2026-08-05T17:59:00Z', AHORA), false);
  });

  it('no está desactualizado justo por debajo de las 6 horas', () => {
    assert.equal(datosDesactualizados('2026-08-05T12:01:00Z', AHORA), false);
  });

  it('no está desactualizado exactamente a las 6 horas (límite exclusivo)', () => {
    assert.equal(datosDesactualizados('2026-08-05T12:00:00Z', AHORA), false);
  });

  it('está desactualizado justo por encima de las 6 horas', () => {
    assert.equal(datosDesactualizados('2026-08-05T11:59:00Z', AHORA), true);
  });

  it('está desactualizado con un dato de un día antes', () => {
    assert.equal(datosDesactualizados('2026-08-04T18:00:00Z', AHORA), true);
  });

  it('un ISO ilegible cuenta como desactualizado, no como error', () => {
    assert.equal(datosDesactualizados('no-es-una-fecha', AHORA), true);
  });

  it('una cadena vacía cuenta como desactualizada', () => {
    assert.equal(datosDesactualizados('', AHORA), true);
  });
});
