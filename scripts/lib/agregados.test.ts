import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcularAgregadosEditoriales } from './agregados.ts';
import type { DatosProvincia, Estacion, Precios, Zona } from './tipos.ts';

const SIN_PRECIOS: Precios = {
  gasolina95e5: null,
  gasoleoA: null,
  gasolina98e5: null,
  gasoleoPremium: null,
};

function estacion(id: string, precios: Partial<Precios>, rotulo = 'ROTULO'): Estacion {
  return {
    id,
    rotulo,
    direccion: 'CALLE FALSA 1',
    municipio: 'Municipio',
    cp: '00000',
    lat: 40,
    lon: -3,
    horario: 'L-D: 24H',
    tipoVenta: 'P',
    margen: 'N',
    precios: { ...SIN_PRECIOS, ...precios },
  };
}

function estacionRestringida(id: string, precios: Partial<Precios>): Estacion {
  return { ...estacion(id, precios), tipoVenta: 'R' };
}

function provincia(id: string, estaciones: Estacion[]): DatosProvincia {
  return {
    provincia: { id, nombre: `Provincia ${id}` },
    actualizado: '2026-08-09T10:00:00Z',
    fechaMiteco: '',
    estaciones,
  };
}

function zona(id: string, provincias: string[]): Zona {
  return { id, nombre: `Zona ${id}`, tipo: 'provincia', provincias };
}

function calcular(datos: DatosProvincia[], zonas: Zona[]) {
  return calcularAgregadosEditoriales(datos, zonas, '2026-08-09T10:00:00Z');
}

describe('calcularAgregadosEditoriales', () => {
  it('devuelve media y mínimo null con n cero si la provincia no vende el combustible', () => {
    const resultado = calcular(
      [provincia('01', [estacion('1', { gasolina95e5: null })])],
      [zona('provincia-01', ['01'])],
    );

    assert.deepEqual(resultado.zonas.general[0]?.combustibles.gasolina95e5, {
      media: null,
      minimo: null,
      n: 0,
    });
  });

  it('una provincia con una sola estación devuelve su precio como media y mínimo', () => {
    const resultado = calcular(
      [provincia('01', [estacion('1', { gasolina95e5: 1.537 })])],
      [zona('provincia-01', ['01'])],
    );

    assert.deepEqual(resultado.zonas.general[0]?.combustibles.gasolina95e5, {
      media: 1.537,
      minimo: 1.537,
      n: 1,
    });
  });

  it('un precio null no entra en el divisor ni arrastra la media a la baja', () => {
    const resultado = calcular(
      [
        provincia('01', [
          estacion('1', { gasolina95e5: 1.4 }),
          estacion('2', { gasolina95e5: null }),
          estacion('3', { gasolina95e5: 1.6 }),
        ]),
      ],
      [zona('provincia-01', ['01'])],
    );

    assert.deepEqual(resultado.zonas.general[0]?.combustibles.gasolina95e5, {
      media: 1.5,
      minimo: 1.4,
      n: 2,
    });
  });

  it('agrupa la media por rótulo recortando solo los espacios exteriores', () => {
    const resultado = calcular(
      [
        provincia('01', [
          estacion('1', { gasoleoA: 1.4 }, 'MARCA'),
          estacion('2', { gasoleoA: 1.6 }, ' MARCA  '),
          estacion('3', { gasoleoA: 1.7 }, 'Marca'),
        ]),
      ],
      [zona('provincia-01', ['01'])],
    );

    const porRotulo = new Map(resultado.rotulos.general.map((rotulo) => [rotulo.rotulo, rotulo]));
    assert.equal(porRotulo.size, 2);
    assert.equal(porRotulo.get('MARCA')?.estaciones, 2);
    assert.deepEqual(porRotulo.get('MARCA')?.combustibles.gasoleoA, { media: 1.5, n: 2 });
    assert.deepEqual(porRotulo.get('Marca')?.combustibles.gasoleoA, { media: 1.7, n: 1 });
  });

  it('separa Canarias, Ceuta y Melilla del ámbito general', () => {
    const datos = [
      provincia('01', [estacion('1', { gasolina95e5: 1.5 })]),
      provincia('35', [estacion('2', { gasolina95e5: 1.2 })]),
      provincia('51', [estacion('3', { gasolina95e5: 1.1 })]),
      provincia('52', [estacion('4', { gasolina95e5: 1.3 })]),
    ];
    const zonas = [
      zona('alava', ['01']),
      zona('las-palmas', ['35']),
      zona('ceuta', ['51']),
      zona('melilla', ['52']),
    ];

    const resultado = calcular(datos, zonas);

    assert.deepEqual(resultado.zonas.general.map((item) => item.id), ['alava']);
    assert.deepEqual(
      resultado.zonas.canariasCeutaMelilla.map((item) => item.id),
      ['las-palmas', 'ceuta', 'melilla'],
    );
    assert.deepEqual(resultado.rotulos.general[0]?.combustibles.gasolina95e5, {
      media: 1.5,
      n: 1,
    });
    assert.deepEqual(resultado.rotulos.canariasCeutaMelilla[0]?.combustibles.gasolina95e5, {
      media: 1.2,
      n: 3,
    });
    assert.deepEqual(
      resultado.rotulos.mercadosFiscales.map(({ id, rotulos }) => [id, rotulos[0]?.combustibles.gasolina95e5.n]),
      [['canarias', 1], ['ceuta', 1], ['melilla', 1]],
    );
  });

  it('excluye estaciones de venta no pública de medias, mínimos y rótulos', () => {
    const resultado = calcular(
      [
        provincia('01', [
          estacion('publica', { gasolina95e5: 1.5 }, 'PUBLICA'),
          estacionRestringida('restringida', { gasolina95e5: 0.5 }),
        ]),
      ],
      [zona('provincia-01', ['01'])],
    );

    assert.deepEqual(resultado.zonas.general[0]?.combustibles.gasolina95e5, {
      media: 1.5,
      minimo: 1.5,
      n: 1,
    });
    assert.deepEqual(resultado.rotulos.general.map(({ rotulo }) => rotulo), ['PUBLICA']);
  });
});
