import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularRellenoMapa,
  desplazamientoParaRelleno,
  type RectanguloVisible,
} from './rellenoMapa.ts';

const mapa: RectanguloVisible = { top: 0, bottom: 800, left: 0, right: 400, width: 400, height: 800 };

function hoja(altura: number): RectanguloVisible {
  return { top: 800 - altura, bottom: 800, left: 0, right: 400, width: 400, height: altura };
}

test('usa la altura real de los tres estados de la hoja móvil', () => {
  assert.deepEqual(calcularRellenoMapa(mapa, hoja(44), true), { top: 32, right: 32, bottom: 76, left: 32 });
  assert.deepEqual(calcularRellenoMapa(mapa, hoja(440), true), { top: 32, right: 32, bottom: 472, left: 32 });
  assert.deepEqual(calcularRellenoMapa(mapa, hoja(748), true), { top: 13, right: 32, bottom: 761, left: 32 });
});

test('no reserva la hoja cuando no se superpone o no es móvil', () => {
  const fuera = { ...hoja(440), left: 500, right: 900 };
  assert.equal(calcularRellenoMapa(mapa, fuera, true).bottom, 32);
  assert.equal(calcularRellenoMapa(mapa, hoja(440), false).bottom, 32);
});

test('convierte el relleno en un offset puntual hacia el área visible', () => {
  assert.deepEqual(
    desplazamientoParaRelleno({ top: 32, right: 32, bottom: 472, left: 32 }),
    [0, -220],
  );
  assert.deepEqual(
    desplazamientoParaRelleno({ top: 20, right: 60, bottom: 40, left: 10 }),
    [-25, -10],
  );
});
