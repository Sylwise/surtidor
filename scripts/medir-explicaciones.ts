import { readFileSync } from 'node:fs';
import { explicarEvolucion } from '../src/logica/explicacionEvolucion.ts';
import type { HistoricoProvincia } from './lib/artefactos-historicos.ts';
import type { ClavePrecioHistorico, Estacion } from './lib/tipos.ts';
import { COMBUSTIBLES_EVOLUCION } from '../src/logica/combustibles.ts';

const provincias = process.argv.slice(2).length ? process.argv.slice(2) : ['01', '08', '28'];
const combustibles: readonly ClavePrecioHistorico[] = COMBUSTIBLES_EVOLUCION;

for (const provinciaId of provincias) {
  const actual = JSON.parse(readFileSync(`public/data/provincias/${provinciaId}.json`, 'utf8')) as { provincia: { nombre: string }; estaciones: Estacion[] };
  const historico = JSON.parse(readFileSync(`public/data/historico/provincias/${provinciaId}.json`, 'utf8')) as HistoricoProvincia;
  console.log(`\n${actual.provincia.nombre} (${actual.estaciones.length} estaciones)`);
  for (const combustible of combustibles) {
    const resultado = explicarEvolucion(historico, actual.estaciones, combustible, 30);
    const cambio = resultado.cambio?.diferenciaMilesimas ?? null;
    if (cambio === null) continue;
    console.log(JSON.stringify({
      combustible,
      cambio,
      tramo: resultado.tramoIntenso,
      amplitud: resultado.amplitud,
      marca: resultado.marcaMasAlineada,
      sobreMinimo90: resultado.distanciaAlMinimoMilesimas,
      bajoMaximo90: resultado.distanciaAlMaximoMilesimas,
    }));
  }
}
