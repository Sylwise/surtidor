// Lista de estaciones ordenada de menor a mayor precio del combustible activo,
// sincronizada con la selección (RF-20, RF-21).

import { actualizarEstado, obtenerEstado, suscribir, type EstadoApp } from '../logica/estado.ts';
import { crearEscala, ordenarPorPrecio, preciosDeCombustible } from '../logica/escala.ts';
import { estaAbierta } from '../../scripts/lib/horario.ts';
import { ETIQUETA } from '../logica/combustibles.ts';
import { cajaDeTitulo, formatearPrecio } from '../logica/formato.ts';
import { estacionesVisibles } from '../logica/visibilidad.ts';
import type { EstacionZona } from '../logica/zona.ts';

function crearAviso(texto: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.className = 'lista__aviso';
  p.textContent = texto;
  return p;
}

// RF-82: el filtro de abiertas ya no tiene fila propia, es una píldora junto
// al contador que modifica ("MÁS BARATAS · 72 · Abiertas",
// docs/05-diseno.md#Los-dos-estados-de-la-hoja). Reutiliza el aspecto de
// pestaña de Controles.ts (misma familia visual de píldora) en vez de crear
// un componente de chip aparte.
function crearCabecera(soloAbiertas: boolean, contador: number): HTMLDivElement {
  const cabecera = document.createElement('div');
  cabecera.className = 'lista__cabecera';

  const titulo = document.createElement('h2');
  titulo.className = 'lista__titulo';
  titulo.textContent = 'Más baratas';

  const contadorEl = document.createElement('span');
  contadorEl.className = 'lista__contador';
  contadorEl.textContent = String(contador);

  const filtro = document.createElement('button');
  filtro.type = 'button';
  filtro.className = 'controles__pestana lista__filtro';
  filtro.classList.toggle('controles__pestana--activa', soloAbiertas);
  filtro.setAttribute('aria-pressed', String(soloAbiertas));
  filtro.setAttribute('aria-label', 'Filtrar solo estaciones abiertas ahora');
  filtro.textContent = 'Abiertas';
  filtro.addEventListener('click', () => actualizarEstado({ soloAbiertas: !soloAbiertas }, 'eleccion'));

  cabecera.append(titulo, document.createTextNode(' · '), contadorEl, document.createTextNode(' · '), filtro);
  return cabecera;
}

// RF-86: el municipio se pasa a caja de título; la provincia, verbatim (RF-76).
function nombreLugar(estacion: EstacionZona, multiProvincia: boolean): string {
  const municipio = cajaDeTitulo(estacion.municipio);
  return multiProvincia ? `${municipio} · ${estacion.provinciaNombre}` : municipio;
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

    // RF-49: sin zona elegida todavía (recién llegado, sin nada guardado en
    // localStorage), no hay que confundirlo con RF-42 (zona sin ese
    // combustible): aquí no hay zona en absoluto.
    if (!estado.cargando && estado.zonaId === null) {
      contenedor.append(crearAviso('Elige una zona arriba para ver sus estaciones.'));
      return;
    }

    // RF-48: las estaciones sin venta al público se excluyen en toda la
    // interfaz, no solo aquí; el mapa y la ficha aplican el mismo filtro.
    const visiblesTipoVenta = estacionesVisibles(estado.estaciones);
    const ordenadas = ordenarPorPrecio(visiblesTipoVenta, estado.combustible);

    // RF-42: ninguna estación de la zona vende el combustible elegido.
    if (ordenadas.length === 0) {
      contenedor.append(crearCabecera(estado.soloAbiertas, 0));
      const nombreZona = estado.zonaNombre || 'esta zona';
      contenedor.append(
        crearAviso(`Ninguna estación de ${nombreZona} vende ${ETIQUETA[estado.combustible].toLowerCase()}.`)
      );
      return;
    }

    const visibles = estado.soloAbiertas ? ordenadas.filter((e) => estaAbierta(e.horario, new Date())) : ordenadas;

    contenedor.append(crearCabecera(estado.soloAbiertas, visibles.length));

    // Filtro sin resultados.
    if (visibles.length === 0) {
      const aviso = crearAviso('Ninguna abierta ahora.');
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'lista__quitar-filtro';
      boton.textContent = 'Quitar filtro';
      boton.addEventListener('click', () => actualizarEstado({ soloAbiertas: false }, 'eleccion'));
      aviso.append(document.createTextNode(' '), boton);
      contenedor.append(aviso);
      return;
    }

    const escala = crearEscala(preciosDeCombustible(visiblesTipoVenta, estado.combustible));
    const multiProvincia = new Set(visiblesTipoVenta.map((e) => e.provinciaId)).size > 1;

    const filas = document.createElement('ol');
    filas.className = 'lista__filas';

    for (const estacion of visibles) {
      const puesto = ordenadas.indexOf(estacion) + 1;
      const precio = estacion.precios[estado.combustible] as number;
      const abierta = estaAbierta(estacion.horario, new Date());

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
      fila.addEventListener('click', () => actualizarEstado({ estacionId: estacion.id }, 'eleccion'));
      item.append(fila);
      filas.append(item);
    }

    contenedor.append(filas);
  }

  render(obtenerEstado());
  return suscribir(render);
}
