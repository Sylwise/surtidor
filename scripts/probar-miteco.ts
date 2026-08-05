// Script suelto de verificación manual — no forma parte de `npm test` (no
// termina en .test.ts) ni de la generación de datos real (eso es H5,
// scripts/descargar-datos.ts). Descarga Álava (01) contra la API real del
// MITECO y escupe por consola el número de estaciones, tal como pide el
// criterio de "terminado" del hito H2 en docs/06-roadmap.md.
//
// Uso: node --experimental-strip-types scripts/probar-miteco.ts

import { obtenerEstacionesPorProvincia } from './lib/miteco.ts';

const idAlava = '01';

const respuesta = await obtenerEstacionesPorProvincia(idAlava);

console.log(`Álava (${idAlava}): ${respuesta.ListaEESSPrecio.length} estaciones.`);
console.log(`Fecha declarada por el MITECO: ${respuesta.Fecha}`);
