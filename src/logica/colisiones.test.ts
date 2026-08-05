import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { agruparEnRacimos, idsAgrupados, resolverColisiones } from './colisiones.ts';

describe('resolverColisiones', () => {
  it('mantiene visibles dos puntos que no se solapan', () => {
    const visibles = resolverColisiones([
      { id: 'a', x: 0, y: 0, precio: 1.4 },
      { id: 'b', x: 500, y: 0, precio: 1.5 },
    ]);
    assert.equal(visibles.size, 2);
    assert.ok(visibles.has('a'));
    assert.ok(visibles.has('b'));
  });

  it('descarta el más caro cuando dos puntos se solapan', () => {
    const visibles = resolverColisiones([
      { id: 'barata', x: 100, y: 100, precio: 1.409 },
      { id: 'cara', x: 105, y: 100, precio: 1.6 },
    ]);
    assert.deepEqual([...visibles], ['barata']);
  });

  it('la más barata nunca pierde una colisión, sea cual sea el orden de entrada', () => {
    const puntos = [
      { id: 'cara', x: 100, y: 100, precio: 1.6 },
      { id: 'media', x: 102, y: 100, precio: 1.5 },
      { id: 'barata', x: 104, y: 100, precio: 1.409 },
    ];
    const visibles = resolverColisiones(puntos);
    assert.ok(visibles.has('barata'), 'la más barata debe quedar visible');
    assert.equal(visibles.size, 1, 'las otras dos se solapan con la más barata y se ocultan');
  });

  it('una estación sin dato (precio null) se sacrifica antes que una con precio', () => {
    const visibles = resolverColisiones([
      { id: 'sin-dato', x: 100, y: 100, precio: null },
      { id: 'con-dato', x: 105, y: 100, precio: 1.5 },
    ]);
    assert.deepEqual([...visibles], ['con-dato']);
  });

  it('coloca en cadena: cada punto solo se compara con los ya colocados, no con los descartados', () => {
    // Tres puntos en línea, cada uno solapando solo con el siguiente. El del
    // medio se descarta por solapar con el primero (más barato); el
    // tercero, al no solapar con el primero (ya colocado), queda visible
    // aunque solapara con el segundo si este se hubiera colocado.
    const visibles = resolverColisiones([
      { id: 'a', x: 0, y: 0, precio: 1.0, ancho: 40, alto: 20 },
      { id: 'b', x: 35, y: 0, precio: 1.1, ancho: 40, alto: 20 },
      { id: 'c', x: 70, y: 0, precio: 1.2, ancho: 40, alto: 20 },
    ]);
    assert.ok(visibles.has('a'));
    assert.ok(!visibles.has('b'));
    assert.ok(visibles.has('c'));
  });

  it('sin puntos, no hay nada visible', () => {
    assert.equal(resolverColisiones([]).size, 0);
  });

  it('respeta el tamaño de caja por punto para el solape (la más barata es más grande)', () => {
    const visibles = resolverColisiones([
      { id: 'barata', x: 0, y: 0, precio: 1.409, ancho: 80, alto: 30 },
      { id: 'vecina', x: 55, y: 0, precio: 1.5, ancho: 60, alto: 26 },
    ]);
    // Con la caja más grande de "barata" (ancho 80 → mitad 40 + margen),
    // "vecina" a 55px de distancia cae dentro y se descarta.
    assert.deepEqual([...visibles], ['barata']);
  });
});

describe('agruparEnRacimos', () => {
  it('agrupa puntos cercanos en un solo racimo con el precio mínimo', () => {
    const racimos = agruparEnRacimos(
      [
        { id: 'a', x: 10, y: 10, precio: 1.5 },
        { id: 'b', x: 15, y: 12, precio: 1.409 },
        { id: 'c', x: 12, y: 18, precio: 1.6 },
      ],
      60
    );
    assert.equal(racimos.length, 1);
    assert.equal(racimos[0]!.precioMinimo, 1.409);
    assert.deepEqual(racimos[0]!.ids.sort(), ['a', 'b', 'c']);
  });

  it('no agrupa una estación sola: no genera un racimo de uno', () => {
    const racimos = agruparEnRacimos([{ id: 'sola', x: 500, y: 500, precio: 1.5 }], 60);
    assert.equal(racimos.length, 0);
  });

  it('separa en racimos distintos los puntos lejos entre sí', () => {
    const racimos = agruparEnRacimos(
      [
        { id: 'a1', x: 10, y: 10, precio: 1.4 },
        { id: 'a2', x: 12, y: 14, precio: 1.5 },
        { id: 'b1', x: 900, y: 900, precio: 1.3 },
        { id: 'b2', x: 905, y: 902, precio: 1.35 },
      ],
      60
    );
    assert.equal(racimos.length, 2);
  });

  it('el precio mínimo es null si ninguna estación del grupo vende el combustible', () => {
    const racimos = agruparEnRacimos(
      [
        { id: 'a', x: 0, y: 0, precio: null },
        { id: 'b', x: 5, y: 5, precio: null },
      ],
      60
    );
    assert.equal(racimos.length, 1);
    assert.equal(racimos[0]!.precioMinimo, null);
  });

  it('rechaza un radio no positivo', () => {
    assert.throws(() => agruparEnRacimos([], 0));
    assert.throws(() => agruparEnRacimos([], -10));
  });
});

describe('idsAgrupados', () => {
  it('reúne los ids de todos los racimos en un único conjunto', () => {
    const ids = idsAgrupados([
      { x: 0, y: 0, ids: ['a', 'b'], precioMinimo: 1.4 },
      { x: 100, y: 100, ids: ['c'], precioMinimo: 1.5 },
    ]);
    assert.deepEqual([...ids].sort(), ['a', 'b', 'c']);
  });

  it('sin racimos, el conjunto está vacío', () => {
    assert.equal(idsAgrupados([]).size, 0);
  });
});
