import test from 'node:test';
import assert from 'node:assert/strict';
import { cambioEnPeriodo, cambiosDeEstaciones, estabilidadObservada, serieDeEstacion, serieMedia, serieMinimo } from './evolucion.ts';
import type { HistoricoProvincia } from '../../scripts/lib/artefactos-historicos.ts';

const fechas = Array.from({ length: 90 }, (_, i) => `2026-05-${String(i + 1).padStart(2, '0')}`);
const precios = Array.from({ length: 90 }, (_, i) => 1400 + i);
const agregado = { gasolina95e5: precios.map((p) => [p * 2, 2, p] as [number, number, number]), gasoleoA: [], gasolina98e5: [], gasoleoPremium: [] };
const historico = { version: 1, provinciaId: '01', fechas, estaciones: [['1', '01059', Array(90).fill(1), precios, Array(90).fill(null), Array(90).fill(null), Array(90).fill(null)]], provincia: agregado, municipios: { '01059': agregado } } as HistoricoProvincia;

test('calcula la variación con extremos exactos', () => {
  const cambio = cambioEnPeriodo(serieDeEstacion(historico, '1', 'gasolina95e5')!, 30);
  assert.equal(cambio?.diferenciaMilesimas, 30);
});

test('calcula también el cambio de un día con extremos exactos', () => {
  const cambio = cambioEnPeriodo(serieDeEstacion(historico, '1', 'gasolina95e5')!, 1);
  assert.equal(cambio?.diferenciaMilesimas, 1);
});

test('un hueco en un extremo no se sustituye por otro día', () => {
  const serie = serieDeEstacion(historico, '1', 'gasolina95e5')!;
  serie[59]!.milesimas = null;
  assert.equal(cambioEnPeriodo(serie, 30), null);
});

test('la media conserva suma y tamaño de muestra hasta el último paso', () => {
  assert.equal(serieMedia(agregado, fechas, 'gasolina95e5')[10]?.milesimas, 1410);
  assert.equal(serieMinimo(agregado, fechas, 'gasolina95e5')[10]?.milesimas, 1410);
});

test('expresa la estabilidad desde la primera observación del precio actual', () => {
  const serie = [1400, 1410, null, 1410, 1410].map((milesimas, indice) => ({ fecha: `2026-08-${indice + 1}`, milesimas }));
  assert.deepEqual(estabilidadObservada(serie), { dias: 3, limitadaPorVentana: false });
});

test('acota la estabilidad a la ventana cuando no observa un precio distinto', () => {
  const serie = [null, 1410, null, 1410].map((milesimas, indice) => ({ fecha: `2026-08-${indice + 1}`, milesimas }));
  assert.deepEqual(estabilidadObservada(serie), { dias: 2, limitadaPorVentana: true });
  assert.equal(estabilidadObservada([{ fecha: '2026-08-01', milesimas: 1410 }]), null);
});

test('ordena los cambios y permite limitarlos al municipio actual', () => {
  const segundo = ['2', 'otro', Array(90).fill(1), precios.map((p) => p - 2), Array(90).fill(null), Array(90).fill(null), Array(90).fill(null)] as HistoricoProvincia['estaciones'][number];
  const tercero = ['3', '01059', Array(90).fill(1), precios.map((p, i) => p - i * 2), Array(90).fill(null), Array(90).fill(null), Array(90).fill(null)] as HistoricoProvincia['estaciones'][number];
  const conTres = { ...historico, estaciones: [...historico.estaciones, segundo, tercero] };
  assert.deepEqual(cambiosDeEstaciones(conTres, 'gasolina95e5', 7, '01059').map((c) => c.estacionId), ['3', '1']);
});

test('el ranking excluye estaciones sin ambos extremos exactos', () => {
  const conHueco = structuredClone(historico);
  conHueco.estaciones[0]![3][82] = null;
  assert.deepEqual(cambiosDeEstaciones(conHueco, 'gasolina95e5', 7), []);
});
