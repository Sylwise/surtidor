import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generarRedirecciones } from './redirecciones.ts';
import type { ResumenProvincia } from './tipos.ts';

function provincia(id: string, nombre: string): ResumenProvincia {
  return { id, nombre, estaciones: 10, minimos: {}, centro: { lat: 0, lon: 0 } };
}

describe('generarRedirecciones', () => {
  it('una línea comodín por provincia, ordenadas por id', () => {
    const contenido = generarRedirecciones([provincia('48', 'BIZKAIA'), provincia('01', 'ARABA/ALAVA')]);
    const lineasRegla = contenido.split('\n').filter((linea) => linea.startsWith('/'));

    assert.deepEqual(lineasRegla, ['/araba-alava/*  /p-01/  301', '/bizkaia/*  /p-48/  301']);
  });
});
