import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { construirUrlZonas, parsearZonasUrl, validarCodigosProvincia } from './zonasUrl.ts';
import type { ResumenProvincia } from '../../scripts/lib/tipos.ts';

function provincia(id: string): ResumenProvincia {
  return {
    id,
    nombre: `PROVINCIA ${id}`,
    estaciones: 1,
    minimos: {},
    centro: { lat: 0, lon: 0 },
    rectangulo: { minLat: 0, maxLat: 0, minLon: 0, maxLon: 0 },
    pesoComprimido: 0,
  };
}

const CATALOGO = [provincia('01'), provincia('09'), provincia('28')];

describe('parsearZonasUrl', () => {
  it('separa los códigos por comas', () => {
    assert.deepEqual(parsearZonasUrl('?zonas=01,09'), ['01', '09']);
  });

  it('recorta espacios sueltos', () => {
    assert.deepEqual(parsearZonasUrl('?zonas=01, 09 ,28'), ['01', '09', '28']);
  });

  it('[] sin el parámetro zonas', () => {
    assert.deepEqual(parsearZonasUrl(''), []);
    assert.deepEqual(parsearZonasUrl('?combustible=gasoleoA'), []);
  });

  it('[] con zonas vacío', () => {
    assert.deepEqual(parsearZonasUrl('?zonas='), []);
  });

  it('ignora trozos vacíos de comas repetidas o sueltas', () => {
    assert.deepEqual(parsearZonasUrl('?zonas=01,,09,'), ['01', '09']);
  });
});

describe('validarCodigosProvincia', () => {
  it('deja pasar solo los códigos que existen en el catálogo', () => {
    assert.deepEqual(validarCodigosProvincia(['01', '99', '09'], CATALOGO), ['01', '09']);
  });

  it('[] si ningún código es válido (ADR-0014: cae a la cascada normal)', () => {
    assert.deepEqual(validarCodigosProvincia(['99', 'xx'], CATALOGO), []);
  });

  it('quita duplicados', () => {
    assert.deepEqual(validarCodigosProvincia(['01', '01', '09'], CATALOGO), ['01', '09']);
  });
});

describe('construirUrlZonas', () => {
  it('ordena y quita duplicados', () => {
    assert.equal(construirUrlZonas(['09', '01', '09']), '/?zonas=01,09');
  });

  it('una sola provincia', () => {
    assert.equal(construirUrlZonas(['28']), '/?zonas=28');
  });
});
