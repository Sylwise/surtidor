import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AgregadoRotulo } from './agregados.ts';
import { rotulosQueVenden, seleccionarMercadosFiscales, seleccionarRotulos } from './rotulos.ts';

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
      gasoleoB: combustible,
      glp: combustible,
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

  it('adapta el umbral al 5 % de cada mercado fiscal, con un mínimo de 2 estaciones', () => {
    const mercados = seleccionarMercadosFiscales([
      { id: 'canarias', nombre: 'Canarias', rotulos: [rotulo('A', 25), rotulo('B', 474)] },
      { id: 'ceuta', nombre: 'Ceuta', rotulos: [rotulo('C', 2), rotulo('D', 8)] },
      { id: 'melilla', nombre: 'Melilla', rotulos: [rotulo('E', 1)] },
    ]);

    assert.deepEqual(mercados.map(({ id, umbral }) => [id, umbral]), [
      ['canarias', 25],
      ['ceuta', 2],
      ['melilla', 2],
    ]);
    assert.deepEqual(mercados.map(({ id, conRanking }) => [id, conRanking]), [
      ['canarias', true],
      ['ceuta', true],
      ['melilla', false],
    ]);
    assert.deepEqual(mercados[0]?.seleccion.incluidos.map(({ rotulo }) => rotulo), ['A', 'B']);
    assert.deepEqual(mercados[1]?.seleccion.incluidos.map(({ rotulo }) => rotulo), ['C', 'D']);
  });

  it('un rótulo que llega al umbral local y vende el combustible queda disponible para el bloque fiscal', () => {
    const mercados = seleccionarMercadosFiscales([
      {
        id: 'canarias',
        nombre: 'Canarias',
        rotulos: [conGasolina95('DISA', 10, 1.55), rotulo('REPSOL', 190)],
      },
    ]);

    const incluidos = mercados[0]!.seleccion.incluidos;
    assert.deepEqual(incluidos.map(({ rotulo }) => rotulo), ['DISA', 'REPSOL']);

    // Mismo filtro que usa la página (rotulosQueVenden) antes de tomar el
    // primero como "referencia": si DISA no vendiera el combustible, esta
    // lista saldría vacía y la página caería igualmente en "ningún rótulo".
    const disponiblesParaVender = rotulosQueVenden(incluidos, 'gasolina95e5');
    assert.deepEqual(disponiblesParaVender.map(({ rotulo }) => rotulo), ['DISA']);
  });
});
