import { ETIQUETA, ORDEN_COMBUSTIBLES } from '../logica/combustibles.ts';
import { cajaDeTitulo } from '../logica/formato.ts';
import { cambioEnPeriodo, serieDeEstacion, serieMedia, validarHistoricoPublico, type PuntoEvolucion } from '../logica/evolucion.ts';
import type { ClavePrecio, DatosProvincia } from '../../scripts/lib/tipos.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';
const TIMEOUT_MS = 8000;

async function cargarJson(ruta: string): Promise<unknown> {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);
  try {
    const respuesta = await fetch(ruta, { signal: controlador.signal });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    return await respuesta.json();
  } finally {
    clearTimeout(temporizador);
  }
}

function eur(milesimas: number): string {
  return `${(milesimas / 1000).toLocaleString('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} €/L`;
}

function fechaCorta(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function tramos(serie: PuntoEvolucion[], x: (i: number) => number, y: (v: number) => number): string[] {
  const resultado: string[] = [];
  let actual = '';
  serie.forEach((punto, indice) => {
    if (punto.milesimas === null) {
      if (actual) resultado.push(actual);
      actual = '';
      return;
    }
    actual += `${actual ? ' L' : 'M'} ${x(indice).toFixed(2)} ${y(punto.milesimas).toFixed(2)}`;
  });
  if (actual) resultado.push(actual);
  return resultado;
}

function dibujarGrafico(svg: SVGSVGElement, estacion: PuntoEvolucion[], municipio: PuntoEvolucion[] | null, provincia: PuntoEvolucion[]): void {
  svg.replaceChildren();
  const valores = [...estacion, ...(municipio ?? []), ...provincia].flatMap((p) => p.milesimas === null ? [] : [p.milesimas]);
  if (valores.length < 2) return;
  const ancho = 900, alto = 360, izquierda = 58, derecha = 20, arriba = 24, abajo = 42;
  const minimo = Math.floor((Math.min(...valores) - 20) / 50) * 50;
  const maximo = Math.ceil((Math.max(...valores) + 20) / 50) * 50;
  const x = (i: number) => izquierda + (i / Math.max(1, estacion.length - 1)) * (ancho - izquierda - derecha);
  const y = (v: number) => arriba + ((maximo - v) / Math.max(1, maximo - minimo)) * (alto - arriba - abajo);

  for (let i = 0; i <= 4; i += 1) {
    const valor = minimo + ((maximo - minimo) * i) / 4;
    const linea = document.createElementNS(SVG_NS, 'line');
    linea.setAttribute('x1', String(izquierda)); linea.setAttribute('x2', String(ancho - derecha));
    linea.setAttribute('y1', String(y(valor))); linea.setAttribute('y2', String(y(valor))); linea.setAttribute('class', 'evolucion-grafico__rejilla');
    const texto = document.createElementNS(SVG_NS, 'text');
    texto.setAttribute('x', String(izquierda - 10)); texto.setAttribute('y', String(y(valor) + 4)); texto.setAttribute('class', 'evolucion-grafico__eje');
    texto.textContent = (valor / 1000).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    svg.append(linea, texto);
  }
  [[provincia, 'evolucion-grafico__provincia'], [municipio, 'evolucion-grafico__municipio'], [estacion, 'evolucion-grafico__estacion']].forEach(([serie, clase]) => {
    if (!Array.isArray(serie)) return;
    for (const d of tramos(serie, x, y)) {
      const path = document.createElementNS(SVG_NS, 'path'); path.setAttribute('d', d); path.setAttribute('class', String(clase)); svg.append(path);
    }
  });
  [0, estacion.length - 1].forEach((indice) => {
    const texto = document.createElementNS(SVG_NS, 'text');
    texto.setAttribute('x', String(x(indice))); texto.setAttribute('y', String(alto - 10)); texto.setAttribute('class', 'evolucion-grafico__fecha');
    texto.setAttribute('text-anchor', indice === 0 ? 'start' : 'end'); texto.textContent = fechaCorta(estacion[indice]!.fecha); svg.append(texto);
  });
}

export async function montarEvolucion(contenedor: HTMLElement, provinciaId: string): Promise<void> {
  const estado = contenedor.querySelector<HTMLElement>('[data-estado]')!;
  try {
    const [actualCrudo, historicoCrudo] = await Promise.all([
      cargarJson(`/data/provincias/${provinciaId}.json`),
      cargarJson(`/data/historico/provincias/${provinciaId}.json`),
    ]);
    const actual = actualCrudo as DatosProvincia;
    if (actual.provincia?.id !== provinciaId || !Array.isArray(actual.estaciones)) throw new Error('Los datos actuales no son válidos.');
    const historico = validarHistoricoPublico(historicoCrudo, provinciaId);
    const disponibles = actual.estaciones.filter((e) => historico.estaciones.some((s) => s[0] === e.id));
    if (disponibles.length === 0) throw new Error('No hay estaciones con histórico en esta provincia.');

    const selector = contenedor.querySelector<HTMLSelectElement>('[data-estacion]')!;
    for (const estacion of [...disponibles].sort((a, b) => a.municipio.localeCompare(b.municipio, 'es') || a.rotulo.localeCompare(b.rotulo, 'es'))) {
      const opcion = document.createElement('option'); opcion.value = estacion.id;
      opcion.textContent = `${cajaDeTitulo(estacion.municipio)} · ${estacion.rotulo}`; selector.append(opcion);
    }
    const combustible = contenedor.querySelector<HTMLSelectElement>('[data-combustible]')!;
    ORDEN_COMBUSTIBLES.forEach((clave) => { const opcion = document.createElement('option'); opcion.value = clave; opcion.textContent = ETIQUETA[clave]; combustible.append(opcion); });
    const solicitado = new URLSearchParams(location.search).get('estacion');
    selector.value = disponibles.some((e) => e.id === solicitado) ? solicitado! : disponibles[0]!.id;
    const periodos = [...contenedor.querySelectorAll<HTMLButtonElement>('[data-periodo]')];
    let periodo: 7 | 30 | 90 = 30;

    const render = (): void => {
      const estacion = disponibles.find((e) => e.id === selector.value)!;
      const clave = combustible.value as ClavePrecio;
      const serie = serieDeEstacion(historico, estacion.id, clave)!;
      const media = serieMedia(historico.provincia, historico.fechas, clave);
      const municipioId = historico.estaciones.find((entrada) => entrada[0] === estacion.id)?.[1] ?? null;
      const agregadoMunicipio = municipioId === null ? null : historico.municipios[municipioId] ?? null;
      const mediaMunicipio = agregadoMunicipio ? serieMedia(agregadoMunicipio, historico.fechas, clave) : null;
      const cambio = cambioEnPeriodo(serie, periodo);
      const cambioMunicipio = mediaMunicipio ? cambioEnPeriodo(mediaMunicipio, periodo) : null;
      const actualMilesimas = [...serie].reverse().find((p) => p.milesimas !== null)?.milesimas ?? null;
      contenedor.querySelector<HTMLElement>('[data-rotulo]')!.textContent = estacion.rotulo;
      contenedor.querySelector<HTMLElement>('[data-direccion]')!.textContent = `${cajaDeTitulo(estacion.direccion)}, ${cajaDeTitulo(estacion.municipio)}`;
      contenedor.querySelector<HTMLElement>('[data-precio]')!.textContent = actualMilesimas === null ? 'sin precio' : eur(actualMilesimas);
      const conclusion = contenedor.querySelector<HTMLElement>('[data-conclusion]')!;
      if (!cambio) conclusion.textContent = `No hay datos suficientes en los dos extremos exactos de este periodo.`;
      else if (cambio.diferenciaMilesimas === 0) conclusion.textContent = `El precio no ha cambiado en ${periodo} días.`;
      else conclusion.textContent = `Ha ${cambio.diferenciaMilesimas < 0 ? 'bajado' : 'subido'} ${eur(Math.abs(cambio.diferenciaMilesimas)).replace(' €/L', '')} por litro (${Math.abs(cambio.porcentaje).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %) en ${periodo} días.`;
      const contexto = contenedor.querySelector<HTMLElement>('[data-contexto]')!;
      if (!cambioMunicipio) contexto.textContent = `No hay dos extremos completos para comparar con ${cajaDeTitulo(estacion.municipio)}.`;
      else if (cambioMunicipio.diferenciaMilesimas === 0) contexto.textContent = `La media de ${cajaDeTitulo(estacion.municipio)} se ha mantenido estable en el mismo periodo.`;
      else contexto.textContent = `Mientras tanto, la media de ${cajaDeTitulo(estacion.municipio)} ha ${cambioMunicipio.diferenciaMilesimas < 0 ? 'bajado' : 'subido'} ${(Math.abs(cambioMunicipio.diferenciaMilesimas) / 10).toLocaleString('es-ES', { maximumFractionDigits: 1 })} céntimos.`;
      const svg = contenedor.querySelector<SVGSVGElement>('svg')!;
      svg.setAttribute('aria-label', `${ETIQUETA[clave]} en ${estacion.rotulo}: estación frente a media provincial durante 90 días.`);
      dibujarGrafico(svg, serie, mediaMunicipio, media);
      const url = new URL(location.href); url.searchParams.set('estacion', estacion.id); history.replaceState(null, '', url);
    };
    selector.addEventListener('change', render); combustible.addEventListener('change', render);
    periodos.forEach((boton) => boton.addEventListener('click', () => { periodo = Number(boton.dataset.periodo) as 7 | 30 | 90; periodos.forEach((b) => b.setAttribute('aria-pressed', String(b === boton))); render(); }));
    estado.hidden = true; contenedor.querySelector<HTMLElement>('[data-contenido]')!.hidden = false; render();
  } catch (error) {
    estado.textContent = error instanceof Error ? `No hemos podido cargar la evolución. ${error.message}` : 'No hemos podido cargar la evolución.';
    estado.dataset.tipo = 'error';
  }
}
