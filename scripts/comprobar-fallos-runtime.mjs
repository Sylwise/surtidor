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
