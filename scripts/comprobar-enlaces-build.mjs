import { access, readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const directorio = resolve(process.argv[2] ?? 'dist');

async function htmls(ruta) {
  const entradas = await readdir(ruta, { withFileTypes: true });
  const resultados = [];
  for (const entrada of entradas) {
    const destino = join(ruta, entrada.name);
    if (entrada.isDirectory()) resultados.push(...await htmls(destino));
    else if (entrada.name.endsWith('.html')) resultados.push(destino);
  }
  return resultados;
}

function destinoDe(href) {
  const url = new URL(href, 'https://surtidor.local/');
  if (url.origin !== 'https://surtidor.local') return null;
  const pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) return join(directorio, pathname, 'index.html');
  return join(directorio, pathname);
}

const rotos = [];
const archivos = await htmls(directorio);
let enlaces = 0;
for (const archivo of archivos) {
  const contenido = await readFile(archivo, 'utf8');
  for (const coincidencia of contenido.matchAll(/\shref=["']([^"']+)["']/g)) {
    const href = coincidencia[1];
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    const destino = destinoDe(href);
    if (!destino) continue;
    enlaces += 1;
    try {
      await access(destino);
    } catch {
      rotos.push({ archivo: archivo.slice(directorio.length), href });
    }
  }
}

if (rotos.length > 0) {
  console.error(JSON.stringify({ paginas: archivos.length, enlaces, rotos: rotos.slice(0, 30) }, null, 2));
  process.exitCode = 1;
} else {
  console.log(`Enlaces internos válidos: ${enlaces} referencias en ${archivos.length} páginas HTML.`);
}
