import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AgregadoRotulo } from './agregados.ts';
import { rotulosQueVenden, seleccionarRotulos } from './rotulos.ts';

function rotulo(nombre: string, estaciones: number): AgregadoRotulo {
  const combustible = { media: null, n: 0 };
  return {
    rotulo: nombre,
    estaciones,
    combustibles: {
      gasolina95e5: combustible,
      gasoleoA: combustible,
      gasolina98e5: combustible,
      gasoleoPremium: combustible,
    },
  };
}

function conGasolina95(nombre: string, estaciones: number, media: number | null): AgregadoRotulo {
  const agregado = rotulo(nombre, estaciones);
  agregado.combustibles.gasolina95e5 = { media, n: media === null ? 0 : estaciones };
  return agregado;
}

describe('seleccionarRotulos', () => {
  it('incluye el límite de 100 estaciones y cuenta las que quedan fuera', () => {
    const seleccion = seleccionarRotulos([
      rotulo('GRANDE', 101),
      rotulo('JUSTO', 100),
      rotulo('PEQUEÑO', 99),
      rotulo('LOCAL', 1),
    ]);

    assert.deepEqual(seleccion.incluidos.map(({ rotulo }) => rotulo), ['GRANDE', 'JUSTO']);
    assert.equal(seleccion.estacionesTotales, 301);
    assert.equal(seleccion.estacionesFuera, 100);
  });

  it('excluye de cada ranking los rótulos que no venden ese combustible', () => {
    const rotulos = [
      conGasolina95('CON GASOLINA', 120, 1.5),
      conGasolina95('SIN GASOLINA', 200, null),
    ];

    assert.deepEqual(
      rotulosQueVenden(rotulos, 'gasolina95e5').map(({ rotulo }) => rotulo),
      ['CON GASOLINA'],
    );
  });
});
