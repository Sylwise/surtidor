import { readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { gzipSync } from 'node:zlib';

import type { EstacionHistorica, InstantaneaHistorica, PrecioHistorico } from './lib/historico.ts';

type SerieEstacion = [
  id: string,
  provinciaId: string,
  municipioId: string,
  gasolina95e5: PrecioHistorico[],
  gasoleoA: PrecioHistorico[],
  gasolina98e5: PrecioHistorico[],
  gasoleoPremium: PrecioHistorico[],
];

interface VentanaMedicion {
  version: 1;
  fechas: string[];
  estaciones: SerieEstacion[];
}

function bytesLegibles(bytes: number): string {
  return new Intl.NumberFormat('es-ES').format(bytes) + ' B';
}

function nuevaSerie(fila: EstacionHistorica, dias: number): SerieEstacion {
  return [
    fila[0],
    fila[1],
    fila[2],
    Array<PrecioHistorico>(dias).fill(null),
    Array<PrecioHistorico>(dias).fill(null),
    Array<PrecioHistorico>(dias).fill(null),
    Array<PrecioHistorico>(dias).fill(null),
  ];
}

async function main(): Promise<void> {
  const directorio = resolve(process.argv[2] ?? 'datos-historicos');
  const nombres = (await readdir(directorio))
    .filter((nombre) => /^\d{4}-\d{2}-\d{2}\.json$/.test(nombre))
    .sort();
  if (nombres.length === 0) throw new Error(`No hay instantáneas en ${directorio}.`);

  const instantaneas: InstantaneaHistorica[] = [];
  let bytesDiarios = 0;
  let gzipDiarios = 0;
  for (const nombre of nombres) {
    const contenido = await readFile(join(directorio, nombre), 'utf8');
    bytesDiarios += Buffer.byteLength(contenido);
    gzipDiarios += gzipSync(contenido, { level: 9 }).byteLength;
    const instantanea = JSON.parse(contenido) as InstantaneaHistorica;
    if (instantanea.fecha !== nombre.slice(0, 10)) {
      throw new Error(`${nombre}: la fecha interior no coincide (${instantanea.fecha}).`);
    }
    instantaneas.push(instantanea);
  }

  const series = new Map<string, SerieEstacion>();
  let cambiosTerritoriales = 0;
  for (const [indiceDia, instantanea] of instantaneas.entries()) {
    for (const fila of instantanea.estaciones) {
      let serie = series.get(fila[0]);
      if (!serie) {
        serie = nuevaSerie(fila, instantaneas.length);
        series.set(fila[0], serie);
      } else if (serie[1] !== fila[1] || serie[2] !== fila[2]) {
        cambiosTerritoriales += 1;
        // La medición agrupa por ID y conserva el territorio más reciente.
        // El contrato público deberá agregar por el territorio de cada día.
        serie[1] = fila[1];
        serie[2] = fila[2];
      }
      serie[3][indiceDia] = fila[3];
      serie[4][indiceDia] = fila[4];
      serie[5][indiceDia] = fila[5];
      serie[6][indiceDia] = fila[6];
    }
  }

  const ventana: VentanaMedicion = {
    version: 1,
    fechas: instantaneas.map(({ fecha }) => fecha),
    estaciones: [...series.values()].sort((a, b) => a[0].localeCompare(b[0], 'es')),
  };
  const jsonVentana = JSON.stringify(ventana);
  const gzipVentana = gzipSync(jsonVentana, { level: 9 });

  console.log(`Días: ${instantaneas.length}`);
  console.log(`Estaciones distintas: ${series.size}`);
  console.log(`Cambios de provincia o municipio observados: ${cambiosTerritoriales}`);
  console.log(`Instantáneas, JSON: ${bytesLegibles(bytesDiarios)}`);
  console.log(`Instantáneas, suma gzip: ${bytesLegibles(gzipDiarios)}`);
  console.log(`Ventana agrupada, JSON: ${bytesLegibles(Buffer.byteLength(jsonVentana))}`);
  console.log(`Ventana agrupada, gzip: ${bytesLegibles(gzipVentana.byteLength)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
