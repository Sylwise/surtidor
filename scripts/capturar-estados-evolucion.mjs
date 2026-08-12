import { writeFile } from 'node:fs/promises';

const socket = new WebSocket('ws://127.0.0.1:9225/session');
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

async function capturar(nombre, url, ancho, alto, expresion) {
  const { context } = await comando('browsingContext.create', { type: 'tab' });
  await comando('browsingContext.setViewport', { context, viewport: { width: ancho, height: alto }, devicePixelRatio: 1 });
  await comando('browsingContext.navigate', { context, url, wait: 'complete' });
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (expresion) await comando('script.evaluate', { target: { context }, expression: expresion, awaitPromise: true });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const estado = await comando('script.evaluate', { target: { context }, expression: `JSON.stringify({resumen:!document.querySelector('.evolucion-resumen')?.hidden,hitos:!document.querySelector('.evolucion-hitos')?.hidden,comparacion:!document.querySelector('[data-comparacion-estacion]')?.hidden,vacio:!document.querySelector('[data-evolucion-vacio]')?.hidden,grafico:!document.querySelector('.evolucion-grafico-card')?.hidden,sheet:!document.querySelector('section[data-sheet]')?.hidden,tooltip:!document.querySelector('[data-tooltip]')?.hidden})`, awaitPromise: false });
  const { data } = await comando('browsingContext.captureScreenshot', { context, origin: 'viewport' });
  const salida = `/tmp/fase2-evolucion-${nombre}.png`;
  await writeFile(salida, Buffer.from(data, 'base64'));
  console.log(`${nombre}: ${estado.result.value} · ${salida}`);
  await comando('browsingContext.close', { context });
}

await capturar('sin-bajadas', 'http://127.0.0.1:4322/hoy/evolucion/33/', 1440, 1024);
await capturar('estacion', 'http://127.0.0.1:4322/hoy/evolucion/33/?estacion=938', 1440, 1024);
await capturar('sin-combustible', 'http://127.0.0.1:4322/hoy/evolucion/33/?estacion=938', 1440, 1024, `(async()=>{[...document.querySelectorAll('[data-clave="gasolina98e5"]')].find(b=>b.offsetParent)?.click();await new Promise(r=>setTimeout(r,20))})()`);
await capturar('sin-historico', 'http://127.0.0.1:4322/hoy/evolucion/06/?estacion=16427', 1440, 1024, `(async()=>{[...document.querySelectorAll('[data-clave="gasolina98e5"]')].find(b=>b.offsetParent)?.click();await new Promise(r=>setTimeout(r,20))})()`);
await capturar('busqueda', 'http://127.0.0.1:4322/hoy/evolucion/33/', 1440, 1024, `(()=>{const i=document.querySelector('[data-buscar-estacion]');i.value='cristaleria';i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
await capturar('ver-todas', 'http://127.0.0.1:4322/hoy/evolucion/33/', 390, 844, `(()=>document.querySelector('[data-abrir-todas]').click())()`);
await capturar('tooltip', 'http://127.0.0.1:4322/hoy/evolucion/33/', 1440, 1024, `(()=>{const s=document.querySelector('.evolucion-grafico');const r=s.getBoundingClientRect();s.dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+r.width*.72,clientY:r.top+r.height*.48,bubbles:true}))})()`);

await comando('session.end', {});
socket.close();
