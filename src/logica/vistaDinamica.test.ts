import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcularVista, PRESUPUESTO_BYTES_COMPRIMIDO, UMBRAL_ZOOM_CARGA_DINAMICA } from './vistaDinamica.ts';
import type { Rectangulo, ResumenProvincia } from '../../scripts/lib/tipos.ts';

function provincia(id: string, rectangulo: Rectangulo, pesoComprimido = 1000): ResumenProvincia {
  return {
    id,
    nombre: `PROVINCIA ${id}`,
    estaciones: 10,
    minimos: {},
    centro: { lat: (rectangulo.minLat + rectangulo.maxLat) / 2, lon: (rectangulo.minLon + rectangulo.maxLon) / 2 },
    rectangulo,
    pesoComprimido,
  };
}

// Vista de área 100 (10x10). Álava-de-mentira ocupa el 50 %, Burgos-de-mentira
// el 10 % (por debajo del umbral), Madrid-de-mentira no se solapa nada.
const VISTA: Rectangulo = { minLat: 0, maxLat: 10, minLon: 0, maxLon: 10 };
const ALAVA = provincia('01', { minLat: 0, maxLat: 10, minLon: 0, maxLon: 5 }); // 50%
const BURGOS = provincia('09', { minLat: 0, maxLat: 1, minLon: 0, maxLon: 10 }); // 10%
const MADRID = provincia('28', { minLat: 100, maxLat: 110, minLon: 100, maxLon: 110 }); // 0%
const ZOOM_SOBRE_UMBRAL = UMBRAL_ZOOM_CARGA_DINAMICA + 1;

describe('calcularVista', () => {
  it('entran las provincias que superan el umbral de pantalla, ordenadas de más a menos', () => {
    const resultado = calcularVista([ALAVA, BURGOS, MADRID], VISTA, ZOOM_SOBRE_UMBRAL, []);
    assert.deepEqual(resultado.provincias.map((p) => p.id), ['01']);
    assert.deepEqual(resultado.excluidasPorPresupuesto, []);
  });

  it('por debajo del zoom de guarda, conserva lo ya cargado y no añade nada nuevo', () => {
    const resultado = calcularVista([ALAVA, BURGOS, MADRID], VISTA, UMBRAL_ZOOM_CARGA_DINAMICA - 1, ['09']);
    assert.deepEqual(resultado.provincias.map((p) => p.id), ['09']);
    assert.deepEqual(resultado.excluidasPorPresupuesto, []);
  });

  it('por debajo del zoom de guarda, con nada cargado antes, no carga nada', () => {
    const resultado = calcularVista([ALAVA, BURGOS, MADRID], VISTA, UMBRAL_ZOOM_CARGA_DINAMICA - 1, []);
    assert.deepEqual(resultado.provincias, []);
  });

  it('respeta el presupuesto de 300 KB: lo que no cabe se excluye y se informa, no crece en silencio', () => {
    // Dos provincias que superan el umbral, cada una pesa más de la mitad
    // del presupuesto: juntas no caben.
    const pesoGrande = Math.ceil(PRESUPUESTO_BYTES_COMPRIMIDO * 0.6);
    const a = provincia('01', { minLat: 0, maxLat: 10, minLon: 0, maxLon: 6 }, pesoGrande); // 60%
    const b = provincia('09', { minLat: 0, maxLat: 10, minLon: 6, maxLon: 10 }, pesoGrande); // 40%
    const resultado = calcularVista([a, b], VISTA, ZOOM_SOBRE_UMBRAL, []);
    assert.deepEqual(resultado.provincias.map((p) => p.id), ['01']); // la que más pantalla ocupa, entra
    assert.deepEqual(resultado.excluidasPorPresupuesto.map((p) => p.id), ['09']);
  });

  it('umbral estricto: exactamente el umbral no entra', () => {
    const exacta = provincia('01', { minLat: 0, maxLat: 10, minLon: 0, maxLon: 1.5 }); // exactamente 15%
    const resultado = calcularVista([exacta], VISTA, ZOOM_SOBRE_UMBRAL, []);
    assert.deepEqual(resultado.provincias, []);
  });
});
