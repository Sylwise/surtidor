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

async function evaluar(context, expression) {
  const respuesta = await comando('script.evaluate', { target: { context }, expression, awaitPromise: true });
  return respuesta.result.value;
}

async function comprobar(ruta, ancho) {
  const { context } = await comando('browsingContext.create', { type: 'tab' });
  await comando('browsingContext.setViewport', { context, viewport: { width: ancho, height: 1204 }, devicePixelRatio: 1 });
  await comando('browsingContext.navigate', { context, url: `${base}${ruta}`, wait: 'complete' });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const combustible = await evaluar(context, `(()=>{const botones=[...document.querySelectorAll('[data-selector-editorial] button')];botones[1].click();const panel=document.querySelector('[data-panel-combustible="gasoleoA"]');const detalle=panel.querySelector('.editorial-detalles--ranking');if(detalle)detalle.querySelector('summary').click();const expandido=detalle?.open??false;if(detalle)detalle.querySelector('summary').click();return JSON.stringify({activo:botones[1].getAttribute('aria-pressed'),visible:!panel.hidden,filas:panel.querySelectorAll('tbody tr').length,rankingExpandido:expandido,rankingCerrado:detalle?!detalle.open:true,anchoDocumento:document.documentElement.scrollWidth,anchoViewport:document.documentElement.clientWidth})})()`);
  let fiscal = null;
  if (ruta.includes('marcas')) {
    fiscal = await evaluar(context, `(async()=>{const boton=document.querySelector('[data-panel-combustible="gasoleoA"] [data-abrir-desglose]');boton.click();await new Promise(r=>setTimeout(r,20));const contenido=document.getElementById(boton.getAttribute('aria-controls'));const abierto={expandido:boton.getAttribute('aria-expanded'),oculto:contenido.hidden,display:getComputedStyle(contenido).display,scrollY,alto:document.documentElement.scrollHeight};document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await new Promise(r=>setTimeout(r,20));return JSON.stringify({abierto,cerrado:contenido.hidden,foco:document.activeElement===boton})})()`);
  } else if (ancho <= 700) {
    fiscal = await evaluar(context, `(()=>{const detalle=document.querySelector('[data-panel-combustible="gasoleoA"] .editorial-fiscal-movil');detalle.querySelector('summary').click();const abierto=detalle.open;const filas=detalle.querySelectorAll('tbody tr').length;detalle.querySelector('summary').click();return JSON.stringify({abierto,filas,cerrado:!detalle.open})})()`);
  }
  console.log(`${ruta} · ${ancho}: ${JSON.stringify({ combustible: JSON.parse(combustible), fiscal: fiscal ? JSON.parse(fiscal) : null })}`);
  await comando('browsingContext.close', { context });
}

await comprobar('/hoy/provincias-mas-baratas/', 390);
await comprobar('/hoy/capitales-de-provincia/', 390);
await comprobar('/hoy/la-mas-barata-de-espana/', 390);
await comprobar('/hoy/marcas-mas-baratas/', 1440);
await comprobar('/hoy/marcas-mas-baratas/', 390);
await comprobar('/hoy/provincias-mas-baratas/', 360);
await comprobar('/hoy/capitales-de-provincia/', 360);
await comprobar('/hoy/la-mas-barata-de-espana/', 360);
await comando('session.end', {});
socket.close();
