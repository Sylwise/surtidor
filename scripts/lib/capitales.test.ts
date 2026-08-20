import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CAPITALES, calcularAgregadosCapitales } from './capitales.ts';
import type { DatosProvincia, Estacion, IndiceMunicipios, Precios } from './tipos.ts';

const SIN_PRECIOS: Precios = {
  gasolina95e5: null,
  gasoleoA: null,
  gasolina98e5: null,
  gasoleoPremium: null,
  gasoleoB: null,
  glp: null,
};

function datosCompletos(): { provincias: DatosProvincia[]; municipios: IndiceMunicipios } {
  const provincias = CAPITALES.map((capital): DatosProvincia => ({
    provincia: { id: capital.provinciaId, nombre: `Provincia ${capital.provinciaId}` },
    actualizado: '2026-08-09T10:00:00Z',
    fechaMiteco: '',
    estaciones: [],
  }));
  const municipios: IndiceMunicipios = {
    actualizado: '2026-08-09T10:00:00Z',
    municipios: CAPITALES.map((capital) => ({ ...capital, estaciones: 3 })),
  };
  return { provincias, municipios };
}

function estacion(
  municipio: string,
  precio: number | null,
  tipoVenta: Estacion['tipoVenta'] = 'P',
): Estacion {
  return {
    id: `${municipio}-${precio}`,
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

describe('calcularAgregadosCapitales', () => {
  it('mantiene una tabla fija de 52 capitales, una por provincia', () => {
    assert.equal(CAPITALES.length, 52);
    assert.equal(new Set(CAPITALES.map(({ provinciaId }) => provinciaId)).size, 52);
  });

  it('falla con el nombre exacto cuando una capital no casa con el catálogo', () => {
    const { provincias, municipios } = datosCompletos();
    municipios.municipios = municipios.municipios.filter(({ provinciaId }) => provinciaId !== '01');

    assert.throws(
      () => calcularAgregadosCapitales(provincias, municipios, municipios.actualizado),
      /No se encontró la capital "Vitoria-Gasteiz"/,
    );
  });

  it('calcula la media solo con estaciones públicas de la capital y conserva n', () => {
    const { provincias, municipios } = datosCompletos();
    const albacete = provincias.find(({ provincia }) => provincia.id === '02');
    assert.ok(albacete);
    albacete.estaciones = [
      estacion('Albacete', 1.4),
      estacion('Albacete', null),
      estacion('Albacete', 1.6),
      estacion('Albacete', 1.1, 'R'),
      estacion('Otro municipio', 1.2),
    ];

    const resultado = calcularAgregadosCapitales(provincias, municipios, municipios.actualizado);
    const capital = resultado.general.find(({ provinciaId }) => provinciaId === '02');

    assert.deepEqual(capital?.combustibles.gasolina95e5, { media: 1.5, minimo: 1.4, n: 2 });
    assert.equal(capital?.href, '/provincia-02/albacete/');
  });
});
