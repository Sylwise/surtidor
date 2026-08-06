// RNF-43 · Guarda antes del build: los datos de prueba (`npm run data:mock`)
// y los reales (`npm run data:fetch`) escriben en la misma ruta,
// `public/data/`, y solo se distinguen por un campo dentro del JSON
// (`"mock": true`). Sin esta comprobación es posible construir y desplegar
// precios inventados a producción sin que nada lo impida.
//
// Se ejecuta antes de `astro build` (ver "build" en package.json) y también
// como paso propio en .github/workflows/datos.yml, para que ni un build local
// ni un despliegue en CI puedan saltársela.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIRECTORIO_DATOS = join(import.meta.dirname, '..', 'public', 'data');

interface FicheroConMock {
  mock?: boolean;
}

async function ficherosJson(directorio: string): Promise<string[]> {
  const entradas = await readdir(directorio, { withFileTypes: true, recursive: true });
  return entradas
    .filter((entrada) => entrada.isFile() && entrada.name.endsWith('.json'))
    .map((entrada) => join(entrada.parentPath, entrada.name));
}

async function main(): Promise<void> {
  let ficheros: string[];
  try {
    ficheros = await ficherosJson(DIRECTORIO_DATOS);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      console.error(
        `No existe ${DIRECTORIO_DATOS}. Ejecuta "npm run data:fetch" (o "npm run data:mock" en desarrollo) antes de construir.`,
      );
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  const conMock: string[] = [];
  for (const fichero of ficheros) {
    const contenido = JSON.parse(await readFile(fichero, 'utf-8')) as FicheroConMock;
    if (contenido.mock === true) conMock.push(fichero);
  }

  if (conMock.length > 0) {
    console.error(
      `RNF-43: ${conMock.length} de ${ficheros.length} ficheros de public/data/ llevan "mock": true. ` +
        'No se puede construir con datos de prueba. Ejecuta "npm run data:fetch" para regenerarlos con datos reales.',
    );
    for (const fichero of conMock) console.error(`  ${fichero}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Comprobados ${ficheros.length} ficheros de public/data/: ninguno es de prueba.`);
}

main().catch((error: unknown) => {
  console.error('La comprobación de datos de prueba ha fallado.');
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
