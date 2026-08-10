import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  avanzarEstadoHistorico,
  construirEstadoHistorico,
  expandirTerritorios,
  parsearEstadoHistorico,
  partirEstadoPorProvincia,
  validarEstadoHistorico,
} from './estado-historico.ts';
import type { EstacionHistorica, InstantaneaHistorica } from './historico.ts';

function fila(
  id: string,
  provincia = '01',
  municipio = '01059',
  precio: number | null = 1400,
): EstacionHistorica {
  return [id, provincia, municipio, precio, null, null, null];
}

function dia(fecha: string, estaciones: EstacionHistorica[]): InstantaneaHistorica {
  return { version: 1, fecha, estaciones };
}

test('construye series con huecos y cambios territoriales explícitos', () => {
  const estado = construirEstadoHistorico([
    dia('2026-08-01', [fila('1'), fila('2')]),
    dia('2026-08-02', [fila('1', '28', '28079', 1390)]),
    dia('2026-08-03', [fila('1', '28', '28079', 1380), fila('2')]),
  ]);

  assert.deepEqual(estado.fechas, ['2026-08-01', '2026-08-02', '2026-08-03']);
  assert.deepEqual(estado.estaciones[0], [
    '1',
    [
      [0, '01', '01059'],
      [1, '28', '28079'],
    ],
    [1400, 1390, 1380],
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ]);
  assert.deepEqual(expandirTerritorios(estado.estaciones[1]![1], 3), [
    ['01', '01059'],
    null,
    ['01', '01059'],
  ]);
});

test('avanza la ventana, incorpora nuevas estaciones y conserva ausencias', () => {
  const estado = construirEstadoHistorico([
    dia('2026-08-01', [fila('1')]),
    dia('2026-08-02', [fila('1', '01', '01059', 1390)]),
  ]);
  const siguiente = avanzarEstadoHistorico(
    estado,
    dia('2026-08-03', [fila('2', '28', '28079', 1500)]),
  );

  assert.deepEqual(siguiente.fechas, ['2026-08-01', '2026-08-02', '2026-08-03']);
  assert.deepEqual(siguiente.estaciones.find(([id]) => id === '1')?.[2], [1400, 1390, null]);
  assert.deepEqual(siguiente.estaciones.find(([id]) => id === '2')?.[2], [null, null, 1500]);
});

test('rechaza huecos, fechas repetidas y longitudes inconsistentes', () => {
  assert.throws(
    () => construirEstadoHistorico([dia('2026-08-01', []), dia('2026-08-03', [])]),
    /hueco/,
  );
  const estado = construirEstadoHistorico([dia('2026-08-01', [fila('1')])]);
  assert.throws(() => avanzarEstadoHistorico(estado, dia('2026-08-01', [])), /se esperaba/);

  const roto = structuredClone(estado);
  roto.estaciones[0]![2].push(1300);
  assert.throws(() => validarEstadoHistorico(roto), /no tiene 1 observaciones/);
});

test('valida el contrato al recuperar estado y rechaza precios imposibles', () => {
  const estado = construirEstadoHistorico([dia('2026-08-01', [fila('1')])]);
  assert.deepEqual(parsearEstadoHistorico(JSON.parse(JSON.stringify(estado))), estado);

  const roto = structuredClone(estado);
  roto.estaciones[0]![2][0] = 10_001;
  assert.throws(() => parsearEstadoHistorico(roto), /no cumple el contrato/);
});

test('parte por toda provincia observada sin perder cambios ni ausencias', () => {
  const estado = construirEstadoHistorico([
    dia('2026-08-01', [fila('1', '01'), fila('2', '48')]),
    dia('2026-08-02', [fila('1', '28')]),
  ]);
  const provincias = partirEstadoPorProvincia(estado);

  assert.deepEqual([...provincias.keys()], ['01', '28', '48']);
  assert.deepEqual(provincias.get('01')?.estaciones.map(([id]) => id), ['1']);
  assert.deepEqual(provincias.get('28')?.estaciones.map(([id]) => id), ['1']);
  assert.deepEqual(expandirTerritorios(provincias.get('48')!.estaciones[0]![1], 2), [
    ['48', '01059'],
    null,
  ]);
});
