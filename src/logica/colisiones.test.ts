import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { agruparEnRacimos, claveRacimo, idsAgrupados, resolverColisiones } from './colisiones.ts';

function punto(id: string, x: number, y: number, precio: number | null) {
  return { id, x, y, rejillaX: x, rejillaY: y, precio };
}

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
        punto('a', 10, 10, 1.5),
        punto('b', 15, 12, 1.409),
        punto('c', 12, 18, 1.6),
      ],
      60
    );
    assert.equal(racimos.length, 1);
    assert.equal(racimos[0]!.precioMinimo, 1.409);
    assert.deepEqual(racimos[0]!.ids.sort(), ['a', 'b', 'c']);
  });

  it('no agrupa una estación sola: no genera un racimo de uno', () => {
    const racimos = agruparEnRacimos([punto('sola', 500, 500, 1.5)], 60);
    assert.equal(racimos.length, 0);
  });

  it('separa en racimos distintos los puntos lejos entre sí', () => {
    const racimos = agruparEnRacimos(
      [
        punto('a1', 10, 10, 1.4),
        punto('a2', 12, 14, 1.5),
        punto('b1', 900, 900, 1.3),
        punto('b2', 905, 902, 1.35),
      ],
      60
    );
    assert.equal(racimos.length, 2);
  });

  it('el precio mínimo es null si ninguna estación del grupo vende el combustible', () => {
    const racimos = agruparEnRacimos(
      [
        punto('a', 0, 0, null),
        punto('b', 5, 5, null),
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

  it('conserva los grupos cuando solo se desplazan las coordenadas de pantalla', () => {
    const originales = [punto('a', 10, 10, 1.4), punto('b', 15, 12, 1.5)];
    const desplazados = originales.map((p) => ({ ...p, x: p.x + 347, y: p.y - 91 }));

    const antes = agruparEnRacimos(originales, 60).map((r) => claveRacimo(r.ids));
    const despues = agruparEnRacimos(desplazados, 60).map((r) => claveRacimo(r.ids));

    assert.deepEqual(despues, antes);
  });
});

describe('claveRacimo', () => {
  it('depende de los miembros y no de su orden de entrada', () => {
    assert.equal(claveRacimo(['b', 'a', 'c']), claveRacimo(['c', 'b', 'a']));
    assert.notEqual(claveRacimo(['a', 'b']), claveRacimo(['a', 'c']));
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
