import test from 'node:test';
import assert from 'node:assert/strict';
import { cambioEnPeriodo, serieDeEstacion, serieMedia } from './evolucion.ts';
import type { HistoricoProvincia } from '../../scripts/lib/artefactos-historicos.ts';

const fechas = Array.from({ length: 90 }, (_, i) => `2026-05-${String(i + 1).padStart(2, '0')}`);
const precios = Array.from({ length: 90 }, (_, i) => 1400 + i);
const agregado = { gasolina95e5: precios.map((p) => [p * 2, 2, p] as [number, number, number]), gasoleoA: [], gasolina98e5: [], gasoleoPremium: [] };
const historico = { version: 1, provinciaId: '01', fechas, estaciones: [['1', '01059', Array(90).fill(1), precios, Array(90).fill(null), Array(90).fill(null), Array(90).fill(null)]], provincia: agregado, municipios: { '01059': agregado } } as HistoricoProvincia;

test('calcula la variación con extremos exactos', () => {
  const cambio = cambioEnPeriodo(serieDeEstacion(historico, '1', 'gasolina95e5')!, 30);
  assert.equal(cambio?.diferenciaMilesimas, 30);
});

test('un hueco en un extremo no se sustituye por otro día', () => {
  const serie = serieDeEstacion(historico, '1', 'gasolina95e5')!;
  serie[59]!.milesimas = null;
  assert.equal(cambioEnPeriodo(serie, 30), null);
});

test('la media conserva suma y tamaño de muestra hasta el último paso', () => {
  assert.equal(serieMedia(agregado, fechas, 'gasolina95e5')[10]?.milesimas, 1410);
});
