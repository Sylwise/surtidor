const [base = 'http://127.0.0.1:4173', puerto = '9225'] = process.argv.slice(2);
const socket = new WebSocket(`ws://127.0.0.1:${puerto}/session`);
let siguienteId = 0;
const pendientes = new Map();
const comando = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++siguienteId;
  pendientes.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
socket.addEventListener('message', ({ data }) => {
  const mensaje = JSON.parse(data);
  const pendiente = pendientes.get(mensaje.id);
  if (!pendiente) return;
  pendientes.delete(mensaje.id);
  mensaje.type === 'success' ? pendiente.resolve(mensaje.result) : pendiente.reject(new Error(JSON.stringify(mensaje)));
});
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
await comando('session.new', { capabilities: { alwaysMatch: { browserName: 'firefox' } } });

async function caso(nombre, ruta, preload, expresion, espera = 1400) {
  const { context } = await comando('browsingContext.create', { type: 'tab' });
  if (preload) await comando('script.addPreloadScript', { functionDeclaration: preload, contexts: [context] });
  await comando('browsingContext.setViewport', { context, viewport: { width: 1440, height: 1024 }, devicePixelRatio: 1 });
  await comando('browsingContext.navigate', { context, url: `${base}${ruta}`, wait: 'complete' });
  await new Promise((resolve) => setTimeout(resolve, espera));
  const respuesta = await comando('script.evaluate', { target: { context }, expression: expresion, awaitPromise: true });
  console.log(`${nombre}: ${respuesta.result.value}`);
  await comando('browsingContext.close', { context });
}

await caso(
  'Fallo de mapa',
  '/asturias/',
  `() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(tipo, ...args) { if (String(tipo).includes('webgl')) return null; return original.call(this, tipo, ...args); }; }`,
  `JSON.stringify({fallback:document.querySelector('#mapa')?.textContent?.includes('La lista y la ficha de la izquierda funcionan igual.')??false,filas:document.querySelectorAll('.fila').length})`,
);

await caso(
  'Recuperación de contexto WebGL',
  '/asturias/',
  `() => {
    window.__eventosWebGL = [];
    document.addEventListener('webglcontextlost', () => window.__eventosWebGL.push('perdido'), true);
    document.addEventListener('webglcontextrestored', () => window.__eventosWebGL.push('restaurado'), true);
    const fetchReal = window.fetch.bind(window);
    window.fetch = (entrada, opciones) => {
      const url = entrada instanceof Request ? entrada.url : String(entrada);
      if (url.startsWith('https://tiles.openfreemap.org/styles/positron')) {
        return Promise.resolve(new Response(JSON.stringify({ version: 8, sources: {}, layers: [] }), {
          headers: { 'Content-Type': 'application/json' },
        }));
      }
      return fetchReal(entrada, opciones);
    };
  }`,
  `(async()=>{
    const lienzo = document.querySelector('.maplibregl-canvas');
    const gl = lienzo?.getContext('webgl2') ?? lienzo?.getContext('webgl');
    const extension = gl?.getExtension('WEBGL_lose_context');
    if (!extension) return JSON.stringify({ disponible: false });
    extension.loseContext();
    await new Promise((resolve) => setTimeout(resolve, 300));
    extension.restoreContext();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const contexto = lienzo?.getContext('webgl2') ?? lienzo?.getContext('webgl');
    return JSON.stringify({
      disponible: true,
      eventos: window.__eventosWebGL,
      recuperado: contexto?.isContextLost() === false,
      fallback: document.querySelector('#mapa')?.textContent?.includes('La lista y la ficha de la izquierda funcionan igual.') ?? false,
    });
  })()`,
  1800,
);

await caso(
  'Fallo total de datos',
  '/andalucia/',
  `() => { const original = window.fetch.bind(window); window.fetch = (entrada, opciones) => String(entrada).includes('/data/') ? Promise.resolve(new Response('', { status: 503 })) : original(entrada, opciones); }`,
  `JSON.stringify({aviso:document.querySelector('.aviso--error')?.textContent??null,estadoLista:document.querySelector('#lista')?.textContent?.trim()??null,reintentar:Boolean(document.querySelector('.aviso--error button'))})`,
);

await caso(
  'Combustible sin datos',
  '/melilla/',
  null,
  `(()=>{const botones=[...document.querySelectorAll('.controles__pestana')];botones[2]?.click();return JSON.stringify({activo:botones[2]?.getAttribute('aria-pressed'),mensaje:document.querySelector('#lista')?.textContent?.includes('Ninguna estación de MELILLA vende gasolina 98.')??false})})()`,
  800,
);

await comando('session.end', {});
socket.close();
