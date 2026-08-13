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

  it('aplica el umbral dentro de cada mercado fiscal y etiqueta los que no tienen ranking', () => {
    const mercados = seleccionarMercadosFiscales([
      { id: 'canarias', nombre: 'Canarias', rotulos: [rotulo('A', 100), rotulo('B', 40)] },
      { id: 'ceuta', nombre: 'Ceuta', rotulos: [rotulo('C', 99)] },
      { id: 'melilla', nombre: 'Melilla', rotulos: [] },
    ]);

    assert.deepEqual(mercados.map(({ id, conRanking }) => [id, conRanking]), [
      ['canarias', true],
      ['ceuta', false],
      ['melilla', false],
    ]);
    assert.deepEqual(mercados[0]?.seleccion.incluidos.map(({ rotulo }) => rotulo), ['A']);
  });

  // Con los datos reales de hoy, ningún rótulo de Canarias, Ceuta ni Melilla
  // llega a las 100 estaciones (el mayor es REPSOL en Canarias, con 59), así
  // que src/pages/hoy/marcas-mas-baratas.astro siempre renderiza "Ningún
  // rótulo llega a las 100 estaciones aquí" y nunca el nombre de un rótulo.
  // Esta prueba fuerza con datos sintéticos la rama contraria: un rótulo que
  // sí llega al umbral y además vende el combustible, que es justo la
  // combinación que la página necesita para mostrar `referencia.elemento.rotulo`
  // en vez del mensaje de "ningún rótulo".
  it('un rótulo que llega al umbral y vende el combustible queda disponible para el bloque fiscal de marcas-mas-baratas', () => {
    const mercados = seleccionarMercadosFiscales([
      {
        id: 'canarias',
        nombre: 'Canarias',
        rotulos: [conGasolina95('DISA', 150, 1.55), conGasolina95('REPSOL', 40, 1.6)],
      },
    ]);

    const incluidos = mercados[0]!.seleccion.incluidos;
    assert.deepEqual(incluidos.map(({ rotulo }) => rotulo), ['DISA']);

    // Mismo filtro que usa la página (rotulosQueVenden) antes de tomar el
    // primero como "referencia": si DISA no vendiera el combustible, esta
    // lista saldría vacía y la página caería igualmente en "ningún rótulo".
    const disponiblesParaVender = rotulosQueVenden(incluidos, 'gasolina95e5');
    assert.deepEqual(disponiblesParaVender.map(({ rotulo }) => rotulo), ['DISA']);
  });
});
