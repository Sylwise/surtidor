// Escritura atómica de JSON: a fichero temporal y luego renombrar, para que
// un fallo a media escritura nunca deje un fichero corrupto o a medias
// (RF-05, docs/06-roadmap.md#H5).

import { writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function escribirJsonAtomico(ruta: string, datos: unknown): Promise<void> {
  await mkdir(dirname(ruta), { recursive: true });
  const rutaTemporal = `${ruta}.tmp-${process.pid}`;
  await writeFile(rutaTemporal, JSON.stringify(datos, null, 2) + '\n', 'utf-8');
  await rename(rutaTemporal, ruta);
}
