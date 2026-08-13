import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { formatearFechaHora } from '../src/logica/formato.ts';
import type { Indice } from './lib/tipos.ts';

const raiz = resolve(process.argv[2] ?? '.');
const html = await readFile(resolve(raiz, 'dist/araba-alava/index.html'), 'utf8');
const indice = JSON.parse(await readFile(resolve(raiz, 'public/data/indice.json'), 'utf8')) as Indice;
const panel = html.match(/<nav[^>]+data-panel-hoy[^>]*>[\s\S]*?<\/nav>/)?.[0];
assert.ok(panel, 'El HTML servido debe contener el panel Hoy completo.');
const hrefs = [...panel.matchAll(/<a\s+href="([^"]+)"/g)].map((coincidencia) => coincidencia[1]);
assert.deepEqual(hrefs, [
  '/hoy/provincias-mas-baratas/',
  '/hoy/cuanto-te-juegas/',
  '/hoy/marcas-mas-baratas/',
  '/hoy/capitales-de-provincia/',
  '/hoy/la-mas-barata-de-espana/',
  '/hoy/canarias-ceuta-melilla/',
  '/hoy/evolucion/01/',
  '/como-calculamos-los-datos/',
]);
assert.doesNotMatch(panel, /›|&rsaquo;|&gt;/, 'El panel no debe servir galones decorativos.');
assert.match(panel, /Hoy, en cifras/);
assert.match(panel, /Datos oficiales del Ministerio para la Transición Ecológica y el Reto Demográfico\./);
assert.match(panel, new RegExp(`datetime="${indice.actualizado}"`));
assert.ok(panel.includes(formatearFechaHora(indice.actualizado)), 'La fecha visible debe usar el formateador compartido y el timestamp del dato.');
console.log(`Panel Hoy: 8 href reales, sin galones y actualizado con ${indice.actualizado}.`);
