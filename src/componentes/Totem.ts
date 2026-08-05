// Ficha de la estación seleccionada: rótulo, dirección, municipio, horario,
// los cuatro combustibles (RF-22, RF-23), puesto dentro de la zona (RF-24),
// el bloque de ahorro (RF-25) y el depósito (RF-33). Ver la sección "Tótem"
// y "Móvil" de docs/05-diseno.md.
//
// El depósito vive aquí y no en la cabecera: es una preferencia que se
// ajusta una vez y solo significa algo junto al cálculo de ahorro. El DOM
// se construye una sola vez y se actualiza en cada render (mismo patrón que
// Controles.ts) en vez de reconstruirse con innerHTML: si no, cada tecla en
// el estepador dispararía un cambio de estado que reconstruye la ficha
// entera y le hace perder el foco a mitad de escribir.

import { actualizarEstado, obtenerEstado, suscribir, type EstadoApp } from '../logica/estado.ts';
import { crearEscala, ordenarPorPrecio, preciosDeCombustible } from '../logica/escala.ts';
import { calcularAhorro } from '../logica/ahorro.ts';
import { ETIQUETA, ORDEN_COMBUSTIBLES } from '../logica/combustibles.ts';
import { formatearEuros, formatearPrecio } from '../logica/formato.ts';
import { estaAbierta } from '../../scripts/lib/horario.ts';
import type { ClavePrecio } from '../../scripts/lib/tipos.ts';

const PASO_DEPOSITO = 5;

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

  const direccion = document.createElement('p');
  direccion.className = 'totem__direccion';

  const horario = document.createElement('p');
  horario.className = 'totem__horario';

  const combustibles = document.createElement('ul');
  combustibles.className = 'totem__combustibles';
  const filasCombustible = new Map<ClavePrecio, { fila: HTMLLIElement; valor: HTMLSpanElement }>();
  for (const clave of ORDEN_COMBUSTIBLES) {
    const fila = document.createElement('li');
    fila.className = 'totem__fila-combustible';

    const etiqueta = document.createElement('span');
    etiqueta.className = 'totem__etiqueta-combustible';
    etiqueta.textContent = ETIQUETA[clave];

    const valor = document.createElement('span');
    valor.className = 'totem__precio';

    fila.append(etiqueta, valor);
    combustibles.append(fila);
    filasCombustible.set(clave, { fila, valor });
  }

  const puesto = document.createElement('p');
  puesto.className = 'totem__puesto';

  const ahorro = document.createElement('div');
  ahorro.className = 'totem__ahorro';
  const ahorroCifra = document.createElement('p');
  ahorroCifra.className = 'totem__ahorro-cifra';
  const ahorroTexto = document.createElement('p');
  ahorroTexto.className = 'totem__ahorro-texto';

  // --- Depósito en litros, 50 L por defecto: estepador a medida (RF-33) ---
  // Se mantiene `type="number"` (teclado numérico, validación nativa) pero
  // se ocultan las flechas del navegador por CSS y se sustituyen por dos
  // botones propios que llaman a stepUp()/stepDown(), reutilizando el mismo
  // evento `input` que ya dispara la actualización de estado.
  const grupoDeposito = document.createElement('div');
  grupoDeposito.className = 'totem__deposito';

  const etiquetaDeposito = document.createElement('span');
  etiquetaDeposito.className = 'micro totem__deposito-etiqueta';
  etiquetaDeposito.textContent = 'Depósito';

  const campoDeposito = document.createElement('div');
  campoDeposito.className = 'deposito';

  const inputDeposito = document.createElement('input');
  inputDeposito.type = 'number';
  inputDeposito.min = '1';
  inputDeposito.max = '300';
  inputDeposito.step = String(PASO_DEPOSITO);
  inputDeposito.inputMode = 'numeric';
  inputDeposito.className = 'deposito__input';
  inputDeposito.setAttribute('aria-label', 'Depósito en litros');

  function emitirCambioDeposito(): void {
    const litros = Number(inputDeposito.value);
    if (Number.isFinite(litros) && litros > 0) {
      actualizarEstado({ deposito: litros });
    }
  }
  inputDeposito.addEventListener('input', emitirCambioDeposito);

  const botonMenos = document.createElement('button');
  botonMenos.type = 'button';
  botonMenos.className = 'deposito__paso';
  botonMenos.setAttribute('aria-label', `Restar ${PASO_DEPOSITO} litros`);
  botonMenos.textContent = '−';
  botonMenos.addEventListener('click', () => {
    inputDeposito.stepDown();
    emitirCambioDeposito();
  });

  const botonMas = document.createElement('button');
  botonMas.type = 'button';
  botonMas.className = 'deposito__paso';
  botonMas.setAttribute('aria-label', `Sumar ${PASO_DEPOSITO} litros`);
  botonMas.textContent = '+';
  botonMas.addEventListener('click', () => {
    inputDeposito.stepUp();
    emitirCambioDeposito();
  });

  const sufijoDeposito = document.createElement('span');
  sufijoDeposito.className = 'deposito__sufijo micro';
  sufijoDeposito.textContent = 'L';
  sufijoDeposito.setAttribute('aria-hidden', 'true');

  // El número y su "L" van juntos en su propia celda, con un solo borde que
  // los separa de los botones −/+ a los lados.
  const campoNumero = document.createElement('div');
  campoNumero.className = 'deposito__campo';
  campoNumero.append(inputDeposito, sufijoDeposito);

  campoDeposito.append(botonMenos, campoNumero, botonMas);
  grupoDeposito.append(etiquetaDeposito, campoDeposito);

  lleno.append(rotulo, direccion, horario, combustibles, puesto, ahorro, grupoDeposito);
  contenedor.append(vacio, lleno);

  function render(estado: EstadoApp): void {
    const estacion = estado.estaciones.find((e) => e.id === estado.estacionId) ?? null;

    contenedor.classList.toggle('totem--vacio', !estacion);
    vacio.hidden = Boolean(estacion);
    lleno.hidden = !estacion;

    // El depósito se actualiza pase lo que pase, esté o no la ficha llena:
    // si el usuario acaba de deseleccionar la estación a mitad de escribir
    // un valor, no queremos perder ese cambio.
    if (document.activeElement !== inputDeposito) {
      inputDeposito.value = String(estado.deposito);
    }

    if (!estacion) return;

    const multiProvincia = new Set(estado.estaciones.map((e) => e.provinciaId)).size > 1;

    rotulo.textContent = estacion.rotulo;
    direccion.textContent = multiProvincia
      ? `${estacion.direccion}, ${estacion.municipio} (${estacion.provinciaNombre})`
      : `${estacion.direccion}, ${estacion.municipio}`;

    const abierta = estaAbierta(estacion.horario, new Date());
    const textoHorario = estacion.horario.trim() ? estacion.horario : 'Horario no declarado';
    horario.textContent = `${textoHorario} · ${abierta ? 'Abierta ahora' : 'Cerrada ahora'}`;

    for (const clave of ORDEN_COMBUSTIBLES) {
      const entrada = filasCombustible.get(clave);
      if (!entrada) continue;
      entrada.fila.classList.toggle('totem__fila-combustible--activa', clave === estado.combustible);

      const precio = estacion.precios[clave];
      // RF-23: lo que no se vende dice "no vende", nunca 0 ni vacío.
      if (precio === null) {
        entrada.valor.className = 'totem__precio totem__precio--ausente';
        entrada.valor.textContent = 'no vende';
      } else {
        entrada.valor.className = 'totem__precio';
        entrada.valor.textContent = formatearPrecio(precio);
      }
    }

    const precioActivo = estacion.precios[estado.combustible];
    if (precioActivo === null) {
      puesto.textContent = `Esta estación no vende ${ETIQUETA[estado.combustible].toLowerCase()}: no se puede calcular su puesto ni el ahorro.`;
      ahorro.replaceChildren();
      return;
    }

    const ordenadas = ordenarPorPrecio(estado.estaciones, estado.combustible);
    const posicion = ordenadas.indexOf(estacion) + 1;
    const sufijoLugar = multiProvincia ? ` · ${estacion.provinciaNombre}` : '';
    puesto.textContent = `${posicion}º de ${ordenadas.length} en ${estado.zonaNombre || 'la zona'}${sufijoLugar}.`;

    const escala = crearEscala(preciosDeCombustible(estado.estaciones, estado.combustible));
    if (escala.maximo === null) {
      ahorro.replaceChildren();
      return;
    }

    const euros = calcularAhorro(precioActivo, escala.maximo, estado.deposito);
    if (euros <= 0) {
      ahorroCifra.textContent = formatearEuros(0);
      ahorroTexto.textContent = 'Ya es de las más baratas de la zona con este combustible.';
    } else {
      ahorroCifra.textContent = formatearEuros(euros);
      ahorroTexto.textContent = `de ahorro repostando aquí en vez de en la más cara de la zona, con ${estado.deposito} L.`;
    }
    ahorro.replaceChildren(ahorroCifra, ahorroTexto);
  }

  render(obtenerEstado());
  return suscribir(render);
}
