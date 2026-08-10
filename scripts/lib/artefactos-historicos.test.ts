import assert from 'node:assert/strict';
import { test } from 'node:test';

import { construirHistoricosProvincia } from './artefactos-historicos.ts';
import { construirEstadoHistorico } from './estado-historico.ts';
import type { EstacionHistorica, InstantaneaHistorica } from './historico.ts';

function dia(fecha: string, estaciones: EstacionHistorica[]): InstantaneaHistorica {
  return { version: 1, fecha, estaciones };
}

test('distingue ausencia de estación y combustible no vendido', () => {
  const estado = construirEstadoHistorico([
    dia('2026-08-01', [['1', '01', '01059', null, 1400, null, null]]),
    dia('2026-08-02', []),
    dia('2026-08-03', [['1', '01', '01059', 1300, 1390, null, null]]),
  ]);
  const alava = construirHistoricosProvincia(estado).get('01')!;

  assert.deepEqual(alava.estaciones[0]![1], [1, 0, 1]);
  assert.deepEqual(alava.estaciones[0]![2], [null, null, 1300]);
  assert.deepEqual(alava.provincia.gasolina95e5, [
    [0, 0, null],
    [0, 0, null],
    [1300, 1, 1300],
  ]);
});

test('agrega suma, n y mínimo en el territorio observado de cada día', () => {
  const estado = construirEstadoHistorico([
    dia('2026-08-01', [
      ['1', '01', '01059', 1400, null, null, null],
      ['2', '01', '01059', 1500, null, null, null],
    ]),
    dia('2026-08-02', [
      ['1', '28', '28079', 1300, null, null, null],
      ['2', '01', '01059', 1450, null, null, null],
    ]),
  ]);
  const provincias = construirHistoricosProvincia(estado);

  assert.deepEqual(provincias.get('01')!.provincia.gasolina95e5, [
    [2900, 2, 1400],
    [1450, 1, 1450],
  ]);
  assert.deepEqual(provincias.get('28')!.provincia.gasolina95e5, [
    [0, 0, null],
    [1300, 1, 1300],
  ]);
  assert.deepEqual(provincias.get('01')!.municipios['01059']!.gasolina95e5[0], [2900, 2, 1400]);
});
