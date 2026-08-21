import assert from 'node:assert/strict';
import test from 'node:test';
import { actualizarEstado, normalizarPreferencias, obtenerEstado } from './estado.ts';
import type { EstacionZona } from './zona.ts';

function estacion(): EstacionZona {
  return {
    id: 'seleccionada',
    rotulo: 'PRUEBA',
    direccion: 'CALLE PRUEBA 1',
    municipio: 'CEUTA',
    cp: '51001',
    lat: 35.89,
    lon: -5.32,
    horario: 'L-D: 24H',
    tipoVenta: 'P',
    margen: 'N',
    precios: {
      gasolina95e5: 1.5,
      gasoleoA: null,
      gasolina98e5: null,
      gasoleoPremium: null,
      gasoleoB: null,
      glp: null,
    },
    provinciaId: '51',
    provinciaNombre: 'CEUTA',
  };
}

test('la zona guardada se recupera sin incorporar estado efímero de la hoja', () => {
  assert.deepEqual(normalizarPreferencias({ zonaId: 'araba-alava', combustible: 'gasoleoA', hoja: 'completa' }), {
    zonaId: 'araba-alava',
    combustible: 'gasoleoA',
  });
});

test('preferencias corruptas no crean una zona guardada', () => {
  assert.deepEqual(normalizarPreferencias({ zonaId: 1 }), {});
});

test('un combustible guardado tiene que existir en el catálogo', () => {
  assert.deepEqual(normalizarPreferencias({ zonaId: 'araba-alava', combustible: 'queroseno' }), {
    zonaId: 'araba-alava',
  });
});

test('cambiar a un combustible que la estación no vende cierra su ficha', () => {
  actualizarEstado({
    estaciones: [estacion()],
    combustible: 'gasolina95e5',
    estacionId: 'seleccionada',
  });
  assert.equal(obtenerEstado().estacionId, 'seleccionada');

  actualizarEstado({ combustible: 'glp' });
  assert.equal(obtenerEstado().estacionId, null);
});
