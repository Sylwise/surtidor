import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  avanzarEstadoHistorico,
  comprobarVentanaCompleta,
  construirEstadoHistorico,
  expandirTerritorios,
  fechasSinPrecios,
  parsearEstadoHistorico,
  partirEstadoPorProvincia,
  reemplazarInstantaneaHistorica,
  validarEstadoHistorico,
} from './estado-historico.ts';
import { desplazarFecha, DIAS_HISTORICO, type EstacionHistorica, type InstantaneaHistorica } from './historico.ts';

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

test('detecta los días nacionales sin ningún precio publicado', () => {
  const estado = construirEstadoHistorico([
    dia('2026-08-01', [fila('1')]),
    dia('2026-08-02', []),
    dia('2026-08-03', [fila('1', '01', '01059', null), fila('2', '28', '28079', 1500)]),
  ]);

  assert.deepEqual(fechasSinPrecios(estado), ['2026-08-02']);
});

test('repara una fecha vacía sin volver a descargar el resto de la ventana', () => {
  const estado = construirEstadoHistorico([
    dia('2026-08-01', [fila('1', '01', '01059', 1400)]),
    dia('2026-08-02', []),
    dia('2026-08-03', [fila('1', '01', '01059', 1380)]),
  ]);

  const reparado = reemplazarInstantaneaHistorica(
    estado,
    dia('2026-08-02', [fila('1', '01', '01059', 1390), fila('2', '28', '28079', 1500)]),
  );

  assert.deepEqual(reparado.fechas, estado.fechas);
  assert.deepEqual(reparado.estaciones.find(([id]) => id === '1')?.[2], [1400, 1390, 1380]);
  assert.deepEqual(reparado.estaciones.find(([id]) => id === '2')?.[2], [null, 1500, null]);
  assert.deepEqual(fechasSinPrecios(reparado), []);
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

test('mock contamina el estado y se conserva aunque el día de prueba salga de la ventana (RNF-43)', () => {
  const limpio = construirEstadoHistorico([dia('2026-08-01', [fila('1')])]);
  assert.equal(limpio.mock, undefined);

  const construidoConMock = construirEstadoHistorico([
    dia('2026-08-01', [fila('1')]),
    { ...dia('2026-08-02', [fila('1', '01', '01059', 1390)]), mock: true },
  ]);
  assert.equal(construidoConMock.mock, true);

  const avanzadoLimpio = avanzarEstadoHistorico(limpio, {
    ...dia('2026-08-02', [fila('1', '01', '01059', 1390)]),
    mock: true,
  });
  assert.equal(avanzadoLimpio.mock, true);

  // El día marcado como mock sale de la ventana en el siguiente avance, pero
  // la marca no se limpia sola: solo --reconstruir (siempre contra datos
  // reales) produce un estado sin ella.
  const siguiente = avanzarEstadoHistorico(avanzadoLimpio, dia('2026-08-03', [fila('1', '01', '01059', 1380)]));
  assert.equal(siguiente.mock, true);

  assert.deepEqual(parsearEstadoHistorico(JSON.parse(JSON.stringify(construidoConMock))), construidoConMock);
});

test('comprobarVentanaCompleta exige exactamente DIAS_HISTORICO días, con el conteo en el mensaje (materializar-historico.ts)', () => {
  const completo = construirEstadoHistorico(
    Array.from({ length: DIAS_HISTORICO }, (_, indice) => dia(desplazarFecha('2026-01-01', indice), [fila('1')])),
  );
  assert.doesNotThrow(() => comprobarVentanaCompleta(completo));

  const corto = construirEstadoHistorico([dia('2026-08-01', [fila('1')])]);
  assert.throws(() => comprobarVentanaCompleta(corto), /tiene 1 días; se esperaban 90/);

  // El caso concreto que motivó el guardián: una reconstrucción que se
  // detiene a mitad de camino (p. ej. en el día 60 de 90) no puede llegar a
  // materializar-historico.ts y publicarse como si fuera una ventana válida.
  const sesentaDias = construirEstadoHistorico(
    Array.from({ length: 60 }, (_, indice) => dia(desplazarFecha('2026-01-01', indice), [fila('1')])),
  );
  assert.throws(() => comprobarVentanaCompleta(sesentaDias), /tiene 60 días; se esperaban 90/);
});

test('una ventana con un día menos de los esperados no pasa comprobarVentanaCompleta (protege reconstruir())', () => {
  // Simula lo que produciría reconstruir() si un futuro refactor capturase
  // el fallo de un día y siguiera en vez de abortar: una instantánea menos
  // en la lista que se pasa a construirEstadoHistorico.
  const casiCompleto = construirEstadoHistorico(
    Array.from({ length: DIAS_HISTORICO - 1 }, (_, indice) => dia(desplazarFecha('2026-01-01', indice), [fila('1')])),
  );
  assert.equal(casiCompleto.fechas.length, DIAS_HISTORICO - 1);
  assert.throws(() => comprobarVentanaCompleta(casiCompleto), /tiene 89 días; se esperaban 90/);
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
