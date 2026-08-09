import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ordenarRanking } from './ranking.ts';

interface Ejemplo {
  nombre: string;
  valor: number | null;
}

describe('ordenarRanking', () => {
  it('compara a tres decimales, comparte posición y ordena el empate alfabéticamente', () => {
    const filas = ordenarRanking<Ejemplo>(
      [
        { nombre: 'Zamora', valor: 1.4014 },
        { nombre: 'Álava', valor: 1.4011 },
        { nombre: 'Burgos', valor: 1.39 },
        { nombre: 'Cuenca', valor: 1.5 },
      ],
      (elemento) => elemento.valor,
      (elemento) => elemento.nombre,
    );

    assert.deepEqual(
      filas.map(({ elemento, posicion }) => [elemento.nombre, posicion]),
      [
        ['Burgos', 1],
        ['Álava', 2],
        ['Zamora', 2],
        ['Cuenca', 4],
      ],
    );
  });

  it('mantiene los elementos sin valor al final y sin posición', () => {
    const filas = ordenarRanking<Ejemplo>(
      [
        { nombre: 'Zamora', valor: null },
        { nombre: 'Álava', valor: null },
        { nombre: 'Burgos', valor: 1.4 },
      ],
      (elemento) => elemento.valor,
      (elemento) => elemento.nombre,
    );

    assert.deepEqual(
      filas.map(({ elemento, posicion }) => [elemento.nombre, posicion]),
      [
        ['Burgos', 1],
        ['Álava', null],
        ['Zamora', null],
      ],
    );
  });

  it('puede ordenar de mayor a menor sin alterar los empates', () => {
    const filas = ordenarRanking<Ejemplo>(
      [
        { nombre: 'Zamora', valor: 2.2014 },
        { nombre: 'Álava', valor: 2.2011 },
        { nombre: 'Burgos', valor: 1.9 },
      ],
      (elemento) => elemento.valor,
      (elemento) => elemento.nombre,
      'descendente',
    );

    assert.deepEqual(
      filas.map(({ elemento, posicion }) => [elemento.nombre, posicion]),
      [
        ['Álava', 1],
        ['Zamora', 1],
        ['Burgos', 3],
      ],
    );
  });
});
