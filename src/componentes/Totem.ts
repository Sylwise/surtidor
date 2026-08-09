// Ficha de la estación seleccionada: rótulo, dirección, municipio, lado de
// la carretera (RF-29), horario, cómo llegar (RF-27, RF-28), los cuatro
// combustibles (RF-22, RF-23), puesto dentro de la zona (RF-24), el bloque
// de ahorro (RF-25) y los litros a repostar (RF-33). Ver la sección
// "Tótem" y "Móvil" de docs/05-diseno.md.
//
// Los litros a repostar viven aquí y no en la cabecera: es una preferencia
// que se ajusta una vez y solo significa algo junto al cálculo de ahorro. El
// DOM se construye una sola vez y se actualiza en cada render (mismo patrón
// que Controles.ts) en vez de reconstruirse con innerHTML: si no, cada tecla
// en el estepador dispararía un cambio de estado que reconstruye la ficha
// entera y le hace perder el foco a mitad de escribir.

import { actualizarEstado, obtenerEstado, suscribir, type EstadoApp } from '../logica/estado.ts';
import { crearEscala, ordenarPorPrecio, preciosDeCombustible } from '../logica/escala.ts';
import { calcularAhorro } from '../logica/ahorro.ts';
import { ETIQUETA, ORDEN_COMBUSTIBLES } from '../logica/combustibles.ts';
import { cajaDeTitulo, formatearEuros, formatearPrecio } from '../logica/formato.ts';
import { enlaceAppleMaps, enlacePrincipal, enlaceWaze } from '../logica/llegar.ts';
import { crearIconoMargen, ETIQUETA_MARGEN } from '../logica/margen.ts';
import { estacionesVisibles } from '../logica/visibilidad.ts';
import { estaAbierta } from '../../scripts/lib/horario.ts';
import type { ClavePrecio } from '../../scripts/lib/tipos.ts';

const PASO_LITROS = 5;

/** Monta la ficha en `contenedor` y la mantiene sincronizada con el estado.
 *  Devuelve una función para desuscribirse. */
export function montarTotem(contenedor: HTMLElement): () => void {
  // Sin estación, el tótem se vuelve un aviso compacto (docs/05-diseno.md):
  // sin esto reserva su cromo completo (padding, borde de --signal) aunque
  // no tenga nada que decir, y ese espacio nunca vuelve a la lista.
  const vacio = document.createElement('p');
  vacio.className = 'totem__vacio';
  vacio.textContent = 'Toca una estación de la lista para ver su ficha.';

  const lleno = document.createElement('div');
  lleno.className = 'totem__lleno';

  const rotulo = document.createElement('h2');
  rotulo.className = 'totem__rotulo';

  // RF-83: una de las tres formas de cerrar la ficha (las otras dos son
  // tocar el mapa y arrastrar la hoja hacia abajo, ver Mapa.ts y Hoja.ts).
  const botonCerrar = document.createElement('button');
  botonCerrar.type = 'button';
  botonCerrar.className = 'boton-cerrar boton-cerrar--oscuro totem__cerrar';
  botonCerrar.setAttribute('aria-label', 'Cerrar ficha de la estación');
  botonCerrar.textContent = '✕';
  botonCerrar.addEventListener('click', () => actualizarEstado({ estacionId: null }));

  const cabeceraFicha = document.createElement('div');
  cabeceraFicha.className = 'totem__cabecera';
  cabeceraFicha.append(rotulo, botonCerrar);

  const direccion = document.createElement('p');
  direccion.className = 'totem__direccion';

  // --- Lado de la carretera, a partir de Margen (RF-29) ---
  const filaMargen = document.createElement('p');
  filaMargen.className = 'totem__margen';
  const iconoMargen = document.createElement('span');
  iconoMargen.className = 'totem__margen-icono';
  const textoMargen = document.createElement('span');
  filaMargen.append(iconoMargen, textoMargen);

  const horario = document.createElement('p');
  horario.className = 'totem__horario';

  // --- Cómo llegar (RF-27, RF-28) ---
  const llegar = document.createElement('div');
  llegar.className = 'totem__llegar';

  const botonLlegar = document.createElement('a');
  botonLlegar.className = 'totem__llegar-boton';
  botonLlegar.target = '_blank';
  botonLlegar.rel = 'noopener noreferrer';
  botonLlegar.textContent = 'Cómo llegar';

  const secundarios = document.createElement('div');
  secundarios.className = 'totem__llegar-secundarios';

  const enlaceWazeEl = document.createElement('a');
  enlaceWazeEl.className = 'totem__llegar-secundario';
  enlaceWazeEl.target = '_blank';
  enlaceWazeEl.rel = 'noopener noreferrer';
  enlaceWazeEl.textContent = 'Waze';

  const enlaceAppleEl = document.createElement('a');
  enlaceAppleEl.className = 'totem__llegar-secundario';
  enlaceAppleEl.target = '_blank';
  enlaceAppleEl.rel = 'noopener noreferrer';
  enlaceAppleEl.textContent = 'Apple Maps';

  secundarios.append(enlaceWazeEl, enlaceAppleEl);
  llegar.append(botonLlegar, secundarios);

  // RF-81: con la ficha abierta, las cuatro filas son el selector de
  // combustible (las pestañas de Controles.ts están ocultas, RF-80). Cada
  // fila es un botón de 44 px mínimo, no el <li> entero, para no atrapar
  // toques fuera de su área real.
  const combustibles = document.createElement('ul');
  combustibles.className = 'totem__combustibles';
  const filasCombustible = new Map<
    ClavePrecio,
    { fila: HTMLLIElement; boton: HTMLButtonElement; valor: HTMLSpanElement }
  >();
  for (const clave of ORDEN_COMBUSTIBLES) {
    const fila = document.createElement('li');
    fila.className = 'totem__fila-combustible';

    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'totem__fila-combustible-boton';

    const etiqueta = document.createElement('span');
    etiqueta.className = 'totem__etiqueta-combustible';
    etiqueta.textContent = ETIQUETA[clave];

    const valor = document.createElement('span');
    valor.className = 'totem__precio';

    boton.append(etiqueta, valor);
    boton.addEventListener('click', () => actualizarEstado({ combustible: clave }));
    fila.append(boton);
    combustibles.append(fila);
    filasCombustible.set(clave, { fila, boton, valor });
  }

  const puesto = document.createElement('p');
  puesto.className = 'totem__puesto';

  const ahorro = document.createElement('div');
  ahorro.className = 'totem__ahorro';
  const ahorroCifra = document.createElement('p');
  ahorroCifra.className = 'totem__ahorro-cifra';
  const ahorroTexto = document.createElement('p');
  ahorroTexto.className = 'totem__ahorro-texto';

  // --- Litros a repostar, 20 L por defecto: estepador a medida (RF-33) ---
  // Se mantiene `type="number"` (teclado numérico, validación nativa) pero
  // se ocultan las flechas del navegador por CSS y se sustituyen por dos
  // botones propios que llaman a stepUp()/stepDown(), reutilizando el mismo
  // evento `input` que ya dispara la actualización de estado.
  const grupoLitros = document.createElement('div');
  grupoLitros.className = 'totem__litros';

  const etiquetaLitros = document.createElement('span');
  etiquetaLitros.className = 'micro totem__litros-etiqueta';
  etiquetaLitros.textContent = 'Litros a repostar';

  const campoLitros = document.createElement('div');
  campoLitros.className = 'litros';

  const inputLitros = document.createElement('input');
  inputLitros.type = 'number';
  inputLitros.min = '1';
  inputLitros.max = '300';
  inputLitros.step = String(PASO_LITROS);
  inputLitros.inputMode = 'numeric';
  inputLitros.className = 'litros__input';
  inputLitros.setAttribute('aria-label', 'Litros a repostar');

  function emitirCambioLitros(): void {
    const litros = Number(inputLitros.value);
    if (Number.isFinite(litros) && litros > 0) {
      actualizarEstado({ litros });
    }
  }
  inputLitros.addEventListener('input', emitirCambioLitros);

  const botonMenos = document.createElement('button');
  botonMenos.type = 'button';
  botonMenos.className = 'litros__paso';
  botonMenos.setAttribute('aria-label', `Restar ${PASO_LITROS} litros`);
  botonMenos.textContent = '−';
  botonMenos.addEventListener('click', () => {
    inputLitros.stepDown();
    emitirCambioLitros();
  });

  const botonMas = document.createElement('button');
  botonMas.type = 'button';
  botonMas.className = 'litros__paso';
  botonMas.setAttribute('aria-label', `Sumar ${PASO_LITROS} litros`);
  botonMas.textContent = '+';
  botonMas.addEventListener('click', () => {
    inputLitros.stepUp();
    emitirCambioLitros();
  });

  // El número va en su propia celda, con un solo borde que la separa de los
  // botones −/+ a los lados. Sin sufijo "L": la etiqueta de arriba ya dice
  // "Litros a repostar", y repetirlo en cada cifra no aporta nada.
  const campoNumero = document.createElement('div');
  campoNumero.className = 'litros__campo';
  campoNumero.append(inputLitros);

  campoLitros.append(botonMenos, campoNumero, botonMas);
  grupoLitros.append(etiquetaLitros, campoLitros);

  lleno.append(cabeceraFicha, direccion, filaMargen, horario, llegar, combustibles, puesto, ahorro, grupoLitros);
  contenedor.append(vacio, lleno);

  function render(estado: EstadoApp): void {
    // RF-48: la ficha respeta el mismo filtro que la lista y el mapa.
    const visiblesTipoVenta = estacionesVisibles(estado.estaciones);
    const estacion = visiblesTipoVenta.find((e) => e.id === estado.estacionId) ?? null;

    contenedor.classList.toggle('totem--vacio', !estacion);
    vacio.hidden = Boolean(estacion);
    lleno.hidden = !estacion;

    // Los litros se actualizan pase lo que pase, esté o no la ficha llena:
    // si el usuario acaba de deseleccionar la estación a mitad de escribir
    // un valor, no queremos perder ese cambio.
    if (document.activeElement !== inputLitros) {
      inputLitros.value = String(estado.litros);
    }

    if (!estacion) return;

    const multiProvincia = new Set(visiblesTipoVenta.map((e) => e.provinciaId)).size > 1;

    // RF-86: el rótulo es el cartel de la gasolinera y se muestra verbatim;
    // dirección y municipio son prosa y se pasan a caja de título; la
    // provincia, verbatim (RF-76).
    rotulo.textContent = estacion.rotulo;

    const direccionLegible = `${cajaDeTitulo(estacion.direccion)}, ${cajaDeTitulo(estacion.municipio)}`;
    direccion.textContent = multiProvincia
      ? `${direccionLegible} (${estacion.provinciaNombre})`
      : direccionLegible;

    // RF-87: con `N` no hay lado que decir en una vía de doble sentido, así
    // que la fila entera desaparece, igual que con el campo ausente.
    if (estacion.margen === null || estacion.margen === 'N') {
      filaMargen.hidden = true;
    } else {
      filaMargen.hidden = false;
      iconoMargen.replaceChildren(crearIconoMargen(estacion.margen));
      textoMargen.textContent = ETIQUETA_MARGEN[estacion.margen];
    }

    const abierta = estaAbierta(estacion.horario, new Date());
    const textoHorario = estacion.horario.trim() ? estacion.horario : 'Horario no declarado';
    horario.textContent = `${textoHorario} · ${abierta ? 'Abierta ahora' : 'Cerrada ahora'}`;

    const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
    botonLlegar.href = enlacePrincipal(estacion.lat, estacion.lon, estacion.rotulo, userAgent);
    enlaceWazeEl.href = enlaceWaze(estacion.lat, estacion.lon);
    enlaceAppleEl.href = enlaceAppleMaps(estacion.lat, estacion.lon);

    for (const clave of ORDEN_COMBUSTIBLES) {
      const entrada = filasCombustible.get(clave);
      if (!entrada) continue;
      const activo = clave === estado.combustible;
      entrada.fila.classList.toggle('totem__fila-combustible--activa', activo);
      entrada.boton.setAttribute('aria-pressed', String(activo));

      const precio = estacion.precios[clave];
      // RF-23: lo que no se vende dice "no vende", nunca 0 ni vacío. RF-81:
      // tampoco es pulsable — activarlo haría desaparecer esta misma
      // estación de la lista al instante, al pasar a un combustible que no
      // vende.
      if (precio === null) {
        entrada.valor.className = 'totem__precio totem__precio--ausente';
        entrada.valor.textContent = 'no vende';
        entrada.boton.disabled = true;
      } else {
        entrada.valor.className = 'totem__precio';
        entrada.valor.textContent = formatearPrecio(precio);
        entrada.boton.disabled = false;
      }
    }

    const precioActivo = estacion.precios[estado.combustible];
    if (precioActivo === null) {
      puesto.textContent = `Esta estación no vende ${ETIQUETA[estado.combustible].toLowerCase()}: no se puede calcular su puesto ni el ahorro.`;
      ahorro.replaceChildren();
      return;
    }

    const ordenadas = ordenarPorPrecio(visiblesTipoVenta, estado.combustible);
    const posicion = ordenadas.indexOf(estacion) + 1;
    const sufijoLugar = multiProvincia ? ` · ${estacion.provinciaNombre}` : '';
    puesto.textContent = `${posicion}º de ${ordenadas.length} en ${estado.zonaNombre || 'la zona'}${sufijoLugar}.`;

    const escala = crearEscala(preciosDeCombustible(visiblesTipoVenta, estado.combustible));
    if (escala.maximo === null) {
      ahorro.replaceChildren();
      return;
    }

    const euros = calcularAhorro(precioActivo, escala.maximo, estado.litros);
    if (euros <= 0) {
      ahorroCifra.textContent = formatearEuros(0);
      ahorroTexto.textContent = 'Ya es de las más baratas de la zona con este combustible.';
    } else {
      ahorroCifra.textContent = formatearEuros(euros);
      ahorroTexto.textContent = `de ahorro repostando aquí en vez de en la más cara de la zona, con ${estado.litros} L.`;
    }
    ahorro.replaceChildren(ahorroCifra, ahorroTexto);
  }

  render(obtenerEstado());
  return suscribir(render);
}
