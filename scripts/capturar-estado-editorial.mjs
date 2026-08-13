import { writeFile } from 'node:fs/promises';

const [url, anchoTexto, altoTexto, accion, salida, puertoTexto = '9225'] = process.argv.slice(2);
if (!url || !anchoTexto || !altoTexto || !accion || !salida) {
  throw new Error('Uso: node scripts/capturar-estado-editorial.mjs URL ANCHO ALTO ACCION SALIDA [PUERTO]');
}

const socket = new WebSocket(`ws://127.0.0.1:${puertoTexto}` + '/session');
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
try {
  const { context } = await comando('browsingContext.create', { type: 'tab' });
  await comando('browsingContext.setViewport', { context, viewport: { width: Number(anchoTexto), height: Number(altoTexto) }, devicePixelRatio: 1 });
  await comando('browsingContext.navigate', { context, url, wait: 'complete' });
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (accion === 'fiscal') {
    await comando('script.evaluate', { target: { context }, expression: "document.querySelector('[data-abrir-desglose]').click()", awaitPromise: true });
  } else if (accion === 'hoy') {
    await comando('script.evaluate', { target: { context }, expression: "document.querySelector('.boton-hoy').click()", awaitPromise: true });
  } else if (accion.startsWith('combustible:')) {
    const combustible = JSON.stringify(accion.slice('combustible:'.length));
    await comando('script.evaluate', { target: { context }, expression: `document.querySelector('[data-selector-editorial] [data-combustible=' + ${combustible} + ']').click()`, awaitPromise: true });
  } else if (accion !== 'inicial') {
    throw new Error(`Acción desconocida: ${accion}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
  const { data } = await comando('browsingContext.captureScreenshot', { context, origin: 'viewport' });
  await writeFile(salida, Buffer.from(data, 'base64'));
  await comando('browsingContext.close', { context });
} finally {
  await comando('session.end', {});
  socket.close();
}

console.log(`${salida} (${anchoTexto}×${altoTexto}) · ${accion}`);
