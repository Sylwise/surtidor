import { readdir, stat, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { escribirJsonAtomico } from './lib/escritura.ts';
import {
  ayerEnMadrid,
  DIAS_HISTORICO,
  fechasDeVentana,
  obtenerInstantaneaHistorica,
} from './lib/historico.ts';

interface OpcionesCli {
  fechaFinal: string;
  dias: number;
  directorio: string;
}

function leerArgumentos(argumentos: string[]): OpcionesCli {
  let fechaFinal = ayerEnMadrid();
  let dias = 1;
  let directorio = resolve('datos-historicos');

  for (let indice = 0; indice < argumentos.length; indice++) {
    const argumento = argumentos[indice];
    const valor = argumentos[indice + 1];
    if (argumento === '--hasta' && valor) {
      fechaFinal = valor;
      indice += 1;
    } else if (argumento === '--dias' && valor) {
      dias = Number(valor);
      indice += 1;
    } else if (argumento === '--directorio' && valor) {
      directorio = resolve(valor);
      indice += 1;
    } else {
      throw new Error(`Argumento desconocido o incompleto: ${argumento ?? ''}`);
    }
  }

  if (!Number.isInteger(dias) || dias < 1 || dias > DIAS_HISTORICO) {
    throw new Error(`--dias debe ser un entero entre 1 y ${DIAS_HISTORICO}.`);
  }
  fechasDeVentana(fechaFinal, 1);
  return { fechaFinal, dias, directorio };
}

async function existe(ruta: string): Promise<boolean> {
  try {
    return (await stat(ruta)).isFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function rotarVentana(directorio: string, fechasConservadas: Set<string>): Promise<number> {
  let entradas: string[];
  try {
    entradas = await readdir(directorio);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw error;
  }

  const antiguas = entradas.filter(
    (nombre) => /^\d{4}-\d{2}-\d{2}\.json$/.test(nombre) && !fechasConservadas.has(nombre.slice(0, 10)),
  );
  await Promise.all(antiguas.map((nombre) => unlink(join(directorio, nombre))));
  return antiguas.length;
}

async function main(): Promise<void> {
  const opciones = leerArgumentos(process.argv.slice(2));
  const fechasSolicitadas = fechasDeVentana(opciones.fechaFinal, opciones.dias);
  const ventanaCompleta = new Set(fechasDeVentana(opciones.fechaFinal, DIAS_HISTORICO));
  let descargadas = 0;
  let reutilizadas = 0;

  for (const fecha of fechasSolicitadas) {
    const ruta = join(opciones.directorio, `${fecha}.json`);
    if (await existe(ruta)) {
      reutilizadas += 1;
      console.log(`${fecha}: ya existe`);
      continue;
    }

    console.log(`${fecha}: descargando…`);
    const instantanea = await obtenerInstantaneaHistorica(fecha);
    await escribirJsonAtomico(ruta, instantanea);
    descargadas += 1;
    console.log(`${fecha}: ${instantanea.estaciones.length} estaciones públicas`);
  }

  // Solo se rota después de que todas las descargas solicitadas terminen bien.
  const retiradas = await rotarVentana(opciones.directorio, ventanaCompleta);
  console.log(
    `Hecho: ${descargadas} descargadas, ${reutilizadas} reutilizadas, ${retiradas} retiradas; ` +
      `ventana objetivo ${ventanaCompleta.size} días hasta ${opciones.fechaFinal}.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
