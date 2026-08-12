import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

import { construirHistoricosProvincia } from './lib/artefactos-historicos.ts';
import { comprobarVentanaCompleta, construirEstadoHistorico, parsearEstadoHistorico } from './lib/estado-historico.ts';
import {
  escribirBufferAtomico,
  escribirJsonCompactoAtomico,
} from './lib/escritura.ts';
import { parsearInstantaneaHistorica, type InstantaneaHistorica } from './lib/historico.ts';
import type { ManifiestoHistorico } from './lib/transporte-historico.ts';

async function leerInstantaneas(directorio: string): Promise<InstantaneaHistorica[]> {
  const nombres = (await readdir(directorio))
    .filter((nombre) => /^\d{4}-\d{2}-\d{2}\.json$/.test(nombre))
    .sort();
  return Promise.all(
    nombres.map(async (nombre) => {
      const valor: unknown = JSON.parse(await readFile(join(directorio, nombre), 'utf8'));
      const instantanea = parsearInstantaneaHistorica(valor);
      if (instantanea.fecha !== nombre.slice(0, 10)) {
        throw new Error(`${nombre}: la fecha interior no coincide (${instantanea.fecha}).`);
      }
      return instantanea;
    }),
  );
}

function bytesLegibles(bytes: number): string {
  return new Intl.NumberFormat('es-ES').format(bytes) + ' B';
}

async function main(): Promise<void> {
  const directorioEntrada = resolve(process.argv[2] ?? 'datos-historicos');
  const directorioSalida = resolve(process.argv[3] ?? 'public/data/historico');
  const entrada = await stat(directorioEntrada);
  const estado = entrada.isFile()
    ? parsearEstadoHistorico(JSON.parse(await readFile(directorioEntrada, 'utf8')) as unknown)
    : construirEstadoHistorico(await leerInstantaneas(directorioEntrada));

  // Este es el punto de publicación real: nada por debajo de esta línea debe
  // poder escribir un estado a medias.
  comprobarVentanaCompleta(estado);

  const provincias = construirHistoricosProvincia(estado);

  const estadoJson = JSON.stringify(estado);
  const estadoGzip = gzipSync(estadoJson, { level: 9 });
  const nombreEstado = 'estado.json.gz';
  await escribirBufferAtomico(join(directorioSalida, nombreEstado), estadoGzip);

  let mayorProvincia = { id: '', bytes: 0, gzip: 0 };
  for (const [provinciaId, historico] of provincias) {
    const json = JSON.stringify(historico);
    const gzip = gzipSync(json, { level: 9 }).byteLength;
    if (gzip > mayorProvincia.gzip) {
      mayorProvincia = { id: provinciaId, bytes: Buffer.byteLength(json), gzip };
    }
    await escribirJsonCompactoAtomico(join(directorioSalida, 'provincias', `${provinciaId}.json`), historico);
  }

  const manifiesto: ManifiestoHistorico = {
    version: 1,
    desde: estado.fechas[0]!,
    hasta: estado.fechas.at(-1)!,
    dias: estado.fechas.length,
    estaciones: estado.estaciones.length,
    estado: nombreEstado,
    sha256: createHash('sha256').update(estadoGzip).digest('hex'),
    ...(estado.mock ? { mock: true as const } : {}),
  };
  await escribirJsonCompactoAtomico(join(directorioSalida, 'manifiesto.json'), manifiesto);

  console.log(`Estado nacional JSON: ${bytesLegibles(Buffer.byteLength(estadoJson))}`);
  console.log(`Estado nacional gzip: ${bytesLegibles(estadoGzip.byteLength)}`);
  console.log(`Provincias: ${provincias.size}`);
  console.log(
    `Mayor provincia: ${mayorProvincia.id}, ${bytesLegibles(mayorProvincia.bytes)} JSON, ` +
      `${bytesLegibles(mayorProvincia.gzip)} gzip`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
