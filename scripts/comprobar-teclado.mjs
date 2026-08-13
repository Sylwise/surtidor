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

const pulsar = async (context, value) => {
  await comando('input.performActions', {
    context,
    actions: [{ type: 'key', id: 'teclado', actions: [
      { type: 'keyDown', value },
      { type: 'keyUp', value },
    ] }],
  });
  await comando('input.releaseActions', { context });
  await new Promise((resolve) => setTimeout(resolve, 30));
};

const evaluar = async (context, expression) => {
  const respuesta = await comando('script.evaluate', {
    target: { context }, expression, awaitPromise: true,
  });
  return respuesta.result.value;
};

async function comprobar(nombre, url, ancho, selector, panel) {
  const { context } = await comando('browsingContext.create', { type: 'tab' });
  await comando('browsingContext.setViewport', { context, viewport: { width: ancho, height: 844 }, devicePixelRatio: 1 });
  await comando('browsingContext.navigate', { context, url, wait: 'complete' });
  await new Promise((resolve) => setTimeout(resolve, 400));

  const tabulacion = [];
  for (let i = 0; i < 5; i += 1) {
    await pulsar(context, '\uE004');
    tabulacion.push(await evaluar(context, `(()=>{const e=document.activeElement;return e?.id||e?.getAttribute('aria-label')||e?.textContent?.trim().replace(/\\s+/g,' ').slice(0,36)||e?.tagName})()`));
  }

  await evaluar(context, `(()=>document.querySelector(${JSON.stringify(selector)}).focus())()`);
  await pulsar(context, '\uE007');
  const abierto = await evaluar(context, `(()=>{const p=document.querySelector(${JSON.stringify(panel)});return !p.hidden})()`);
  const focoDentro = await evaluar(context, `(()=>{const p=document.querySelector(${JSON.stringify(panel)});return p.contains(document.activeElement)})()`);
  await pulsar(context, '\uE00C');
  const resultado = await evaluar(context, `(()=>{const b=document.querySelector(${JSON.stringify(selector)});const p=document.querySelector(${JSON.stringify(panel)});return JSON.stringify({tabulacion:${JSON.stringify(tabulacion)},abierto:${abierto},focoDentro:${focoDentro},cerrado:p.hidden,focoDevuelto:document.activeElement===b})})()`);
  console.log(`${nombre}: ${resultado}`);
  await comando('browsingContext.close', { context });
}

await comprobar('Principal móvil · zona', 'http://127.0.0.1:4322/asturias/', 390, '#boton-zona', '#panel-zona');
await comprobar('Principal móvil · Hoy', 'http://127.0.0.1:4322/asturias/', 390, '#boton-hoy', '#panel-hoy');
await comprobar('Evolución móvil · explorar', 'http://127.0.0.1:4322/hoy/evolucion/33/', 390, '[data-abrir-explorador]', 'section[data-sheet]');
await comprobar('Artículo móvil · Hoy', 'http://127.0.0.1:4322/hoy/cuanto-te-juegas/', 390, '.boton-hoy', '.panel-hoy');

await comando('session.end', {});
socket.close();
