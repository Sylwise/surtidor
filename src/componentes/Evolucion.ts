import { ETIQUETA, ORDEN_COMBUSTIBLES } from '../logica/combustibles.ts';
import { cajaDeTitulo } from '../logica/formato.ts';
import { cambioEnPeriodo, cambiosDeEstaciones, serieDeEstacion, serieMedia, validarHistoricoPublico, type CambioEstacion, type PuntoEvolucion } from '../logica/evolucion.ts';
import { explicarEvolucion } from '../logica/explicacionEvolucion.ts';
import type { ClavePrecio, DatosProvincia, Estacion } from '../../scripts/lib/tipos.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';
function eur(milesimas: number | null): string {
  return milesimas === null ? 'sin dato' : `${(milesimas / 1000).toLocaleString('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} €/L`;
}

function eurTooltip(milesimas: number | null): string {
  return milesimas === null ? 'sin dato' : `${(milesimas / 1000).toLocaleString('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} €`;
}

function fecha(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function fechaTooltip(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function centimos(milesimas: number): string {
  return (Math.abs(milesimas) / 10).toLocaleString('es-ES', { maximumFractionDigits: 1 });
}

function tramos(serie: PuntoEvolucion[], x: (i: number) => number, y: (v: number) => number): string[] {
  const resultado: string[] = []; let actual = '';
  serie.forEach((punto, indice) => {
    if (punto.milesimas === null) { if (actual) resultado.push(actual); actual = ''; return; }
    actual += `${actual ? ' L' : 'M'} ${x(indice).toFixed(2)} ${y(punto.milesimas).toFixed(2)}`;
  });
  if (actual) resultado.push(actual); return resultado;
}

function dibujarGrafico(svg: SVGSVGElement, principal: PuntoEvolucion[], secundaria: PuntoEvolucion[], tooltip: HTMLOutputElement, etiquetas: [string, string]): void {
  svg.replaceChildren();
  const valores = [...principal, ...secundaria].flatMap((p) => p.milesimas === null ? [] : [p.milesimas]);
  if (valores.length < 2) return;
  const ancho = window.matchMedia('(max-width: 760px)').matches ? 560 : 900;
  const alto = 360, izquierda = 58, derecha = 20, arriba = 24, abajo = 42;
  svg.setAttribute('viewBox', `0 0 ${ancho} ${alto}`);
  const minimo = Math.floor((Math.min(...valores) - 20) / 50) * 50;
  const maximo = Math.ceil((Math.max(...valores) + 20) / 50) * 50;
  const x = (i: number) => izquierda + i / Math.max(1, principal.length - 1) * (ancho - izquierda - derecha);
  const y = (v: number) => arriba + (maximo - v) / Math.max(1, maximo - minimo) * (alto - arriba - abajo);
  const titulo = document.createElementNS(SVG_NS, 'title'); titulo.textContent = 'Evolución diaria del precio'; svg.append(titulo);
  const defs = document.createElementNS(SVG_NS, 'defs');
  const gradiente = document.createElementNS(SVG_NS, 'linearGradient'); gradiente.id = 'evolucion-area'; gradiente.setAttribute('x1', '0'); gradiente.setAttribute('y1', '0'); gradiente.setAttribute('x2', '0'); gradiente.setAttribute('y2', '1');
  const stopInicio = document.createElementNS(SVG_NS, 'stop'); stopInicio.setAttribute('offset', '0%'); stopInicio.setAttribute('stop-color', '#f5b921'); stopInicio.setAttribute('stop-opacity', '.3');
  const stopFin = document.createElementNS(SVG_NS, 'stop'); stopFin.setAttribute('offset', '100%'); stopFin.setAttribute('stop-color', '#f5b921'); stopFin.setAttribute('stop-opacity', '.03');
  gradiente.append(stopInicio, stopFin); defs.append(gradiente); svg.append(defs);
  for (let i = 0; i <= 4; i += 1) {
    const valor = minimo + (maximo - minimo) * i / 4;
    const linea = document.createElementNS(SVG_NS, 'line'); linea.setAttribute('x1', String(izquierda)); linea.setAttribute('x2', String(ancho - derecha)); linea.setAttribute('y1', String(y(valor))); linea.setAttribute('y2', String(y(valor))); linea.setAttribute('class', 'evolucion-grafico__rejilla');
    const texto = document.createElementNS(SVG_NS, 'text'); texto.setAttribute('x', String(izquierda - 10)); texto.setAttribute('y', String(y(valor) + 4)); texto.setAttribute('class', 'evolucion-grafico__eje'); texto.textContent = (valor / 1000).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); svg.append(linea, texto);
  }
  tramos(principal, x, y).forEach((d) => { const numeros = d.match(/[-\d.]+/g)?.map(Number) ?? []; if (numeros.length < 4) return; const area = document.createElementNS(SVG_NS, 'path'); area.setAttribute('d', `${d} L ${numeros.at(-2)} ${y(minimo)} L ${numeros[0]} ${y(minimo)} Z`); area.setAttribute('class', 'evolucion-grafico__area'); svg.append(area); });
  [[secundaria, 'evolucion-grafico__provincia'], [principal, 'evolucion-grafico__estacion']].forEach(([serie, clase]) => tramos(serie as PuntoEvolucion[], x, y).forEach((d) => { const path = document.createElementNS(SVG_NS, 'path'); path.setAttribute('d', d); path.setAttribute('class', String(clase)); svg.append(path); }));
  const ejeX = document.createElementNS(SVG_NS, 'line'); ejeX.setAttribute('x1', String(izquierda)); ejeX.setAttribute('x2', String(ancho - derecha)); ejeX.setAttribute('y1', String(alto - abajo)); ejeX.setAttribute('y2', String(alto - abajo)); ejeX.setAttribute('class', 'evolucion-grafico__eje-x'); svg.append(ejeX);
  [0, principal.length - 1].forEach((indice) => { const texto = document.createElementNS(SVG_NS, 'text'); texto.setAttribute('x', String(x(indice))); texto.setAttribute('y', String(alto - 10)); texto.setAttribute('text-anchor', indice === 0 ? 'start' : 'end'); texto.setAttribute('class', 'evolucion-grafico__fecha'); texto.textContent = fecha(principal[indice]!.fecha); svg.append(texto); });
  let fijado = false;
  let indiceActivo = principal.length - 1;
  const guia = document.createElementNS(SVG_NS, 'line'); guia.setAttribute('y1', String(arriba)); guia.setAttribute('y2', String(alto - abajo)); guia.setAttribute('class', 'evolucion-grafico__guia');
  const marcador = document.createElementNS(SVG_NS, 'circle'); marcador.setAttribute('r', '6'); marcador.setAttribute('class', 'evolucion-grafico__marcador-eje'); svg.append(guia, marcador);
  const mostrarGuia = (visible: boolean): void => { guia.setAttribute('visibility', visible ? 'visible' : 'hidden'); marcador.setAttribute('visibility', visible ? 'visible' : 'hidden'); };
  mostrarGuia(false);
  const mostrarIndice = (indice: number, posicionX?: number, posicionY?: number): void => {
    indiceActivo = Math.max(0, Math.min(principal.length - 1, indice));
    const punto = principal[indiceActivo]!; const comparador = secundaria[indiceActivo]?.milesimas ?? null;
    const tituloTooltip = document.createElement('strong'); tituloTooltip.className = 'evolucion-tooltip__fecha'; tituloTooltip.textContent = fechaTooltip(punto.fecha);
    const crearFila = (etiqueta: string, valor: string, secundariaFila = false): HTMLSpanElement => {
      const fila = document.createElement('span'); fila.className = secundariaFila ? 'evolucion-tooltip__fila evolucion-tooltip__fila--secundaria' : 'evolucion-tooltip__fila';
      const nombre = document.createElement('span'); nombre.textContent = etiqueta;
      const cifra = document.createElement('b'); cifra.textContent = valor;
      fila.append(nombre, cifra); return fila;
    };
    const filaPrincipal = crearFila(etiquetas[0], eurTooltip(punto.milesimas));
    const filaSecundaria = crearFila(etiquetas[1], eurTooltip(comparador), true);
    tooltip.replaceChildren(tituloTooltip, filaPrincipal, filaSecundaria);
    const anterior = principal[indiceActivo - 1]?.milesimas ?? null;
    if (punto.milesimas !== null && anterior !== null) { const variacion = document.createElement('small'); variacion.className = 'evolucion-tooltip__cambio'; const diferencia = punto.milesimas - anterior; variacion.textContent = `${diferencia > 0 ? '+' : diferencia < 0 ? '−' : ''}${centimos(diferencia)} cts desde ayer`; tooltip.append(variacion); }
    tooltip.hidden = false;
    const caja = svg.getBoundingClientRect();
    const matriz = svg.getScreenCTM();
    const posicionPunto = matriz ? new DOMPoint(x(indiceActivo), punto.milesimas === null ? alto / 2 : y(punto.milesimas)).matrixTransform(matriz) : null;
    const pxCss = posicionX ?? (posicionPunto ? posicionPunto.x - caja.left : x(indiceActivo) / ancho * caja.width);
    const pyCss = posicionY ?? (posicionPunto ? posicionPunto.y - caja.top : (punto.milesimas === null ? alto / 2 : y(punto.milesimas)) / alto * caja.height);
    const anchoTooltip = tooltip.offsetWidth;
    const altoTooltip = tooltip.offsetHeight;
    tooltip.style.left = `${Math.max(8, Math.min(caja.width - anchoTooltip - 8, pxCss - (pxCss > caja.width * .65 ? anchoTooltip + 10 : 0)))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(caja.height - altoTooltip - 8, pyCss - altoTooltip - 10))}px`;
    guia.setAttribute('x1', String(x(indiceActivo))); guia.setAttribute('x2', String(x(indiceActivo)));
    marcador.setAttribute('cx', String(x(indiceActivo))); marcador.setAttribute('cy', String(punto.milesimas === null ? alto - abajo : y(punto.milesimas))); mostrarGuia(true);
  };
  const mostrar = (evento: PointerEvent): void => {
    const matriz = svg.getScreenCTM(); if (!matriz) return;
    const puntoPantalla = new DOMPoint(evento.clientX, evento.clientY).matrixTransform(matriz.inverse());
    const px = puntoPantalla.x;
    const py = puntoPantalla.y;
    if (py < arriba || py > alto - abajo) { if (!fijado) { tooltip.hidden = true; mostrarGuia(false); } return; }
    const indice = Math.max(0, Math.min(principal.length - 1, Math.round((px - izquierda) / (ancho - izquierda - derecha) * (principal.length - 1))));
    mostrarIndice(indice);
  };
  svg.tabIndex = 0;
  svg.onpointermove = mostrar;
  svg.onpointerleave = () => { if (!fijado) { tooltip.hidden = true; mostrarGuia(false); } };
  svg.onclick = (evento) => {
    const matriz = svg.getScreenCTM(); if (!matriz) return; const py = new DOMPoint((evento as PointerEvent).clientX, (evento as PointerEvent).clientY).matrixTransform(matriz.inverse()).y;
    if (py < arriba || py > alto - abajo) { fijado = false; tooltip.hidden = true; mostrarGuia(false); return; }
    fijado = !fijado; mostrar(evento as PointerEvent);
  };
  svg.onkeydown = (evento) => { if (evento.key === 'Escape') { fijado = false; tooltip.hidden = true; mostrarGuia(false); return; } if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(evento.key)) return; evento.preventDefault(); if (evento.key === 'Home') indiceActivo = 0; else if (evento.key === 'End') indiceActivo = principal.length - 1; else indiceActivo += evento.key === 'ArrowLeft' ? -1 : 1; mostrarIndice(indiceActivo); };
}

interface GrupoCambio { representante: CambioEstacion; estaciones: Estacion[]; }
function agruparCambios(cambios: CambioEstacion[], estaciones: Estacion[]): GrupoCambio[] {
  const grupos = new Map<string, GrupoCambio>();
  for (const cambio of cambios) {
    const estacion = estaciones.find((e) => e.id === cambio.estacionId); if (!estacion) continue;
    const clave = `${estacion.rotulo}|${cambio.desde.milesimas}|${cambio.hasta.milesimas}`;
    const grupo = grupos.get(clave) ?? { representante: cambio, estaciones: [] }; grupo.estaciones.push(estacion); grupos.set(clave, grupo);
  }
  return [...grupos.values()];
}

export async function montarEvolucion(contenedor: HTMLElement, provinciaId: string, actualCrudo: unknown, historicoCrudo: unknown): Promise<void> {
  const estado = contenedor.querySelector<HTMLElement>('[data-estado]')!;
  try {
    const actual = actualCrudo as DatosProvincia;
    if (actual.provincia?.id !== provinciaId || !Array.isArray(actual.estaciones)) throw new Error('Los datos actuales no son válidos.');
    const historico = validarHistoricoPublico(historicoCrudo, provinciaId);
    const estaciones = actual.estaciones.filter((e) => historico.estaciones.some((s) => s[0] === e.id));
    if (!estaciones.length) throw new Error('No hay estaciones con histórico en esta provincia.');
    let combustible: ClavePrecio = 'gasolina95e5'; let periodo: 7 | 30 | 90 = 30;
    const estacionSolicitada = new URLSearchParams(location.search).get('estacion');
    let estacionActiva: Estacion | null = estaciones.find((e) => e.id === estacionSolicitada) ?? null;
    const destinosCombustible = [...contenedor.querySelectorAll<HTMLElement>('[data-combustibles]')];
    const etiquetaCompacta: Record<ClavePrecio, string> = { gasolina95e5: '95', gasoleoA: 'Diésel', gasolina98e5: '98', gasoleoPremium: 'Diésel +' };
    const etiquetaControl: Record<ClavePrecio, string> = { ...ETIQUETA, gasoleoPremium: 'Diésel +' };
    const botonesCombustible = destinosCombustible.flatMap((destino) => ORDEN_COMBUSTIBLES.map((clave) => { const boton = document.createElement('button'); boton.type = 'button'; boton.textContent = destino.closest('.evolucion-controles--movil') ? etiquetaCompacta[clave] : etiquetaControl[clave]; boton.dataset.clave = clave; destino.append(boton); return boton; }));
    const botonesPeriodo = [...contenedor.querySelectorAll<HTMLButtonElement>('[data-periodo]')];
    const resultados = contenedor.querySelector<HTMLElement>('[data-resultados-estacion]')!;
    const buscar = contenedor.querySelector<HTMLInputElement>('[data-buscar-estacion]')!;
    const resumenBusqueda = contenedor.querySelector<HTMLOutputElement>('[data-busqueda-resumen]')!;
    const limpiarBusqueda = contenedor.querySelector<HTMLButtonElement>('[data-limpiar-busqueda]')!;
    const sheet = contenedor.querySelector<HTMLElement>('[data-sheet]')!;
    const fondoSheet = contenedor.querySelector<HTMLElement>('[data-sheet-fondo]')!;
    let focoAntesDelSheet: HTMLElement | null = null;
    const abrirSheet = (): void => { focoAntesDelSheet = document.activeElement instanceof HTMLElement ? document.activeElement : null; sheet.hidden = false; fondoSheet.hidden = false; document.body.dataset.sheet = 'abierta'; sheet.querySelector<HTMLInputElement>('input')?.focus(); };
    const cerrarSheet = (): void => { sheet.hidden = true; fondoSheet.hidden = true; delete document.body.dataset.sheet; focoAntesDelSheet?.focus(); };
    contenedor.querySelectorAll<HTMLButtonElement>('[data-abrir-todas], [data-abrir-explorador]').forEach((boton) => { boton.onclick = abrirSheet; });
    contenedor.querySelector<HTMLButtonElement>('[data-cerrar-sheet]')!.onclick = cerrarSheet;
    fondoSheet.onclick = cerrarSheet;
    sheet.onkeydown = (evento) => { if (evento.key === 'Escape') { evento.preventDefault(); cerrarSheet(); } };

    const actualizarUrl = (): void => { const url = new URL(location.href); if (estacionActiva) url.searchParams.set('estacion', estacionActiva.id); else url.searchParams.delete('estacion'); history.replaceState(null, '', url); };
    const abrirEstacion = (estacion: Estacion): void => { estacionActiva = estacion; actualizarUrl(); buscar.value = ''; resultados.replaceChildren(); resumenBusqueda.hidden = true; limpiarBusqueda.hidden = true; render(); };
    const pintarRanking = (destino: string, grupos: GrupoCambio[]): boolean => {
      const lista = contenedor.querySelector<HTMLElement>(destino)!; lista.replaceChildren();
      lista.parentElement!.hidden = false;
      if (!grupos.length) {
        const li = document.createElement('li'); li.className = 'evolucion-ranking__vacio';
        const titulo = document.createElement('strong'); titulo.textContent = destino.includes('bajadas') ? 'No hubo bajadas' : 'No hubo subidas';
        const texto = document.createElement('small'); texto.textContent = `Ninguna estación cambió el precio de ${ETIQUETA[combustible]} en esta dirección durante los últimos ${periodo} días.`;
        li.append(titulo, texto);
        if (periodo !== 30) { const ampliar = document.createElement('button'); ampliar.type = 'button'; ampliar.textContent = 'Ver periodo de 30 días →'; ampliar.onclick = () => { periodo = 30; render(); }; li.append(ampliar); }
        lista.append(li); return false;
      }
      grupos.slice(0, 3).forEach((grupo) => { const li = document.createElement('li'); const boton = document.createElement('button'); boton.type = 'button'; const identidad = document.createElement('span'); const nombre = document.createElement('strong'); nombre.textContent = grupo.estaciones[0]!.rotulo; const detalle = document.createElement('small'); detalle.textContent = grupo.estaciones.length > 1 ? `${grupo.estaciones.length} estaciones con la misma serie` : `${cajaDeTitulo(grupo.estaciones[0]!.direccion)} · ${cajaDeTitulo(grupo.estaciones[0]!.municipio)}`; identidad.append(nombre, detalle); const cifra = document.createElement('b'); cifra.textContent = `${grupo.representante.diferenciaMilesimas < 0 ? '−' : '+'}${(Math.abs(grupo.representante.diferenciaMilesimas) / 10).toLocaleString('es-ES', { maximumFractionDigits: 1 })} cts`; boton.append(identidad, cifra); boton.onclick = () => abrirEstacion(grupo.estaciones[0]!); li.append(boton); lista.append(li); });
      return true;
    };

    const render = (): void => {
      const esMovil = window.matchMedia('(max-width: 760px)').matches;
      botonesCombustible.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.clave === combustible)));
      botonesPeriodo.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.periodo) === periodo)));
      const mediaProvincia = serieMedia(historico.provincia, historico.fechas, combustible);
      const minimoProvincia = historico.fechas.map((fechaDia, i) => ({ fecha: fechaDia, milesimas: historico.provincia[combustible][i]?.[2] ?? null }));
      const seriePrincipal = estacionActiva ? serieDeEstacion(historico, estacionActiva.id, combustible)! : mediaProvincia;
      const serieSecundaria = estacionActiva ? mediaProvincia : minimoProvincia;
      const indiceInicio = periodo === 90 ? 0 : seriePrincipal.length - 1 - periodo;
      const tramo = seriePrincipal.slice(indiceInicio); const contexto = serieSecundaria.slice(indiceInicio);
      const cambio = cambioEnPeriodo(seriePrincipal, periodo);
      const explicacion = estacionActiva ? null : explicarEvolucion(historico, estaciones, combustible, periodo);
      const ultimoAgregado = historico.provincia[combustible].at(-1) ?? [0, 0, null];
      contenedor.querySelector<HTMLElement>('[data-titulo-panel]')!.textContent = estacionActiva ? estacionActiva.rotulo : ETIQUETA[combustible];
      contenedor.querySelector<HTMLElement>('[data-ambito]')!.textContent = estacionActiva ? `${cajaDeTitulo(estacionActiva.municipio)} · frente a la media provincial` : `Media de ${actual.provincia.nombre}`;
      const precioActualEstacion = estacionActiva?.precios[combustible] ?? null;
      contenedor.querySelector<HTMLElement>('[data-etiqueta-precio]')!.textContent = estacionActiva ? 'Precio actual' : 'Último cierre';
      contenedor.querySelector<HTMLElement>('[data-precio]')!.textContent = estacionActiva ? (precioActualEstacion === null ? 'no vende' : eur(Math.round(precioActualEstacion * 1000))) : eur(seriePrincipal.at(-1)?.milesimas ?? null);
      const cambioElemento = contenedor.querySelector<HTMLElement>('[data-cambio]')!;
      const cambioMovilElemento = contenedor.querySelector<HTMLElement>('[data-cambio-movil]')!;
      const fraseDesktop = contenedor.querySelector<HTMLElement>('[data-frase-desktop]')!;
      const fraseMovil = contenedor.querySelector<HTMLElement>('[data-frase-movil]')!;
      if (!cambio) { cambioElemento.textContent = '—'; cambioMovilElemento.textContent = '—'; fraseDesktop.textContent = 'Aún no hay histórico suficiente'; fraseMovil.textContent = 'Sin histórico suficiente'; }
      else {
        cambioElemento.textContent = cambio.diferenciaMilesimas === 0 ? 'Sin cambio' : `${cambio.diferenciaMilesimas > 0 ? '↗ +' : '↘ −'}${centimos(cambio.diferenciaMilesimas)} cts`;
        cambioMovilElemento.textContent = cambio.diferenciaMilesimas === 0 ? 'Sin cambio' : `${cambio.diferenciaMilesimas > 0 ? '+' : '−'}${centimos(cambio.diferenciaMilesimas)} cts`;
        const verbo = cambio.diferenciaMilesimas > 0 ? 'subido' : cambio.diferenciaMilesimas < 0 ? 'bajado' : 'seguido estable';
        fraseDesktop.textContent = `${estacionActiva ? estacionActiva.rotulo : `La ${ETIQUETA[combustible]}`} ha ${verbo} en los últimos ${periodo} días`;
        fraseMovil.textContent = `en ${periodo} días`;
      }
      const contextoTexto = contenedor.querySelector<HTMLElement>('[data-contexto]')!;
      contextoTexto.textContent = estacionActiva ? `Compárala con la media de ${actual.provincia.nombre} para saber si es un caso aislado.` : explicacion && explicacion.amplitud.proporcionAlineada !== null && explicacion.amplitud.comparables > 0
        ? `${explicacion.amplitud.alineadas} de ${explicacion.amplitud.comparables} estaciones ${cambio && cambio.diferenciaMilesimas < 0 ? 'bajaron' : 'subieron'} en la misma dirección.`
        : 'No hay suficientes estaciones comparables para medir el alcance.';
      const claves = contenedor.querySelector<HTMLOListElement>('[data-claves]')!; claves.replaceChildren();
      if (explicacion) {
        const textos: string[] = [];
        if (explicacion.tramoIntenso) textos.push(`El tramo más intenso fue del ${fecha(explicacion.tramoIntenso.desde)} al ${fecha(explicacion.tramoIntenso.hasta)}: ${explicacion.tramoIntenso.diferenciaMilesimas > 0 ? '+' : '−'}${centimos(explicacion.tramoIntenso.diferenciaMilesimas)} cts.`);
        const distancia = cambio && cambio.diferenciaMilesimas >= 0 ? explicacion.distanciaAlMaximoMilesimas : explicacion.distanciaAlMinimoMilesimas;
        if (distancia !== null) textos.push(cambio && cambio.diferenciaMilesimas >= 0 ? `La media está a ${centimos(distancia)} cts de su máximo de los últimos 90 días.` : `La media está a ${centimos(distancia)} cts de su mínimo de los últimos 90 días.`);
        if ((explicacion.amplitud.proporcionAlineada ?? 0) >= .8) textos.push('Es un movimiento general, no una anomalía de unas pocas gasolineras.');
        else if (explicacion.marcaMasAlineada) textos.push(`${explicacion.marcaMasAlineada.rotulo} concentra ${explicacion.marcaMasAlineada.alineadas} estaciones moviéndose en esa dirección.`);
        textos.slice(0, 3).forEach((texto) => { const li = document.createElement('li'); li.textContent = texto; claves.append(li); });
      }
      claves.hidden = estacionActiva !== null || claves.childElementCount === 0;
      const rango = contenedor.querySelector<HTMLElement>('[data-rango-fechas]')!;
      rango.textContent = `${fecha(tramo[0]!.fecha)} — ${fecha(tramo.at(-1)!.fecha)}`;
      const tramoElemento = contenedor.querySelector<HTMLElement>('[data-tramo]')!;
      tramoElemento.textContent = explicacion?.tramoIntenso ? `${fecha(explicacion.tramoIntenso.desde)} – ${fecha(explicacion.tramoIntenso.hasta)} · ${explicacion.tramoIntenso.diferenciaMilesimas > 0 ? '+' : '−'}${centimos(explicacion.tramoIntenso.diferenciaMilesimas)} cts` : 'Sin tramo destacable';
      const etiquetaMedia = contenedor.querySelector<HTMLElement>('[data-etiqueta-media]')!;
      const etiquetaMinimo = contenedor.querySelector<HTMLElement>('[data-etiqueta-minimo]')!;
      const etiquetaMuestra = contenedor.querySelector<HTMLElement>('[data-etiqueta-muestra]')!;
      const resumenGraficoMovil = contenedor.querySelector<HTMLElement>('[data-resumen-grafico-movil]')!;
      if (estacionActiva) {
        const comparables = estaciones.filter((e) => e.precios[combustible] !== null).sort((a, b) => (a.precios[combustible] ?? Infinity) - (b.precios[combustible] ?? Infinity));
        const puesto = comparables.findIndex((e) => e.id === estacionActiva!.id) + 1;
        etiquetaMedia.textContent = 'Estación · último cierre'; etiquetaMinimo.textContent = 'Media provincial'; etiquetaMuestra.textContent = 'Posición actual';
        contenedor.querySelector<HTMLElement>('[data-media]')!.textContent = eur(seriePrincipal.at(-1)?.milesimas ?? null);
        contenedor.querySelector<HTMLElement>('[data-minimo]')!.textContent = eur(mediaProvincia.at(-1)?.milesimas ?? null);
        contenedor.querySelector<HTMLElement>('[data-muestra]')!.textContent = puesto > 0 ? `${puesto}ª de ${comparables.length}` : 'No comparable';
        resumenGraficoMovil.textContent = `Media ${eur(mediaProvincia.at(-1)?.milesimas ?? null).replace(' €/L', '')} · ${puesto > 0 ? `${puesto}ª de ${comparables.length}` : 'No comparable'}`;
      } else {
        etiquetaMedia.textContent = 'Media';
        etiquetaMinimo.textContent = 'Mínimo';
        etiquetaMuestra.textContent = 'Estaciones';
        contenedor.querySelector<HTMLElement>('[data-media]')!.textContent = eur(mediaProvincia.at(-1)?.milesimas ?? null);
        contenedor.querySelector<HTMLElement>('[data-minimo]')!.textContent = eur(ultimoAgregado[2]);
        contenedor.querySelector<HTMLElement>('[data-muestra]')!.textContent = String(ultimoAgregado[1]);
        resumenGraficoMovil.textContent = `Mín. ${eur(ultimoAgregado[2]).replace(' €/L', '')} · ${ultimoAgregado[1]} est.`;
      }
      const comparacionEstacion = contenedor.querySelector<HTMLElement>('[data-comparacion-estacion]')!;
      const estadoVacio = contenedor.querySelector<HTMLElement>('[data-evolucion-vacio]')!;
      const graficoCard = contenedor.querySelector<HTMLElement>('.evolucion-grafico-card')!;
      const sinCombustible = estacionActiva !== null && precioActualEstacion === null;
      const sinHistorico = estacionActiva !== null && !sinCombustible && tramo.filter((punto) => punto.milesimas !== null).length < 2;
      estadoVacio.hidden = !sinCombustible && !sinHistorico;
      graficoCard.hidden = sinCombustible || sinHistorico;
      if (sinCombustible || sinHistorico) {
        const tituloVacio = contenedor.querySelector<HTMLElement>('[data-vacio-titulo]')!;
        const textoVacio = contenedor.querySelector<HTMLElement>('[data-vacio-texto]')!;
        const accionVacio = contenedor.querySelector<HTMLButtonElement>('[data-vacio-accion]')!;
        if (sinCombustible) {
          const alternativa = ORDEN_COMBUSTIBLES.find((clave) => estacionActiva?.precios[clave] !== null);
          tituloVacio.textContent = 'No vende este combustible';
          textoVacio.textContent = `${estacionActiva!.rotulo} no publica precio de ${ETIQUETA[combustible]}. Puedes consultar otro combustible.`;
          accionVacio.textContent = alternativa ? `Ver ${ETIQUETA[alternativa]} →` : 'Volver a la media provincial →';
          accionVacio.onclick = () => { if (alternativa) combustible = alternativa; else estacionActiva = null; actualizarUrl(); render(); };
        } else {
          tituloVacio.textContent = 'Aún no hay histórico';
          textoVacio.textContent = 'Necesitamos al menos dos publicaciones para mostrar la evolución de esta estación.';
          accionVacio.textContent = 'Volver a la media provincial →';
          accionVacio.onclick = () => { estacionActiva = null; actualizarUrl(); render(); };
        }
      }
      contenedor.querySelector<HTMLElement>('.evolucion-resumen')!.hidden = estacionActiva !== null;
      contenedor.querySelector<HTMLElement>('.evolucion-hitos')!.hidden = estacionActiva !== null;
      comparacionEstacion.hidden = estacionActiva === null || sinCombustible || sinHistorico;
      if (estacionActiva) {
        const preciosActuales = estaciones.flatMap((estacion) => estacion.precios[combustible] === null ? [] : [Math.round(estacion.precios[combustible]! * 1000)]);
        const precioEstacion = estacionActiva.precios[combustible] === null ? null : Math.round(estacionActiva.precios[combustible]! * 1000);
        const mediaActual = preciosActuales.length ? Math.round(preciosActuales.reduce((suma, valor) => suma + valor, 0) / preciosActuales.length) : null;
        const maximoActual = preciosActuales.length ? Math.max(...preciosActuales) : null;
        const minimoActual = preciosActuales.length ? Math.min(...preciosActuales) : null;
        const diferencia = precioEstacion === null || mediaActual === null ? null : precioEstacion - mediaActual;
        contenedor.querySelector<HTMLElement>('[data-comparacion-nombre]')!.textContent = estacionActiva.rotulo;
        contenedor.querySelector<HTMLElement>('[data-comparacion-lugar]')!.textContent = `${cajaDeTitulo(estacionActiva.municipio)} · ${cajaDeTitulo(estacionActiva.direccion)}`;
        contenedor.querySelector<HTMLElement>('[data-comparacion-precio]')!.textContent = eur(precioEstacion);
        const comparacionDiferencia = contenedor.querySelector<HTMLElement>('[data-comparacion-diferencia]')!;
        comparacionDiferencia.textContent = diferencia === null ? 'No comparable' : `${diferencia > 0 ? '+' : '−'}${centimos(diferencia)} cts/L`;
        comparacionDiferencia.dataset.sentido = diferencia === null ? 'neutro' : diferencia > 0 ? 'caro' : 'barato';
        contenedor.querySelector<HTMLElement>('[data-comparacion-deposito]')!.textContent = diferencia === null ? '' : `${(Math.abs(diferencia) / 1000 * 50).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € ${diferencia <= 0 ? 'menos' : 'más'} por 50 L`;
        const anchoBarra = (valor: number | null): string => valor === null || minimoActual === null || maximoActual === null || maximoActual === minimoActual ? '50%' : `${45 + (valor - minimoActual) / (maximoActual - minimoActual) * 50}%`;
        contenedor.querySelector<HTMLElement>('[data-barra-estacion]')!.style.width = anchoBarra(precioEstacion);
        contenedor.querySelector<HTMLElement>('[data-barra-media]')!.style.width = anchoBarra(mediaActual);
        contenedor.querySelector<HTMLElement>('[data-barra-maximo]')!.style.width = anchoBarra(maximoActual);
        contenedor.querySelector<HTMLElement>('[data-valor-estacion]')!.textContent = eur(precioEstacion);
        contenedor.querySelector<HTMLElement>('[data-valor-media]')!.textContent = eur(mediaActual);
        contenedor.querySelector<HTMLElement>('[data-valor-maximo]')!.textContent = eur(maximoActual);
      }
      contenedor.querySelector<HTMLElement>('[data-leyenda-principal]')!.textContent = estacionActiva ? 'Estación' : esMovil ? 'Media' : 'Media provincial';
      contenedor.querySelector<HTMLElement>('[data-leyenda-secundaria]')!.textContent = estacionActiva ? (esMovil ? 'Media' : 'Media provincial') : esMovil ? 'Mínimo' : 'Precio mínimo';
      const tooltip = contenedor.querySelector<HTMLOutputElement>('[data-tooltip]')!;
      dibujarGrafico(contenedor.querySelector<SVGSVGElement>('.evolucion-grafico')!, tramo, contexto, tooltip, estacionActiva ? ['Estación', 'Media'] : ['Media', 'Mínimo']);
      const cambios = cambiosDeEstaciones(historico, combustible, periodo);
      pintarRanking('[data-bajadas]', agruparCambios(cambios.filter((c) => c.diferenciaMilesimas < 0), estaciones));
      pintarRanking('[data-subidas]', agruparCambios(cambios.filter((c) => c.diferenciaMilesimas > 0).reverse(), estaciones));
      contenedor.querySelector<HTMLElement>('.evolucion-ranking')!.hidden = false;
      const movimientosMovil = contenedor.querySelector<HTMLOListElement>('[data-movimientos-movil]')!; movimientosMovil.replaceChildren();
      const destacados = [cambios.filter((c) => c.diferenciaMilesimas > 0).at(-1), cambios.find((c) => c.diferenciaMilesimas < 0)].filter((c): c is CambioEstacion => Boolean(c));
      destacados.forEach((movimiento) => { const estacion = estaciones.find((e) => e.id === movimiento.estacionId); if (!estacion) return; const li = document.createElement('li'); const identidad = document.createElement('span'); const nombre = document.createElement('strong'); nombre.textContent = estacion.rotulo; const lugar = document.createElement('small'); lugar.textContent = cajaDeTitulo(estacion.municipio); identidad.append(nombre, lugar); const cifra = document.createElement('b'); cifra.textContent = `${movimiento.diferenciaMilesimas > 0 ? '+' : '−'}${centimos(movimiento.diferenciaMilesimas)} cts`; li.append(identidad, cifra); li.onclick = () => abrirEstacion(estacion); movimientosMovil.append(li); });
      const estacionesCombustible = estaciones.filter((e) => e.precios[combustible] !== null).sort((a, b) => (a.precios[combustible] ?? Infinity) - (b.precios[combustible] ?? Infinity));
      contenedor.querySelector<HTMLElement>('[data-sheet-contador]')!.textContent = `${estacionesCombustible.length} resultados · ordenadas por precio`;
      const listaSheet = contenedor.querySelector<HTMLOListElement>('[data-sheet-lista]')!; listaSheet.replaceChildren();
      estacionesCombustible.forEach((estacion, indice) => {
        const li = document.createElement('li'); const boton = document.createElement('button'); boton.type = 'button';
        const posicion = document.createElement('i'); posicion.textContent = String(indice + 1);
        const identidad = document.createElement('span'); const nombre = document.createElement('strong'); nombre.textContent = estacion.rotulo; const lugar = document.createElement('small'); lugar.textContent = cajaDeTitulo(estacion.municipio); identidad.append(nombre, lugar);
        const precio = document.createElement('b'); precio.textContent = (estacion.precios[combustible] ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 3 });
        boton.append(posicion, identidad, precio); boton.onclick = () => { cerrarSheet(); abrirEstacion(estacion); }; li.append(boton); listaSheet.append(li);
      });
      const detalle = contenedor.querySelector<HTMLElement>('[data-detalle-estacion]')!; detalle.hidden = !estacionActiva;
      if (estacionActiva) { contenedor.querySelector<HTMLElement>('[data-estacion-titulo]')!.textContent = estacionActiva.rotulo; contenedor.querySelector<HTMLElement>('[data-estacion-resumen]')!.textContent = `${cajaDeTitulo(estacionActiva.direccion)}, ${cajaDeTitulo(estacionActiva.municipio)}.`; }
    };
    botonesCombustible.forEach((b) => b.onclick = () => { combustible = b.dataset.clave as ClavePrecio; render(); });
    botonesPeriodo.forEach((b) => b.onclick = () => { periodo = Number(b.dataset.periodo) as 7 | 30 | 90; render(); });
    const actualizarBusqueda = (): void => {
      const consulta = buscar.value.trim(); const q = consulta.toLocaleLowerCase('es'); resultados.replaceChildren();
      limpiarBusqueda.hidden = consulta.length === 0;
      if (q.length < 2) { resumenBusqueda.hidden = true; resumenBusqueda.textContent = ''; return; }
      const coincidencias = estaciones.filter((e) => `${e.rotulo} ${e.municipio} ${e.direccion}`.toLocaleLowerCase('es').includes(q));
      resumenBusqueda.textContent = `“${consulta}” · ${coincidencias.length} ${coincidencias.length === 1 ? 'resultado' : 'resultados'}`; resumenBusqueda.hidden = false;
      coincidencias.slice(0, 8).forEach((estacion) => {
        const li = document.createElement('li'); const boton = document.createElement('button'); boton.type = 'button';
        const identidad = document.createElement('span'); const nombre = document.createElement('strong'); nombre.textContent = estacion.rotulo; const lugar = document.createElement('small'); lugar.textContent = `${cajaDeTitulo(estacion.municipio)} · ${cajaDeTitulo(estacion.direccion)}`; identidad.append(nombre, lugar);
        const precio = document.createElement('b'); precio.textContent = estacion.precios[combustible] === null ? 'No vende' : estacion.precios[combustible]!.toLocaleString('es-ES', { minimumFractionDigits: 3 }); boton.append(identidad, precio); boton.onclick = () => abrirEstacion(estacion); li.append(boton); resultados.append(li);
      });
    };
    buscar.oninput = actualizarBusqueda;
    limpiarBusqueda.onclick = () => { buscar.value = ''; actualizarBusqueda(); buscar.focus(); };
    const buscarSheet = contenedor.querySelector<HTMLInputElement>('[data-buscar-estacion-sheet]')!;
    buscarSheet.oninput = () => { const q = buscarSheet.value.trim().toLocaleLowerCase('es'); contenedor.querySelectorAll<HTMLElement>('[data-sheet-lista] > li').forEach((li) => { li.hidden = q.length > 0 && !li.textContent!.toLocaleLowerCase('es').includes(q); }); };
    contenedor.querySelector<HTMLButtonElement>('[data-cerrar-estacion]')!.onclick = () => { estacionActiva = null; actualizarUrl(); render(); };
    estado.hidden = true; contenedor.querySelector<HTMLElement>('[data-contenido]')!.hidden = false; render();
  } catch (error) { estado.textContent = `No hemos podido cargar la evolución. ${error instanceof Error ? error.message : ''}`; estado.dataset.tipo = 'error'; }
}
