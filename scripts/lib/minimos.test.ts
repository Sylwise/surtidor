import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcularAgregadosMinimos } from './minimos.ts';
import type { DatosProvincia, Estacion, IndiceMunicipios, Precios, Zona } from './tipos.ts';

const SIN_PRECIOS: Precios = {
  gasolina95e5: null,
  gasoleoA: null,
  gasolina98e5: null,
  gasoleoPremium: null,
};

function estacion(id: string, municipio: string, precio: number | null, tipoVenta: Estacion['tipoVenta'] = 'P'): Estacion {
  return {
    id,
    rotulo: 'RÓTULO',
    direccion: 'CALLE 1',
    municipio,
    cp: '00000',
    lat: 40,
    lon: -3,
    horario: 'L-D: 24H',
    tipoVenta,
    margen: 'N',
    precios: { ...SIN_PRECIOS, gasolina95e5: precio },
  };
}

function provincia(id: string, estaciones: Estacion[]): DatosProvincia {
  return {
    provincia: { id, nombre: `Provincia ${id}` },
    actualizado: '2026-08-09T10:00:00Z',
    fechaMiteco: '',
    estaciones,
  };
}

function comunidad(id: string, provincias: string[]): Zona {
  return { id, nombre: `Comunidad ${id}`, tipo: 'ccaa', provincias };
}

function catalogo(municipios: Array<{ nombre: string; provinciaId: string; estaciones?: number }>): IndiceMunicipios {
  return {
    actualizado: '2026-08-09T10:00:00Z',
    municipios: municipios.map((municipio) => ({ estaciones: 3, ...municipio })),
  };
}

describe('calcularAgregadosMinimos', () => {
  it('devuelve el mínimo, la muestra y todos los municipios empatados', () => {
    const datos = [
      provincia('01', [
        estacion('1', 'Alfa', 1.4),
        estacion('2', 'Beta', 1.4),
        estacion('3', 'Gamma', 1.5),
        estacion('4', 'Privada', 1.1, 'R'),
        estacion('5', 'Sin precio', null),
      ]),
    ];
    const resultado = calcularAgregadosMinimos(
      datos,
      [comunidad('comunidad-1', ['01'])],
      catalogo([
        { nombre: 'Alfa', provinciaId: '01' },
        { nombre: 'Beta', provinciaId: '01' },
        { nombre: 'Gamma', provinciaId: '01' },
      ]),
      '2026-08-09T10:00:00Z',
    );

    assert.equal(resultado.nacional.gasolina95e5.minimo, 1.4);
    assert.equal(resultado.nacional.gasolina95e5.n, 3);
    assert.deepEqual(
      resultado.nacional.gasolina95e5.origenes.map(({ municipio }) => municipio),
      ['Alfa', 'Beta'],
    );
  });

  // Con los datos reales de hoy, los cuatro mínimos nacionales son únicos
  // (Torà, Arén, Mollet del Vallès, Fortuna), así que
  // src/pages/hoy/la-mas-barata-de-espana.astro nunca pinta la fila "Empate
  // al mínimo nacional" (su condición es origenes.length > 1). Esta prueba
  // fuerza con datos sintéticos un empate exacto entre dos provincias
  // distintas, para comprobar que origenes.length sí puede superar 1 y que
  // ambos orígenes quedan presentes, que es justo lo que activa esa fila.
  it('un empate exacto entre dos provincias deja más de un origen, la condición que pinta "Empate al mínimo nacional"', () => {
    const datos = [
      provincia('01', [estacion('1', 'Alfa', 1.399)]),
      provincia('02', [estacion('2', 'Beta', 1.399)]),
    ];
    const resultado = calcularAgregadosMinimos(
      datos,
      [comunidad('comunidad-1', ['01']), comunidad('comunidad-2', ['02'])],
      catalogo([
        { nombre: 'Alfa', provinciaId: '01' },
        { nombre: 'Beta', provinciaId: '02' },
      ]),
      '2026-08-09T10:00:00Z',
    );

    assert.equal(resultado.nacional.gasolina95e5.minimo, 1.399);
    assert.ok(resultado.nacional.gasolina95e5.origenes.length > 1);
    assert.deepEqual(
      resultado.nacional.gasolina95e5.origenes.map(({ municipio }) => municipio),
      ['Alfa', 'Beta'],
    );
  });

  it('enlaza a la provincia si el municipio del mínimo no genera página propia', () => {
    const datos = [provincia('01', [estacion('1', 'Pequeño', 1.4)])];

    const resultado = calcularAgregadosMinimos(
      datos,
      [comunidad('comunidad-1', ['01'])],
      catalogo([{ nombre: 'Pequeño', provinciaId: '01', estaciones: 2 }]),
      '2026-08-09T10:00:00Z',
    );

    assert.deepEqual(resultado.nacional.gasolina95e5.origenes[0], {
      municipio: 'Pequeño',
      provinciaId: '01',
      provinciaNombre: 'Provincia 01',
      href: '/provincia-01/',
      destino: 'provincia',
    });
  });
});
