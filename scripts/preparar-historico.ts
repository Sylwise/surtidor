import { resolve } from 'node:path';

import { avanzarEstadoHistorico, construirEstadoHistorico, type EstadoHistorico } from './lib/estado-historico.ts';
import { escribirJsonCompactoAtomico } from './lib/escritura.ts';
import {
  ErrorPeticionMiteco,
  ErrorResultadoMiteco,
} from './lib/miteco.ts';
import {
  ayerEnMadrid,
  fechasDeVentana,
  obtenerInstantaneaHistorica,
} from './lib/historico.ts';
import { recuperarEstadoDesplegado } from './lib/transporte-historico.ts';

interface Opciones {
  base: string;
  salida: string;
  reconstruir: boolean;
}

function argumentos(valores: string[]): Opciones {
  let base = 'https://surtidor.app/data/historico/';
  let salida = resolve('datos-build/estado-historico.json');
  let reconstruir = false;
  for (let indice = 0; indice < valores.length; indice++) {
    if (valores[indice] === '--base' && valores[indice + 1]) {
      base = valores[++indice]!;
    } else if (valores[indice] === '--salida' && valores[indice + 1]) {
      salida = resolve(valores[++indice]!);
    } else if (valores[indice] === '--reconstruir') {
      reconstruir = true;
    } else {
      throw new Error(`Argumento desconocido o incompleto: ${valores[indice] ?? ''}`);
    }
  }
  return { base, salida, reconstruir };
}

async function reconstruir(fechaFinal: string): Promise<EstadoHistorico> {
  const instantaneas = [];
  for (const fecha of fechasDeVentana(fechaFinal)) {
    console.log(`${fecha}: reconstruyendo…`);
    instantaneas.push(await obtenerInstantaneaHistorica(fecha));
  }
  return construirEstadoHistorico(instantaneas);
}

async function main(): Promise<void> {
  const opciones = argumentos(process.argv.slice(2));
  const ayer = ayerEnMadrid();
  let estado: EstadoHistorico;
  if (opciones.reconstruir) {
    estado = await reconstruir(ayer);
  } else {
    estado = (await recuperarEstadoDesplegado(opciones.base)).estado;
    if (estado.fechas.length !== 90) {
      throw new Error(`El despliegue anterior contiene ${estado.fechas.length} días; se esperaban 90.`);
    }
    const ultima = estado.fechas.at(-1)!;
    if (ultima > ayer) {
      throw new Error(`El histórico desplegado termina en el futuro (${ultima}; ayer es ${ayer}).`);
    }
    const faltantes = fechasDeVentana(ayer).filter((fecha) => fecha > ultima);
    if (faltantes.length > 2) {
      throw new Error(
        `El histórico termina en ${ultima} y faltan ${faltantes.length} días. Usa --reconstruir explícitamente.`,
      );
    }
    for (const fecha of faltantes) {
      try {
        console.log(`${fecha}: incorporando…`);
        estado = avanzarEstadoHistorico(estado, await obtenerInstantaneaHistorica(fecha));
      } catch (error) {
        if (!(error instanceof ErrorPeticionMiteco || error instanceof ErrorResultadoMiteco)) {
          throw error;
        }
        console.warn(
          `${fecha}: todavía no se pudo incorporar; se conserva el estado hasta ${estado.fechas.at(-1)}.`,
        );
        break;
      }
    }
  }
  await escribirJsonCompactoAtomico(opciones.salida, estado);
  console.log(
    `Estado preparado: ${estado.fechas.length} días, ${estado.fechas[0]}–${estado.fechas.at(-1)}, ` +
      `${estado.estaciones.length} estaciones.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
