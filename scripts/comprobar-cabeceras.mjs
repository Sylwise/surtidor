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

async function comprobar(nombre, url, ancho, expresion) {
  const { context } = await comando('browsingContext.create', { type: 'tab' });
  await comando('browsingContext.setViewport', { context, viewport: { width: ancho, height: 844 }, devicePixelRatio: 1 });
  await comando('browsingContext.navigate', { context, url, wait: 'complete' });
  await new Promise((resolve) => setTimeout(resolve, 500));
  const respuesta = await comando('script.evaluate', { target: { context }, expression: expresion, awaitPromise: true });
  console.log(`${nombre}: ${respuesta.result.value}`);
  await comando('browsingContext.close', { context });
}

const comprobarMenu = `(async()=>{const b=document.querySelector('.boton-hoy');b.click();await new Promise(r=>setTimeout(r,0));const p=document.querySelector('.panel-hoy');const abierto=!p.hidden&&b.getAttribute('aria-expanded')==='true';document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await new Promise(r=>setTimeout(r,0));return JSON.stringify({abierto,cerrado:p.hidden,foco:document.activeElement===b,enlaces:[...p.querySelectorAll('a')].map(a=>a.getAttribute('href')),activo:p.querySelector('[aria-current="page"]')?.getAttribute('href')})})()`;
await comprobar('Principal · zona y Hoy', 'http://127.0.0.1:4322/asturias/', 1440, `(async()=>{const z=document.querySelector('#boton-zona');z.click();const pz=document.querySelector('#panel-zona');const zonaAbierta=!pz.hidden;document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));const zonaFoco=document.activeElement===z;const b=document.querySelector('#boton-hoy');b.click();const p=document.querySelector('#panel-hoy');const hoyAbierto=!p.hidden;document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));const desbordados=[...document.querySelectorAll('.hoja *')].filter(e=>e.scrollWidth>e.clientWidth+1).slice(0,10).map(e=>({clase:e.className,client:e.clientWidth,scroll:e.scrollWidth}));return JSON.stringify({zonaAbierta,zonaCerrada:pz.hidden,zonaFoco,hoyAbierto,hoyCerrado:p.hidden,hoyFoco:document.activeElement===b,desbordados})})()`);
await comprobar('Evolución desktop · Hoy', 'http://127.0.0.1:4322/hoy/evolucion/33/', 1440, comprobarMenu);
await comprobar('Evolución móvil · explorar', 'http://127.0.0.1:4322/hoy/evolucion/33/', 390, `(async()=>{const b=document.querySelector('[data-abrir-explorador]');b.focus();b.click();await new Promise(r=>setTimeout(r,20));const p=document.querySelector('section[data-sheet]');const abierto=!p.hidden;p.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await new Promise(r=>setTimeout(r,20));const escape={cerrado:p.hidden,foco:document.activeElement===b};b.click();await new Promise(r=>setTimeout(r,20));p.querySelector('[data-cerrar-sheet]').click();await new Promise(r=>setTimeout(r,20));return JSON.stringify({abierto,escape,botonCerrar:{cerrado:p.hidden,foco:document.activeElement===b}})})()`);
await comprobar('Artículo · Hoy', 'http://127.0.0.1:4322/hoy/cuanto-te-juegas/', 390, comprobarMenu);
await comprobar('Artículo · progresión de combustibles', 'http://127.0.0.1:4322/hoy/cuanto-te-juegas/', 1440, `(async()=>{const enlaces=[...document.querySelectorAll('.editorial-indice [data-selector-combustible]')];enlaces.find(a=>a.hash==='#gasoleoA').click();await new Promise(r=>setTimeout(r,20));const visibles=[...document.querySelectorAll('[data-panel-combustible]')].filter(p=>!p.hidden);const activo=document.querySelector('.editorial-indice [aria-current="true"]');const metodo=document.querySelector('.editorial-detalles--metodo');metodo.querySelector('summary').click();return JSON.stringify({visibles:visibles.map(p=>p.id),activo:activo?.hash,hash:location.hash,metodoAbierto:metodo.open})})()`);
await comando('session.end', {});
socket.close();
