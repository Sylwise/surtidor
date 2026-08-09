import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ProvinciaNacional } from '../../scripts/lib/tipos.ts';
import { compararProvincias, modoMapaParaZoom } from './vistaNacional.ts';

function provincia(id: string, media: number | null): ProvinciaNacional {
  const agregado = { media, n: media === null ? 0 : 1 };
  return {
    id,
    nombre: id,
    centro: { lat: 40, lon: -3 },
    combustibles: {
      gasolina95e5: agregado,
      gasoleoA: agregado,
      gasolina98e5: agregado,
      gasoleoPremium: agregado,
    },
  };
}

describe('modoMapaParaZoom', () => {
  it('entra por debajo de 8 y sale al alcanzar 8,5', () => {
    assert.equal(modoMapaParaZoom(7.99, 'zona'), 'nacional');
    assert.equal(modoMapaParaZoom(8.5, 'nacional'), 'zona');
  });

  it('conserva el modo anterior dentro de la histéresis', () => {
    assert.equal(modoMapaParaZoom(8.25, 'nacional'), 'nacional');
    assert.equal(modoMapaParaZoom(8.25, 'zona'), 'zona');
  });
});

describe('compararProvincias', () => {
  it('prioriza foco, menor media, dato frente a null e id como desempate', () => {
    const provincias = [provincia('04', null), provincia('03', 1.6), provincia('02', 1.4), provincia('01', 1.4)];
    assert.deepEqual(
      provincias.sort((a, b) => compararProvincias(a, b, 'gasolina95e5', '03')).map((p) => p.id),
      ['03', '01', '02', '04'],
    );
  });
});
