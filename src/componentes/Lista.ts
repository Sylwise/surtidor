// Lista de estaciones ordenada de menor a mayor precio del combustible activo,
// sincronizada con la selección (RF-20, RF-21).

import { actualizarEstado, obtenerEstado, suscribir, type EstadoApp } from '../logica/estado.ts';
import { crearEscala, ordenarPorPrecio, preciosDeCombustible } from '../logica/escala.ts';
import { estaAbiertaStub } from '../logica/horario.ts';
import { ETIQUETA } from '../logica/combustibles.ts';
import { formatearPrecio } from '../logica/formato.ts';
import type { EstacionZona } from '../logica/zona.ts';

function crearAviso(texto: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.className = 'lista__aviso';
  p.textContent = texto;
  return p;
}

function nombreLugar(estacion: EstacionZona, multiProvincia: boolean): string {
  return multiProvincia ? `${estacion.municipio} · ${estacion.provinciaNombre}` : estacion.municipio;
}

/** Monta la lista en `contenedor` y la mantiene sincronizada con el estado.
 *  Devuelve una función para desuscribirse, por si el llamador la necesita. */
export function montarLista(contenedor: HTMLElement): () => void {
  function render(estado: EstadoApp): void {
    contenedor.innerHTML = '';
    contenedor.setAttribute('aria-busy', estado.cargando ? 'true' : 'false');

    if (estado.cargando && estado.estaciones.length === 0) {
      contenedor.append(crearAviso('Cargando estaciones…'));
      return;
    }

    if (!estado.cargando && estado.error && estado.estaciones.length === 0) {
      contenedor.append(crearAviso('No se han podido cargar los datos. Usa «Reintentar» arriba.'));
      return;
    }

    const ordenadas = ordenarPorPrecio(estado.estaciones, estado.combustible);
    const titulo = document.createElement('h2');
    titulo.className = 'lista__titulo';
    titulo.textContent = 'Más baratas';
    contenedor.append(titulo);

    // RF-42: ninguna estación de la zona vende el combustible elegido.
    if (ordenadas.length === 0) {
      const nombreZona = estado.zonaNombre || 'esta zona';
      contenedor.append(
        crearAviso(`Ninguna estación de ${nombreZona} vende ${ETIQUETA[estado.combustible].toLowerCase()}.`)
      );
      return;
    }

    const visibles = estado.soloAbiertas ? ordenadas.filter((e) => estaAbiertaStub(e.horario)) : ordenadas;

    // Filtro sin resultados.
    if (visibles.length === 0) {
      const aviso = crearAviso('Ninguna abierta ahora.');
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'lista__quitar-filtro';
      boton.textContent = 'Quitar filtro';
      boton.addEventListener('click', () => actualizarEstado({ soloAbiertas: false }));
      aviso.append(document.createTextNode(' '), boton);
      contenedor.append(aviso);
      return;
    }

    const escala = crearEscala(preciosDeCombustible(estado.estaciones, estado.combustible));
    const multiProvincia = new Set(estado.estaciones.map((e) => e.provinciaId)).size > 1;

    const filas = document.createElement('ol');
    filas.className = 'lista__filas';

    for (const estacion of visibles) {
      const puesto = ordenadas.indexOf(estacion) + 1;
      const precio = estacion.precios[estado.combustible] as number;
      const abierta = estaAbiertaStub(estacion.horario);

      const item = document.createElement('li');
      const fila = document.createElement('button');
      fila.type = 'button';
      fila.className = 'fila';
      if (!abierta) fila.classList.add('fila--cerrada');
      fila.setAttribute('aria-pressed', String(estacion.id === estado.estacionId));
      if (estacion.id === estado.estacionId) fila.classList.add('fila--activa');

      const orden = document.createElement('span');
      orden.className = 'fila__orden';
      orden.textContent = String(puesto);

      const info = document.createElement('span');
      info.className = 'fila__info';
      const rotulo = document.createElement('span');
      rotulo.className = 'fila__rotulo';
      rotulo.textContent = estacion.rotulo;
      const lugar = document.createElement('span');
      lugar.className = 'fila__municipio';
      lugar.textContent = nombreLugar(estacion, multiProvincia);
      info.append(rotulo, lugar);

      const precioEl = document.createElement('span');
      const banda = escala.esMasBarata(precio) ? 'barata' : escala.banda(precio);
      precioEl.className = `fila__precio precio precio--${banda}`;
      precioEl.textContent = formatearPrecio(precio);

      fila.append(orden, info, precioEl);
      fila.addEventListener('click', () => actualizarEstado({ estacionId: estacion.id }));
      item.append(fila);
      filas.append(item);
    }

    contenedor.append(filas);
  }

  render(obtenerEstado());
  return suscribir(render);
}
