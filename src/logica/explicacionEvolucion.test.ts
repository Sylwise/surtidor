import test from 'node:test';
import assert from 'node:assert/strict';
import { explicarEvolucion } from './explicacionEvolucion.ts';
import type { HistoricoProvincia, AgregadoHistorico } from '../../scripts/lib/artefactos-historicos.ts';
import type { Estacion } from '../../scripts/lib/tipos.ts';

const fechas = Array.from({ length: 90 }, (_, indice) => new Date(Date.UTC(2026, 4, 1 + indice)).toISOString().slice(0, 10));
const precios = Array.from({ length: 90 }, (_, indice) => 1400 + (indice < 87 ? indice : 87 + (indice - 87) * 20));
const agregado = (series: number[][]): AgregadoHistorico => ({
  gasolina95e5: precios.map((_, indice) => { const valores = series.map((serie) => serie[indice]!); return [valores.reduce((a, b) => a + b, 0), valores.length, Math.min(...valores)]; }),
  gasoleoA: [], gasolina98e5: [], gasoleoPremium: [],
});
const estaciones: Estacion[] = ['1', '2', '3'].map((id) => ({ id, rotulo: id === '3' ? 'OTRA' : 'REPSOL', direccion: id, municipio: 'Vitoria-Gasteiz', cp: '', lat: 0, lon: 0, horario: '', tipoVenta: 'P', margen: null, precios: { gasolina95e5: 1.55, gasoleoA: null, gasolina98e5: null, gasoleoPremium: null } }));
const series = [precios, precios.map((p) => p + 10), precios.map((p, i) => p - i * 4)];
const historico = { version: 1, provinciaId: '01', fechas, estaciones: series.map((serie, indice) => [String(indice + 1), indice === 2 ? '2' : '1', Array(90).fill(1), serie, Array(90).fill(null), Array(90).fill(null), Array(90).fill(null)]), provincia: agregado(series), municipios: { '1': agregado(series.slice(0, 2)), '2': agregado([series[2]!]) } } as HistoricoProvincia;

test('explica amplitud, tramo intenso y distancia a extremos', () => {
  const resultado = explicarEvolucion(historico, estaciones, 'gasolina95e5', 30);
  assert.equal(resultado.amplitud.comparables, 3);
  assert.equal(resultado.amplitud.subieron, 2);
  assert.equal(resultado.amplitud.bajaron, 1);
  assert.equal(resultado.tramoIntenso?.hasta, fechas.at(-1));
  assert.ok(resultado.distanciaAlMinimoMilesimas! > 0);
});

test('detecta una marca con varias estaciones alineadas', () => {
  const resultado = explicarEvolucion(historico, estaciones, 'gasolina95e5', 30);
  assert.equal(resultado.marcaMasAlineada?.rotulo, 'REPSOL');
  assert.equal(resultado.marcaMasAlineada?.alineadas, 2);
});

test('acota la explicación y los comparables al municipio solicitado', () => {
  const resultado = explicarEvolucion(historico, estaciones, 'gasolina95e5', 30, '1');
  assert.equal(resultado.amplitud.comparables, 2);
  assert.equal(resultado.amplitud.subieron, 2);
  assert.equal(resultado.amplitud.bajaron, 0);
});
