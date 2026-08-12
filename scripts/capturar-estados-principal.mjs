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

async function caso(nombre, ancho, alto, expresion) {
  const { context } = await comando('browsingContext.create', { type: 'tab' });
  await comando('browsingContext.setViewport', { context, viewport: { width: ancho, height: alto }, devicePixelRatio: 1 });
  await comando('browsingContext.navigate', { context, url: 'http://127.0.0.1:4322/asturias/', wait: 'complete' });
  await new Promise((resolve) => setTimeout(resolve, 600));
  const resultado = expresion ? await comando('script.evaluate', { target: { context }, expression: expresion, awaitPromise: true }) : null;
  await new Promise((resolve) => setTimeout(resolve, 300));
  const { data } = await comando('browsingContext.captureScreenshot', { context, origin: 'viewport' });
  const salida = `/tmp/fase4-principal-${nombre}.png`;
  await writeFile(salida, Buffer.from(data, 'base64'));
  console.log(`${nombre}: ${resultado?.result?.value ?? 'capturado'} · ${salida}`);
  await comando('browsingContext.close', { context });
}

await caso('seleccion-desktop', 1440, 1024, `(async()=>{document.querySelector('.fila').click();await new Promise(r=>setTimeout(r,250));return JSON.stringify({ficha:!document.querySelector('#totem').classList.contains('totem--vacio'),rail:document.querySelector('.hoja').getBoundingClientRect().width})})()`);
await caso('seleccion-movil', 390, 844, `(async()=>{document.querySelector('.fila').click();await new Promise(r=>setTimeout(r,250));return JSON.stringify({ficha:!document.querySelector('#totem').classList.contains('totem--vacio'),estado:document.querySelector('.hoja').dataset.estado})})()`);
await caso('cambio-estacion', 390, 844, `(async()=>{const filas=[...document.querySelectorAll('.fila')];filas[0].click();await new Promise(r=>setTimeout(r,250));const cuerpo=document.querySelector('.hoja__cuerpo');cuerpo.scrollTop=240;filas[1].click();await new Promise(r=>setTimeout(r,900));return JSON.stringify({scroll:cuerpo.scrollTop,segunda:filas[1].getAttribute('aria-pressed'),ficha:document.querySelector('.totem__rotulo')?.textContent})})()`);
await caso('zona-desktop', 1440, 1024, `(()=>{const b=document.querySelector('#boton-zona');b.focus();b.click();return JSON.stringify({abierto:!document.querySelector('#panel-zona').hidden,foco:document.activeElement?.id})})()`);
await caso('zona-movil', 390, 844, `(()=>{const b=document.querySelector('#boton-zona');b.focus();b.click();return JSON.stringify({abierto:!document.querySelector('#panel-zona').hidden,foco:document.activeElement?.id})})()`);
await caso('hoy-movil', 390, 844, `(()=>{const b=document.querySelector('#boton-hoy');b.focus();b.click();return JSON.stringify({abierto:!document.querySelector('#panel-hoy').hidden,foco:document.activeElement?.getAttribute('href')})})()`);
await caso('overflow-360', 360, 800, `(()=>{const desbordados=[...document.querySelectorAll('body *')].filter(e=>e.clientWidth>0&&e.getClientRects().length>0&&e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflowX==='visible').slice(0,12).map(e=>({clase:typeof e.className==='string'?e.className:e.tagName,client:e.clientWidth,scroll:e.scrollWidth}));return JSON.stringify({documento:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth,desbordados})})()`);

await comando('session.end', {});
socket.close();
