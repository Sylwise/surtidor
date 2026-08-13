import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const RAIZ = process.cwd();
const META = '<meta name="color-scheme" content="only light" />';

async function astrosEn(directorio: string): Promise<string[]> {
  const entradas = await readdir(directorio, { withFileTypes: true });
  const rutas = await Promise.all(entradas.map(async (entrada) => {
    const ruta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) return astrosEn(ruta);
    return entrada.isFile() && entrada.name.endsWith('.astro') ? [ruta] : [];
  }));
  return rutas.flat();
}

test('todas las páginas declaran que solo soportan el esquema claro', async () => {
  const paginas = await astrosEn(path.join(RAIZ, 'src/pages'));
  for (const pagina of paginas) {
    const fuente = await readFile(pagina, 'utf8');
    if (fuente.includes('<html')) {
      assert.ok(fuente.includes(META), `${path.relative(RAIZ, pagina)} no declara color-scheme`);
    } else {
      assert.match(
        fuente,
        /DocumentoEditorial/,
        `${path.relative(RAIZ, pagina)} no usa el documento editorial compartido`,
      );
    }
  }

  const documentoEditorial = await readFile(path.join(RAIZ, 'src/layouts/DocumentoEditorial.astro'), 'utf8');
  assert.ok(documentoEditorial.includes(META));
});

test('CSS protege la paleta global y el canvas del mapa', async () => {
  const tokens = await readFile(path.join(RAIZ, 'src/estilos/tokens.css'), 'utf8');
  const mapa = await readFile(path.join(RAIZ, 'src/estilos/mapa.css'), 'utf8');

  assert.match(tokens, /:root\s*{[\s\S]*?color-scheme:\s*only light;/);
  assert.match(tokens, /::placeholder\s*{[\s\S]*?color:\s*var\(--muted\);[\s\S]*?opacity:\s*1;/);
  assert.match(mapa, /\.maplibregl-canvas[\s\S]*?{\s*color-scheme:\s*only light;/);
});
