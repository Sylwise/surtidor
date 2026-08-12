import { writeFile } from 'node:fs/promises';

const [url, anchoTexto, altoTexto, salida, puertoTexto = '9225'] = process.argv.slice(2);
if (!url || !anchoTexto || !altoTexto || !salida) {
  throw new Error('Uso: node scripts/capturar-viewport.mjs URL ANCHO ALTO SALIDA [PUERTO]');
}

const ancho = Number(anchoTexto);
const alto = Number(altoTexto);
const socket = new WebSocket(`ws://127.0.0.1:${puertoTexto}/session`);
let siguienteId = 0;
const pendientes = new Map();

function comando(method, params = {}) {
  const id = ++siguienteId;
  return new Promise((resolve, reject) => {
    pendientes.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

socket.addEventListener('message', (evento) => {
  const mensaje = JSON.parse(evento.data);
  if (!('id' in mensaje)) return;
  const pendiente = pendientes.get(mensaje.id);
  if (!pendiente) return;
  pendientes.delete(mensaje.id);
  if (mensaje.type === 'success') pendiente.resolve(mensaje.result);
  else pendiente.reject(new Error(JSON.stringify(mensaje)));
});

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

const sesion = await comando('session.new', { capabilities: { alwaysMatch: { browserName: 'firefox' } } });
try {
  const { context } = await comando('browsingContext.create', { type: 'tab' });
  await comando('browsingContext.setViewport', { context, viewport: { width: ancho, height: alto }, devicePixelRatio: 1 });
  await comando('browsingContext.navigate', { context, url, wait: 'complete' });
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const { data } = await comando('browsingContext.captureScreenshot', { context, origin: 'viewport' });
  await writeFile(salida, Buffer.from(data, 'base64'));
  await comando('browsingContext.close', { context });
} finally {
  await comando('session.end', {});
  socket.close();
}

console.log(`${salida} (${ancho}×${alto}) · sesión ${sesion.sessionId}`);
