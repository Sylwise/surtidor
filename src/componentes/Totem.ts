// Ficha de la estación seleccionada: rótulo, dirección, municipio, horario,
// los cuatro combustibles (RF-22, RF-23), puesto dentro de la zona (RF-24) y
// el bloque de ahorro (RF-25). Ver la sección "Tótem" de docs/05-diseno.md.

import { obtenerEstado, suscribir, type EstadoApp } from '../logica/estado.ts';
import { crearEscala, ordenarPorPrecio, preciosDeCombustible } from '../logica/escala.ts';
import { calcularAhorro } from '../logica/ahorro.ts';
import { ETIQUETA, ORDEN_COMBUSTIBLES } from '../logica/combustibles.ts';
import { formatearEuros, formatearPrecio } from '../logica/formato.ts';
import { estaAbierta } from '../../scripts/lib/horario.ts';

/** Monta la ficha en `contenedor` y la mantiene sincronizada con el estado.
 *  Devuelve una función para desuscribirse. */
export function montarTotem(contenedor: HTMLElement): () => void {
  function render(estado: EstadoApp): void {
    contenedor.innerHTML = '';

    const estacion = estado.estaciones.find((e) => e.id === estado.estacionId) ?? null;

    // Sin estación, el tótem se vuelve un aviso compacto (ADR-0006): sin
    // esto reserva su cromo completo (padding, borde de --signal) aunque no
    // tenga nada que decir, y ese espacio nunca vuelve a la lista.
    contenedor.classList.toggle('totem--vacio', !estacion);

    if (!estacion) {
      const vacio = document.createElement('p');
      vacio.className = 'totem__vacio';
      vacio.textContent = 'Toca una estación de la lista para ver su ficha.';
      contenedor.append(vacio);
      return;
    }

    const multiProvincia = new Set(estado.estaciones.map((e) => e.provinciaId)).size > 1;

    const rotulo = document.createElement('h2');
    rotulo.className = 'totem__rotulo';
    rotulo.textContent = estacion.rotulo;

    const direccion = document.createElement('p');
    direccion.className = 'totem__direccion';
    direccion.textContent = multiProvincia
      ? `${estacion.direccion}, ${estacion.municipio} (${estacion.provinciaNombre})`
      : `${estacion.direccion}, ${estacion.municipio}`;

    const abierta = estaAbierta(estacion.horario, new Date());
    const horario = document.createElement('p');
    horario.className = 'totem__horario';
    const textoHorario = estacion.horario.trim() ? estacion.horario : 'Horario no declarado';
    horario.textContent = `${textoHorario} · ${abierta ? 'Abierta ahora' : 'Cerrada ahora'}`;

    const combustibles = document.createElement('ul');
    combustibles.className = 'totem__combustibles';
    for (const clave of ORDEN_COMBUSTIBLES) {
      const precio = estacion.precios[clave];
      const fila = document.createElement('li');
      fila.className = 'totem__fila-combustible';
      if (clave === estado.combustible) fila.classList.add('totem__fila-combustible--activa');

      const etiqueta = document.createElement('span');
      etiqueta.className = 'totem__etiqueta-combustible';
      etiqueta.textContent = ETIQUETA[clave];

      const valor = document.createElement('span');
      // RF-23: lo que no se vende dice "no vende", nunca 0 ni vacío.
      if (precio === null) {
        valor.className = 'totem__precio totem__precio--ausente';
        valor.textContent = 'no vende';
      } else {
        valor.className = 'totem__precio';
        valor.textContent = formatearPrecio(precio);
      }

      fila.append(etiqueta, valor);
      combustibles.append(fila);
    }

    contenedor.append(rotulo, direccion, horario, combustibles);

    const precioActivo = estacion.precios[estado.combustible];
    const puesto = document.createElement('p');
    puesto.className = 'totem__puesto';
    const ahorro = document.createElement('div');
    ahorro.className = 'totem__ahorro';

    if (precioActivo === null) {
      puesto.textContent = `Esta estación no vende ${ETIQUETA[estado.combustible].toLowerCase()}: no se puede calcular su puesto ni el ahorro.`;
    } else {
      const ordenadas = ordenarPorPrecio(estado.estaciones, estado.combustible);
      const posicion = ordenadas.indexOf(estacion) + 1;
      const sufijoLugar = multiProvincia ? ` · ${estacion.provinciaNombre}` : '';
      puesto.textContent = `${posicion}º de ${ordenadas.length} en ${estado.zonaNombre || 'la zona'}${sufijoLugar}.`;

      const escala = crearEscala(preciosDeCombustible(estado.estaciones, estado.combustible));
      if (escala.maximo !== null) {
        const cifra = document.createElement('p');
        cifra.className = 'totem__ahorro-cifra';
        const texto = document.createElement('p');
        texto.className = 'totem__ahorro-texto';

        const euros = calcularAhorro(precioActivo, escala.maximo, estado.deposito);
        if (euros <= 0) {
          cifra.textContent = formatearEuros(0);
          texto.textContent = 'Ya es de las más baratas de la zona con este combustible.';
        } else {
          cifra.textContent = formatearEuros(euros);
          texto.textContent = `de ahorro repostando aquí en vez de en la más cara de la zona, con ${estado.deposito} L.`;
        }
        ahorro.append(cifra, texto);
      }
    }

    contenedor.append(puesto, ahorro);
  }

  render(obtenerEstado());
  return suscribir(render);
}
