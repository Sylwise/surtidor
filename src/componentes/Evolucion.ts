import { COMBUSTIBLES_EVOLUCION, ETIQUETA, combustibleDisponibleEnEvolucion, esClavePrecio } from '../logica/combustibles.ts';
import { mensajeAquiNoHay, mensajeCombustibleNoDisponibleEnEvolucion, mensajeHistoricoInsuficiente, mensajeNoVende, mensajeSinDato } from '../logica/mensajesAusencia.ts';
import { cajaDeTitulo, formatearPrecio, nombreVisible } from '../logica/formato.ts';
import { cambioEnPeriodo, cambiosDeEstaciones, estabilidadObservada, serieDeEstacion, serieMedia, serieMinimo, validarHistoricoPublico, type CambioEstacion, type PeriodoEvolucion, type PuntoEvolucion } from '../logica/evolucion.ts';
import { explicarEvolucion } from '../logica/explicacionEvolucion.ts';
import { distanciaKm, formatearDistancia, mensajeErrorGeolocalizacion, type PosicionUsuario } from '../logica/cercania.ts';
import { estaAbierta } from '../../scripts/lib/horario.ts';
import type { AgregadoHistorico } from '../../scripts/lib/artefactos-historicos.ts';
import type { ClavePrecioHistorico, DatosProvincia, Estacion } from '../../scripts/lib/tipos.ts';
import { bandaPrecio, crearEscala, explicacionEscalaSuprimida } from '../logica/escala.ts';
import { clasificarGestoGrafico } from '../logica/gestoGrafico.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';
function eur(milesimas: number | null): string {
  return milesimas === null ? mensajeSinDato() : `${(milesimas / 1000).toLocaleString('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} €/L`;
}

function eurTooltip(milesimas: number | null): string {
  return milesimas === null ? mensajeSinDato() : `${formatearPrecio(milesimas / 1000)} €`;
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

function dibujarGrafico(
  svg: SVGSVGElement,
  principal: PuntoEvolucion[],
  secundaria: PuntoEvolucion[],
  tooltip: HTMLOutputElement,
  etiquetas: [string, string, string?],
  terciaria: PuntoEvolucion[] | null = null,
): void {
  svg.replaceChildren();
  const valores = [...principal, ...secundaria, ...(terciaria ?? [])].flatMap((p) => p.milesimas === null ? [] : [p.milesimas]);
  if (valores.length < 2) return;
  const esMovil = window.matchMedia('(max-width: 760px)').matches;
  const ancho = esMovil ? 560 : 900;
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
  const seriesDibujadas: Array<[PuntoEvolucion[], string]> = [
    [secundaria, terciaria ? 'evolucion-grafico__municipio' : 'evolucion-grafico__provincia'],
    ...(terciaria ? [[terciaria, 'evolucion-grafico__provincia'] as [PuntoEvolucion[], string]] : []),
    [principal, 'evolucion-grafico__estacion'],
  ];
  seriesDibujadas.forEach(([serie, clase]) => tramos(serie, x, y).forEach((d) => { const path = document.createElementNS(SVG_NS, 'path'); path.setAttribute('d', d); path.setAttribute('class', clase); svg.append(path); }));
  const ejeX = document.createElementNS(SVG_NS, 'line'); ejeX.setAttribute('x1', String(izquierda)); ejeX.setAttribute('x2', String(ancho - derecha)); ejeX.setAttribute('y1', String(alto - abajo)); ejeX.setAttribute('y2', String(alto - abajo)); ejeX.setAttribute('class', 'evolucion-grafico__eje-x'); svg.append(ejeX);
  [0, principal.length - 1].forEach((indice) => { const texto = document.createElementNS(SVG_NS, 'text'); texto.setAttribute('x', String(x(indice))); texto.setAttribute('y', String(alto - 10)); texto.setAttribute('text-anchor', indice === 0 ? 'start' : 'end'); texto.setAttribute('class', 'evolucion-grafico__fecha'); texto.textContent = fecha(principal[indice]!.fecha); svg.append(texto); });
  let fijado = esMovil;
  let indiceActivo = principal.length - 1;
  let gestoTactil: { pointerId: number; inicioX: number; inicioY: number; recorriendo: boolean } | null = null;
  let ultimoPunteroTactil = -Infinity;
  const guia = document.createElementNS(SVG_NS, 'line'); guia.setAttribute('y1', String(arriba)); guia.setAttribute('y2', String(alto - abajo)); guia.setAttribute('class', 'evolucion-grafico__guia');
  const marcador = document.createElementNS(SVG_NS, 'circle'); marcador.setAttribute('r', '6'); marcador.setAttribute('class', 'evolucion-grafico__marcador-eje'); svg.append(guia, marcador);
  const mostrarGuia = (visible: boolean): void => { guia.setAttribute('visibility', visible ? 'visible' : 'hidden'); marcador.setAttribute('visibility', visible ? 'visible' : 'hidden'); };
  mostrarGuia(false);
  const mostrarIndice = (indice: number, posicionX?: number, posicionY?: number): void => {
    indiceActivo = Math.max(0, Math.min(principal.length - 1, indice));
    const punto = principal[indiceActivo]!; const comparador = secundaria[indiceActivo]?.milesimas ?? null; const comparadorTerciario = terciaria?.[indiceActivo]?.milesimas ?? null;
    const tituloTooltip = document.createElement('strong'); tituloTooltip.className = 'evolucion-tooltip__fecha'; tituloTooltip.textContent = fechaTooltip(punto.fecha);
    const crearFila = (etiqueta: string, milesimas: number | null, secundariaFila = false): HTMLSpanElement => {
      const fila = document.createElement('span'); fila.className = secundariaFila ? 'evolucion-tooltip__fila evolucion-tooltip__fila--secundaria' : 'evolucion-tooltip__fila';
      const muestra = document.createElement('i'); muestra.className = 'evolucion-tooltip__muestra'; muestra.ariaHidden = 'true';
      const nombre = document.createElement('span'); nombre.textContent = esMovil && etiqueta === 'Media' ? 'Media provincial' : etiqueta;
      const cifra = document.createElement('b'); cifra.textContent = eurTooltip(milesimas);
      if (milesimas !== null) { const unidad = document.createElement('span'); unidad.className = 'evolucion-tooltip__unidad'; unidad.textContent = '/L'; cifra.append(unidad); }
      fila.append(muestra, nombre, cifra); return fila;
    };
    const filaPrincipal = crearFila(etiquetas[0], punto.milesimas);
    const filaSecundaria = crearFila(etiquetas[1], comparador, true);
    const filaTerciaria = etiquetas[2] ? crearFila(etiquetas[2], comparadorTerciario, true) : null;
    if (filaTerciaria) filaTerciaria.classList.add('evolucion-tooltip__fila--terciaria');
    const anterior = principal[indiceActivo - 1]?.milesimas ?? null;
    const variacion = document.createElement('small'); variacion.className = 'evolucion-tooltip__cambio';
    if (punto.milesimas !== null && anterior !== null) { const diferencia = punto.milesimas - anterior; variacion.textContent = `${diferencia > 0 ? '+' : diferencia < 0 ? '−' : ''}${centimos(diferencia)} cts desde ayer`; }
    else {
      variacion.classList.add('evolucion-tooltip__cambio--sin-dato');
      variacion.textContent = punto.milesimas === null ? mensajeSinDato() : mensajeHistoricoInsuficiente(1);
    }
    tooltip.replaceChildren(tituloTooltip, variacion, filaPrincipal, filaSecundaria, ...(filaTerciaria ? [filaTerciaria] : []));
    tooltip.hidden = false;
    if (esMovil) {
      tooltip.style.removeProperty('left');
      tooltip.style.removeProperty('top');
    } else {
      const caja = svg.getBoundingClientRect();
      const matriz = svg.getScreenCTM();
      const posicionPunto = matriz ? new DOMPoint(x(indiceActivo), punto.milesimas === null ? alto / 2 : y(punto.milesimas)).matrixTransform(matriz) : null;
      const pxCss = posicionX ?? (posicionPunto ? posicionPunto.x - caja.left : x(indiceActivo) / ancho * caja.width);
      const pyCss = posicionY ?? (posicionPunto ? posicionPunto.y - caja.top : (punto.milesimas === null ? alto / 2 : y(punto.milesimas)) / alto * caja.height);
      const anchoTooltip = tooltip.offsetWidth;
      const altoTooltip = tooltip.offsetHeight;
      tooltip.style.left = `${Math.max(8, Math.min(caja.width - anchoTooltip - 8, pxCss - (pxCss > caja.width * .65 ? anchoTooltip + 10 : 0)))}px`;
      tooltip.style.top = `${Math.max(8, Math.min(caja.height - altoTooltip - 8, pyCss - altoTooltip - 10))}px`;
    }
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
  svg.onpointerdown = (evento) => {
    if (evento.pointerType === 'mouse') return;
    ultimoPunteroTactil = Date.now();
    gestoTactil = { pointerId: evento.pointerId, inicioX: evento.clientX, inicioY: evento.clientY, recorriendo: false };
  };
  svg.onpointermove = (evento) => {
    if (evento.pointerType === 'mouse') { mostrar(evento); return; }
    if (!gestoTactil || gestoTactil.pointerId !== evento.pointerId) return;
    const intencion = clasificarGestoGrafico(evento.clientX - gestoTactil.inicioX, evento.clientY - gestoTactil.inicioY);
    if (intencion === 'pendiente') return;
    if (intencion === 'desplazar') { gestoTactil = null; return; }
    if (!gestoTactil.recorriendo) {
      gestoTactil.recorriendo = true;
      svg.setPointerCapture(evento.pointerId);
    }
    evento.preventDefault();
    fijado = true;
    mostrar(evento);
  };
  svg.onpointerup = (evento) => {
    if (evento.pointerType === 'mouse' || !gestoTactil || gestoTactil.pointerId !== evento.pointerId) return;
    ultimoPunteroTactil = Date.now();
    const intencion = clasificarGestoGrafico(evento.clientX - gestoTactil.inicioX, evento.clientY - gestoTactil.inicioY);
    const debeSeleccionar = gestoTactil.recorriendo || intencion === 'pendiente';
    if (svg.hasPointerCapture(evento.pointerId)) svg.releasePointerCapture(evento.pointerId);
    gestoTactil = null;
    if (!debeSeleccionar) return;
    fijado = true;
    mostrar(evento);
  };
  svg.onpointercancel = (evento) => {
    if (gestoTactil?.pointerId === evento.pointerId) gestoTactil = null;
  };
  svg.onpointerleave = (evento) => { if (evento.pointerType === 'mouse' && !fijado) { tooltip.hidden = true; mostrarGuia(false); } };
  svg.onclick = (evento) => {
    const tipoPuntero = (evento as PointerEvent).pointerType;
    if ((tipoPuntero && tipoPuntero !== 'mouse') || Date.now() - ultimoPunteroTactil < 700) return;
    const matriz = svg.getScreenCTM(); if (!matriz) return; const py = new DOMPoint((evento as PointerEvent).clientX, (evento as PointerEvent).clientY).matrixTransform(matriz.inverse()).y;
    if (py < arriba || py > alto - abajo) { fijado = false; tooltip.hidden = true; mostrarGuia(false); return; }
    fijado = !fijado; mostrar(evento as PointerEvent);
  };
  svg.onkeydown = (evento) => { if (evento.key === 'Escape') { fijado = false; tooltip.hidden = true; mostrarGuia(false); return; } if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(evento.key)) return; evento.preventDefault(); if (evento.key === 'Home') indiceActivo = 0; else if (evento.key === 'End') indiceActivo = principal.length - 1; else indiceActivo += evento.key === 'ArrowLeft' ? -1 : 1; mostrarIndice(indiceActivo); };
  if (esMovil) mostrarIndice(indiceActivo);
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
    const estacionesPublicas = actual.estaciones.filter((estacion) => estacion.tipoVenta === 'P');
    if (!estaciones.length) throw new Error('No hay estaciones con histórico en esta provincia.');
    const parametrosIniciales = new URLSearchParams(location.search);
    const combustibleSolicitadoCrudo = parametrosIniciales.get('combustible');
    if (combustibleSolicitadoCrudo !== null && !esClavePrecio(combustibleSolicitadoCrudo)) {
      throw new Error('El combustible solicitado no es válido.');
    }
    const combustibleSolicitado = esClavePrecio(combustibleSolicitadoCrudo) ? combustibleSolicitadoCrudo : null;
    if (combustibleSolicitado && !combustibleDisponibleEnEvolucion(combustibleSolicitado)) {
      estado.textContent = mensajeCombustibleNoDisponibleEnEvolucion(combustibleSolicitado);
      estado.dataset.tipo = 'aviso';
      return;
    }
    const periodoSolicitado = Number(parametrosIniciales.get('periodo'));
    let combustible: ClavePrecioHistorico = combustibleSolicitado && combustibleDisponibleEnEvolucion(combustibleSolicitado) ? combustibleSolicitado : COMBUSTIBLES_EVOLUCION[0];
    let periodo: PeriodoEvolucion = [1, 7, 30, 90].includes(periodoSolicitado) ? periodoSolicitado as PeriodoEvolucion : 30;
    let filtroSheet: 'baratas' | 'cercanas' | 'abiertas' = 'baratas';
    let ubicacionUsuario: PosicionUsuario | null = null;
    let pidiendoUbicacion = false;
    const estacionSolicitada = parametrosIniciales.get('estacion');
    let estacionActiva: Estacion | null = estaciones.find((e) => e.id === estacionSolicitada) ?? null;
    const historicoPorEstacion = new Map(historico.estaciones.map((serie) => [serie[0], serie]));
    const municipioIdDeEstacion = (estacion: Estacion | null): string | null => estacion ? historicoPorEstacion.get(estacion.id)?.[1] ?? null : null;
    const nombreMunicipioDeId = (municipioId: string | null): string | null => {
      if (!municipioId) return null;
      const estacion = estaciones.find((candidata) => historicoPorEstacion.get(candidata.id)?.[1] === municipioId);
      return estacion ? nombreVisible(estacion.municipio, 'municipio') : null;
    };
    const normalizarMunicipio = (nombre: string): string => nombre.trim().toLocaleLowerCase('es');
    const municipioSolicitado = normalizarMunicipio(parametrosIniciales.get('municipio') ?? '');
    const estacionDelMunicipioSolicitado = municipioSolicitado
      ? estaciones.find((estacion) => normalizarMunicipio(estacion.municipio) === municipioSolicitado || normalizarMunicipio(nombreVisible(estacion.municipio, 'municipio')) === municipioSolicitado)
      : null;
    let municipioIdActivo = municipioIdDeEstacion(estacionActiva ?? estacionDelMunicipioSolicitado ?? null);
    const destinosCombustible = [...contenedor.querySelectorAll<HTMLElement>('[data-combustibles]')];
    const etiquetaCompacta: Record<ClavePrecioHistorico, string> = { gasolina95e5: '95', gasoleoA: 'Diésel', gasolina98e5: '98', gasoleoPremium: 'Diésel +' };
    const etiquetaControl: Record<ClavePrecioHistorico, string> = { gasolina95e5: ETIQUETA.gasolina95e5, gasoleoA: ETIQUETA.gasoleoA, gasolina98e5: ETIQUETA.gasolina98e5, gasoleoPremium: 'Diésel +' };
    const botonesCombustible = destinosCombustible.flatMap((destino) => COMBUSTIBLES_EVOLUCION.map((clave) => { const boton = document.createElement('button'); boton.type = 'button'; boton.textContent = destino.closest('.evolucion-controles--movil') ? etiquetaCompacta[clave] : etiquetaControl[clave]; boton.ariaLabel = etiquetaControl[clave]; boton.dataset.clave = clave; destino.append(boton); return boton; }));
    const botonesPeriodo = [...contenedor.querySelectorAll<HTMLButtonElement>('[data-periodo]')];
    const botonesFiltroSheet = [...contenedor.querySelectorAll<HTMLButtonElement>('[data-filtro-sheet]')];
    const contadorSheet = contenedor.querySelector<HTMLElement>('[data-sheet-contador]')!;
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
    sheet.onkeydown = (evento) => {
      if (evento.key === 'Escape') { evento.preventDefault(); cerrarSheet(); return; }
      if (evento.key !== 'Tab') return;
      const focables = [...sheet.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href]')].filter((elemento) => elemento.offsetParent !== null);
      const primero = focables[0]; const ultimo = focables.at(-1);
      if (!primero || !ultimo) return;
      if (evento.shiftKey && document.activeElement === primero) { evento.preventDefault(); ultimo.focus(); }
      else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primero.focus(); }
    };

    const actualizarUrl = (): void => {
      const url = new URL(location.href);
      if (estacionActiva) url.searchParams.set('estacion', estacionActiva.id); else url.searchParams.delete('estacion');
      const nombreMunicipio = nombreMunicipioDeId(municipioIdActivo);
      if (nombreMunicipio) url.searchParams.set('municipio', nombreMunicipio); else url.searchParams.delete('municipio');
      if (combustible === 'gasolina95e5') url.searchParams.delete('combustible'); else url.searchParams.set('combustible', combustible);
      if (periodo === 30) url.searchParams.delete('periodo'); else url.searchParams.set('periodo', String(periodo));
      history.replaceState(null, '', url);
    };
    const abrirEstacion = (estacion: Estacion): void => { estacionActiva = estacion; municipioIdActivo = municipioIdDeEstacion(estacion); actualizarUrl(); buscar.value = ''; resultados.replaceChildren(); resumenBusqueda.hidden = true; limpiarBusqueda.hidden = true; render(); };
    const pintarRanking = (destino: string, grupos: GrupoCambio[]): boolean => {
      const lista = contenedor.querySelector<HTMLElement>(destino)!; lista.replaceChildren();
      lista.parentElement!.hidden = false;
      if (!grupos.length) {
        const li = document.createElement('li'); li.className = 'evolucion-ranking__vacio';
        const titulo = document.createElement('strong'); titulo.textContent = destino.includes('bajadas') ? 'No hubo bajadas' : 'No hubo subidas';
        const texto = document.createElement('small'); texto.textContent = `Ninguna estación cambió el precio de ${ETIQUETA[combustible]} en esta dirección durante ${periodo === 1 ? 'el último día' : `los últimos ${periodo} días`}.`;
        li.append(titulo, texto);
        if (periodo !== 30) { const ampliar = document.createElement('button'); ampliar.type = 'button'; ampliar.textContent = 'Ver periodo de 30 días →'; ampliar.onclick = () => { periodo = 30; actualizarUrl(); render(); }; li.append(ampliar); }
        lista.append(li); return false;
      }
      grupos.slice(0, 3).forEach((grupo) => { const li = document.createElement('li'); const boton = document.createElement('button'); boton.type = 'button'; const identidad = document.createElement('span'); const nombre = document.createElement('strong'); nombre.textContent = grupo.estaciones[0]!.rotulo; const detalle = document.createElement('small'); detalle.textContent = grupo.estaciones.length > 1 ? `${grupo.estaciones.length} estaciones con la misma serie` : `${cajaDeTitulo(grupo.estaciones[0]!.direccion)} · ${nombreVisible(grupo.estaciones[0]!.municipio, 'municipio')}`; identidad.append(nombre, detalle); const cifra = document.createElement('b'); cifra.textContent = `${grupo.representante.diferenciaMilesimas < 0 ? '−' : '+'}${(Math.abs(grupo.representante.diferenciaMilesimas) / 10).toLocaleString('es-ES', { maximumFractionDigits: 1 })} cts`; boton.append(identidad, cifra); boton.onclick = () => abrirEstacion(grupo.estaciones[0]!); li.append(boton); lista.append(li); });
      return true;
    };

    const render = (): void => {
      const esMovil = window.matchMedia('(max-width: 760px)').matches;
      botonesCombustible.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.clave === combustible)));
      botonesPeriodo.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.periodo) === periodo)));
      botonesFiltroSheet.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filtroSheet === filtroSheet)));
      const mediaProvincia = serieMedia(historico.provincia, historico.fechas, combustible);
      const minimoProvincia = serieMinimo(historico.provincia, historico.fechas, combustible);
      const agregadoMunicipio: AgregadoHistorico | null = municipioIdActivo ? historico.municipios[municipioIdActivo] ?? null : null;
      const mediaMunicipio = agregadoMunicipio ? serieMedia(agregadoMunicipio, historico.fechas, combustible) : null;
      const minimoMunicipio = agregadoMunicipio ? serieMinimo(agregadoMunicipio, historico.fechas, combustible) : null;
      const nombreMunicipioActivo = nombreMunicipioDeId(municipioIdActivo);
      contenedor.querySelector<HTMLElement>('[data-territorio-activo]')!.textContent = nombreMunicipioActivo ?? nombreVisible(actual.provincia.nombre, 'provincia');
      contenedor.querySelector<HTMLElement>('[data-territorio-activo-movil]')!.textContent = nombreMunicipioActivo ?? nombreVisible(actual.provincia.nombre, 'provincia');
      contenedor.querySelector<HTMLButtonElement>('[data-volver-provincia]')!.hidden = municipioIdActivo === null;
      const seriePrincipal = estacionActiva ? serieDeEstacion(historico, estacionActiva.id, combustible)! : mediaMunicipio ?? mediaProvincia;
      const serieSecundaria = estacionActiva ? mediaMunicipio ?? mediaProvincia : minimoMunicipio ?? minimoProvincia;
      const serieTerciaria = estacionActiva && mediaMunicipio ? mediaProvincia : null;
      const indiceInicio = periodo === 90 ? 0 : seriePrincipal.length - 1 - periodo;
      const tramo = seriePrincipal.slice(indiceInicio); const contexto = serieSecundaria.slice(indiceInicio); const contextoTerciario = serieTerciaria?.slice(indiceInicio) ?? null;
      const cambio = cambioEnPeriodo(seriePrincipal, periodo);
      const explicacion = estacionActiva ? null : explicarEvolucion(historico, estaciones, combustible, periodo, municipioIdActivo);
      const agregadoActivo = agregadoMunicipio ?? historico.provincia;
      const ultimoAgregado = agregadoActivo[combustible].at(-1) ?? [0, 0, null];
      contenedor.querySelector<HTMLElement>('[data-titulo-panel]')!.textContent = estacionActiva ? estacionActiva.rotulo : ETIQUETA[combustible];
      contenedor.querySelector<HTMLElement>('[data-ambito]')!.textContent = estacionActiva
        ? `${nombreVisible(estacionActiva.municipio, 'municipio')} · frente a municipio y provincia`
        : `Media de ${nombreMunicipioActivo ?? nombreVisible(actual.provincia.nombre, 'provincia')}`;
      const precioActualEstacion = estacionActiva?.precios[combustible] ?? null;
      contenedor.querySelector<HTMLElement>('[data-etiqueta-precio]')!.textContent = estacionActiva ? 'Precio actual' : 'Último cierre';
      contenedor.querySelector<HTMLElement>('[data-precio]')!.textContent = estacionActiva ? (precioActualEstacion === null ? mensajeNoVende() : eur(Math.round(precioActualEstacion * 1000))) : eur(seriePrincipal.at(-1)?.milesimas ?? null);
      const cambioElemento = contenedor.querySelector<HTMLElement>('[data-cambio]')!;
      const cambioMovilElemento = contenedor.querySelector<HTMLElement>('[data-cambio-movil]')!;
      const fraseDesktop = contenedor.querySelector<HTMLElement>('[data-frase-desktop]')!;
      const fraseMovil = contenedor.querySelector<HTMLElement>('[data-frase-movil]')!;
      if (!cambio) {
        cambioElemento.textContent = '—'; cambioMovilElemento.textContent = '—';
        fraseDesktop.textContent = estacionActiva && precioActualEstacion === null ? mensajeNoVende() : mensajeHistoricoInsuficiente(periodo);
        fraseMovil.textContent = fraseDesktop.textContent;
      }
      else {
        cambioElemento.textContent = cambio.diferenciaMilesimas === 0 ? 'Sin cambio' : `${cambio.diferenciaMilesimas > 0 ? '↗ +' : '↘ −'}${centimos(cambio.diferenciaMilesimas)} cts`;
        cambioMovilElemento.textContent = cambio.diferenciaMilesimas === 0 ? 'Sin cambio' : `${cambio.diferenciaMilesimas > 0 ? '+' : '−'}${centimos(cambio.diferenciaMilesimas)} cts`;
        const verbo = cambio.diferenciaMilesimas > 0 ? 'subido' : cambio.diferenciaMilesimas < 0 ? 'bajado' : 'seguido estable';
        fraseDesktop.textContent = `${estacionActiva ? estacionActiva.rotulo : `La ${ETIQUETA[combustible]}`} ha ${verbo} ${periodo === 1 ? 'en el último día' : `en los últimos ${periodo} días`}`;
        fraseMovil.textContent = periodo === 1 ? 'en 1 día' : `en ${periodo} días`;
      }
      const contextoTexto = contenedor.querySelector<HTMLElement>('[data-contexto]')!;
      contextoTexto.textContent = estacionActiva ? `Compárala con ${nombreMunicipioActivo ?? 'su municipio'} y ${nombreVisible(actual.provincia.nombre, 'provincia')} para saber si es un caso aislado.` : explicacion && explicacion.amplitud.proporcionAlineada !== null && explicacion.amplitud.comparables > 0
        ? `${explicacion.amplitud.alineadas} de ${explicacion.amplitud.comparables} estaciones ${cambio && cambio.diferenciaMilesimas < 0 ? 'bajaron' : 'subieron'}.`
        : 'No hay suficientes estaciones comparables para medir el alcance.';
      const estabilidadElemento = contenedor.querySelector<HTMLElement>('[data-estabilidad]')!;
      const estabilidad = estacionActiva && precioActualEstacion !== null ? estabilidadObservada(seriePrincipal) : null;
      estabilidadElemento.hidden = estabilidad === null;
      estabilidadElemento.textContent = estabilidad
        ? estabilidad.dias === 0
          ? 'El último cierre registra una variación.'
          : `Sin cambios detectados desde hace ${estabilidad.limitadaPorVentana ? 'al menos ' : ''}${estabilidad.dias} ${estabilidad.dias === 1 ? 'día' : 'días'}.`
        : '';
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
      const bloqueTramo = tramoElemento.closest<HTMLElement>('.evolucion-tramo')!;
      bloqueTramo.hidden = !explicacion?.tramoIntenso;
      if (explicacion?.tramoIntenso) tramoElemento.textContent = `${fecha(explicacion.tramoIntenso.desde)} – ${fecha(explicacion.tramoIntenso.hasta)} · ${explicacion.tramoIntenso.diferenciaMilesimas > 0 ? '+' : '−'}${centimos(explicacion.tramoIntenso.diferenciaMilesimas)} cts`;
      const etiquetaMedia = contenedor.querySelector<HTMLElement>('[data-etiqueta-media]')!;
      const etiquetaMinimo = contenedor.querySelector<HTMLElement>('[data-etiqueta-minimo]')!;
      const etiquetaMuestra = contenedor.querySelector<HTMLElement>('[data-etiqueta-muestra]')!;
      const resumenGraficoMovil = contenedor.querySelector<HTMLElement>('[data-resumen-grafico-movil]')!;
      const tituloGrafico = contenedor.querySelector<HTMLElement>('[data-titulo-grafico]')!;
      if (estacionActiva) {
        const comparables = estacionesPublicas.filter((e) => e.precios[combustible] !== null).sort((a, b) => (a.precios[combustible] ?? Infinity) - (b.precios[combustible] ?? Infinity));
        const puesto = comparables.findIndex((e) => e.id === estacionActiva!.id) + 1;
        etiquetaMedia.textContent = 'Estación · último cierre'; etiquetaMinimo.textContent = 'Media municipal · último cierre'; etiquetaMuestra.textContent = 'Media provincial · último cierre';
        contenedor.querySelector<HTMLElement>('[data-media]')!.textContent = eur(seriePrincipal.at(-1)?.milesimas ?? null);
        contenedor.querySelector<HTMLElement>('[data-minimo]')!.textContent = eur(mediaMunicipio?.at(-1)?.milesimas ?? null);
        contenedor.querySelector<HTMLElement>('[data-muestra]')!.textContent = eur(mediaProvincia.at(-1)?.milesimas ?? null);
        resumenGraficoMovil.textContent = puesto > 0
          ? `Media municipal: ${eur(mediaMunicipio?.at(-1)?.milesimas ?? null).replace(' €/L', '')} · Media provincial: ${eur(mediaProvincia.at(-1)?.milesimas ?? null).replace(' €/L', '')} · Puesto provincial: ${puesto} de ${comparables.length}`
          : `Media municipal ${eur(mediaMunicipio?.at(-1)?.milesimas ?? null).replace(' €/L', '')} · Media provincial ${eur(mediaProvincia.at(-1)?.milesimas ?? null).replace(' €/L', '')}`;
        tituloGrafico.textContent = 'Precio diario: estación, municipio y provincia';
      } else {
        etiquetaMedia.textContent = 'Media';
        etiquetaMinimo.textContent = 'Mínimo';
        etiquetaMuestra.textContent = 'Estaciones';
        contenedor.querySelector<HTMLElement>('[data-media]')!.textContent = eur(seriePrincipal.at(-1)?.milesimas ?? null);
        contenedor.querySelector<HTMLElement>('[data-minimo]')!.textContent = eur(ultimoAgregado[2]);
        contenedor.querySelector<HTMLElement>('[data-muestra]')!.textContent = String(ultimoAgregado[1]);
        resumenGraficoMovil.textContent = `Mín. ${eur(ultimoAgregado[2]).replace(' €/L', '')} · ${ultimoAgregado[1]} est.`;
        tituloGrafico.textContent = `Precio diario: media y mínimo ${municipioIdActivo ? 'municipal' : 'provincial'}`;
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
          const alternativa = COMBUSTIBLES_EVOLUCION.find((clave) => estacionActiva?.precios[clave] !== null);
          tituloVacio.textContent = mensajeNoVende();
          textoVacio.textContent = '';
          accionVacio.textContent = alternativa ? `Ver ${ETIQUETA[alternativa]} →` : nombreMunicipioActivo ? `Volver a la media de ${nombreMunicipioActivo} →` : 'Volver a la media provincial →';
          accionVacio.onclick = () => { if (alternativa) combustible = alternativa; else estacionActiva = null; actualizarUrl(); render(); };
        } else {
          tituloVacio.textContent = mensajeHistoricoInsuficiente(periodo);
          textoVacio.textContent = '';
          accionVacio.textContent = nombreMunicipioActivo ? `Volver a la media de ${nombreMunicipioActivo} →` : 'Volver a la media provincial →';
          accionVacio.onclick = () => { estacionActiva = null; actualizarUrl(); render(); };
        }
      }
      contenedor.querySelector<HTMLElement>('.evolucion-resumen')!.hidden = false;
      contenedor.querySelector<HTMLElement>('.evolucion-hitos')!.hidden = false;
      comparacionEstacion.hidden = estacionActiva === null || sinCombustible || sinHistorico;
      if (estacionActiva) {
        const preciosActuales = estacionesPublicas.flatMap((estacion) => estacion.precios[combustible] === null ? [] : [Math.round(estacion.precios[combustible]! * 1000)]);
        const preciosMunicipio = estacionesPublicas
          .filter((estacion) => municipioIdDeEstacion(estacion) === municipioIdActivo)
          .flatMap((estacion) => estacion.precios[combustible] === null ? [] : [Math.round(estacion.precios[combustible]! * 1000)]);
        const precioEstacion = estacionActiva.precios[combustible] === null ? null : Math.round(estacionActiva.precios[combustible]! * 1000);
        const mediaActual = preciosActuales.length ? Math.round(preciosActuales.reduce((suma, valor) => suma + valor, 0) / preciosActuales.length) : null;
        const mediaMunicipalActual = preciosMunicipio.length ? Math.round(preciosMunicipio.reduce((suma, valor) => suma + valor, 0) / preciosMunicipio.length) : null;
        const valoresComparacion = [precioEstacion, mediaMunicipalActual, mediaActual].filter((valor): valor is number => valor !== null);
        const maximoActual = valoresComparacion.length ? Math.max(...valoresComparacion) : null;
        const minimoActual = valoresComparacion.length ? Math.min(...valoresComparacion) : null;
        const diferencia = precioEstacion === null || mediaMunicipalActual === null ? null : precioEstacion - mediaMunicipalActual;
        contenedor.querySelector<HTMLElement>('[data-comparacion-nombre]')!.textContent = estacionActiva.rotulo;
        contenedor.querySelector<HTMLElement>('[data-comparacion-lugar]')!.textContent = `${nombreVisible(estacionActiva.municipio, 'municipio')} · ${cajaDeTitulo(estacionActiva.direccion)}`;
        contenedor.querySelector<HTMLElement>('[data-comparacion-precio]')!.textContent = eur(precioEstacion);
        const comparacionDiferencia = contenedor.querySelector<HTMLElement>('[data-comparacion-diferencia]')!;
        comparacionDiferencia.textContent = diferencia === null ? 'No comparable' : `${diferencia > 0 ? '+' : diferencia < 0 ? '−' : ''}${centimos(diferencia)} cts/L`;
        comparacionDiferencia.dataset.sentido = diferencia === null || diferencia === 0 ? 'neutro' : diferencia > 0 ? 'caro' : 'barato';
        contenedor.querySelector<HTMLElement>('[data-comparacion-deposito]')!.textContent = diferencia === null ? '' : `${(Math.abs(diferencia) / 1000 * 50).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € ${diferencia <= 0 ? 'menos' : 'más'} por 50 L`;
        const preciosPublicos = estacionesPublicas.flatMap((estacion) => estacion.precios[combustible] === null ? [] : [estacion.precios[combustible]!]);
        const escalaProvincia = crearEscala(preciosPublicos);
        const avisoEscala = contenedor.querySelector<HTMLElement>('[data-aviso-escala]')!;
        const explicacionEscala = explicacionEscalaSuprimida(escalaProvincia);
        avisoEscala.hidden = explicacionEscala === null;
        avisoEscala.textContent = explicacionEscala ?? '';
        const barraEstacion = contenedor.querySelector<HTMLElement>('[data-barra-estacion]')!;
        barraEstacion.dataset.banda = precioActualEstacion === null ? '' : bandaPrecio(precioActualEstacion, escalaProvincia);
        const anchoBarra = (valor: number | null): string => valor === null || minimoActual === null || maximoActual === null || maximoActual === minimoActual ? '50%' : `${45 + (valor - minimoActual) / (maximoActual - minimoActual) * 50}%`;
        barraEstacion.style.width = anchoBarra(precioEstacion);
        contenedor.querySelector<HTMLElement>('[data-barra-municipio]')!.style.width = anchoBarra(mediaMunicipalActual);
        contenedor.querySelector<HTMLElement>('[data-barra-provincia]')!.style.width = anchoBarra(mediaActual);
        contenedor.querySelector<HTMLElement>('[data-valor-estacion]')!.textContent = eur(precioEstacion);
        contenedor.querySelector<HTMLElement>('[data-valor-municipio]')!.textContent = eur(mediaMunicipalActual);
        contenedor.querySelector<HTMLElement>('[data-valor-provincia]')!.textContent = eur(mediaActual);
      }
      contenedor.querySelector<HTMLElement>('[data-leyenda-principal]')!.textContent = estacionActiva ? 'Estación' : esMovil ? 'Media' : `Media ${municipioIdActivo ? 'municipal' : 'provincial'}`;
      contenedor.querySelector<HTMLElement>('[data-leyenda-secundaria]')!.textContent = estacionActiva ? (esMovil ? 'Municipio' : 'Media municipal') : esMovil ? 'Mínimo' : 'Precio mínimo';
      contenedor.querySelector<HTMLElement>('[data-muestra-leyenda-secundaria]')!.className = estacionActiva ? 'municipio' : 'provincia';
      const leyendaTerciaria = contenedor.querySelector<HTMLElement>('[data-leyenda-terciaria-contenedor]')!;
      leyendaTerciaria.hidden = !serieTerciaria;
      contenedor.querySelector<HTMLElement>('[data-leyenda-terciaria]')!.textContent = 'Media provincial';
      const tooltip = contenedor.querySelector<HTMLOutputElement>('[data-tooltip]')!;
      const grafico = contenedor.querySelector<SVGSVGElement>('.evolucion-grafico')!;
      grafico.setAttribute('aria-label', `${tituloGrafico.textContent}. ${fraseDesktop.textContent}. ${cambioElemento.textContent}. Del ${fecha(tramo[0]!.fecha)} al ${fecha(tramo.at(-1)!.fecha)}. Los valores diarios están disponibles en la tabla de observaciones.`);
      dibujarGrafico(
        grafico,
        tramo,
        contexto,
        tooltip,
        estacionActiva ? ['Estación', 'Media municipal', 'Media provincial'] : [`Media ${municipioIdActivo ? 'municipal' : 'provincial'}`, 'Mínimo'],
        contextoTerciario,
      );

      const cabeceraPrincipal = contenedor.querySelector<HTMLElement>('[data-tabla-cabecera-principal]')!;
      const cabeceraSecundaria = contenedor.querySelector<HTMLElement>('[data-tabla-cabecera-secundaria]')!;
      const cabeceraTerciaria = contenedor.querySelector<HTMLElement>('[data-tabla-cabecera-terciaria]')!;
      cabeceraPrincipal.textContent = estacionActiva ? 'Estación' : `Media ${municipioIdActivo ? 'municipal' : 'provincial'}`;
      cabeceraSecundaria.textContent = estacionActiva ? 'Media municipal' : `Mínimo ${municipioIdActivo ? 'municipal' : 'provincial'}`;
      cabeceraTerciaria.textContent = 'Media provincial';
      cabeceraTerciaria.hidden = !serieTerciaria;
      const tabla = contenedor.querySelector<HTMLTableSectionElement>('[data-tabla-observaciones]')!;
      tabla.replaceChildren();
      const filasTabla = document.createDocumentFragment();
      const textoDato = (valor: number | null, n?: number): string => valor === null ? mensajeSinDato() : `${eur(valor)}${n === undefined ? '' : ` · n=${n}`}`;
      historico.fechas.forEach((fechaDia, indice) => {
        const fila = document.createElement('tr');
        const celdaFecha = document.createElement('th'); celdaFecha.scope = 'row'; celdaFecha.textContent = fechaTooltip(fechaDia);
        const celdaPrincipal = document.createElement('td');
        const nPrincipal = estacionActiva ? undefined : agregadoActivo[combustible][indice]?.[1] ?? 0;
        celdaPrincipal.textContent = textoDato(seriePrincipal[indice]?.milesimas ?? null, nPrincipal);
        const celdaSecundaria = document.createElement('td');
        const nSecundaria = estacionActiva ? agregadoMunicipio?.[combustible][indice]?.[1] ?? 0 : undefined;
        celdaSecundaria.textContent = textoDato(serieSecundaria[indice]?.milesimas ?? null, nSecundaria);
        fila.append(celdaFecha, celdaPrincipal, celdaSecundaria);
        if (serieTerciaria) {
          const celdaTerciaria = document.createElement('td');
          celdaTerciaria.textContent = textoDato(serieTerciaria[indice]?.milesimas ?? null, historico.provincia[combustible][indice]?.[1] ?? 0);
          fila.append(celdaTerciaria);
        }
        filasTabla.append(fila);
      });
      tabla.append(filasTabla);

      const cambios = cambiosDeEstaciones(historico, combustible, periodo, municipioIdActivo);
      pintarRanking('[data-bajadas]', agruparCambios(cambios.filter((c) => c.diferenciaMilesimas < 0), estaciones));
      pintarRanking('[data-subidas]', agruparCambios(cambios.filter((c) => c.diferenciaMilesimas > 0).reverse(), estaciones));
      contenedor.querySelector<HTMLElement>('.evolucion-ranking')!.hidden = false;
      const movimientosMovil = contenedor.querySelector<HTMLOListElement>('[data-movimientos-movil]')!; movimientosMovil.replaceChildren();
      const destacados = [cambios.filter((c) => c.diferenciaMilesimas > 0).at(-1), cambios.find((c) => c.diferenciaMilesimas < 0)].filter((c): c is CambioEstacion => Boolean(c));
      destacados.forEach((movimiento) => { const estacion = estaciones.find((e) => e.id === movimiento.estacionId); if (!estacion) return; const li = document.createElement('li'); const boton = document.createElement('button'); boton.type = 'button'; boton.ariaLabel = `Ver evolución de ${estacion.rotulo}, ${nombreVisible(estacion.municipio, 'municipio')}`; const identidad = document.createElement('span'); const nombre = document.createElement('strong'); nombre.textContent = estacion.rotulo; const lugar = document.createElement('small'); lugar.textContent = nombreVisible(estacion.municipio, 'municipio'); identidad.append(nombre, lugar); const cifra = document.createElement('b'); cifra.textContent = `${movimiento.diferenciaMilesimas > 0 ? '+' : '−'}${centimos(movimiento.diferenciaMilesimas)} cts`; boton.append(identidad, cifra); boton.onclick = () => abrirEstacion(estacion); li.append(boton); movimientosMovil.append(li); });
      let estacionesCombustible = estaciones.filter((e) => e.precios[combustible] !== null && (!municipioIdActivo || municipioIdDeEstacion(e) === municipioIdActivo));
      if (filtroSheet === 'abiertas') estacionesCombustible = estacionesCombustible.filter((e) => estaAbierta(e.horario, new Date()));
      const ordenarPorCercania = filtroSheet === 'cercanas' && ubicacionUsuario !== null;
      estacionesCombustible = ordenarPorCercania
        ? [...estacionesCombustible].sort((a, b) => distanciaKm(ubicacionUsuario!, a) - distanciaKm(ubicacionUsuario!, b) || a.id.localeCompare(b.id, 'es'))
        : [...estacionesCombustible].sort((a, b) => (a.precios[combustible] ?? Infinity) - (b.precios[combustible] ?? Infinity));
      contadorSheet.textContent = `${estacionesCombustible.length} resultados · ${ordenarPorCercania ? 'ordenadas por cercanía' : filtroSheet === 'abiertas' ? 'abiertas ahora' : 'ordenadas por precio'}`;
      const listaSheet = contenedor.querySelector<HTMLOListElement>('[data-sheet-lista]')!; listaSheet.replaceChildren();
      if (estacionesCombustible.length === 0) {
        const li = document.createElement('li'); const texto = document.createElement('small'); texto.textContent = filtroSheet === 'abiertas' ? 'Ninguna abierta ahora.' : mensajeAquiNoHay(combustible); li.append(texto); listaSheet.append(li);
      }
      estacionesCombustible.forEach((estacion, indice) => {
        const li = document.createElement('li'); const boton = document.createElement('button'); boton.type = 'button';
        const posicion = document.createElement('i'); posicion.textContent = ordenarPorCercania ? formatearDistancia(distanciaKm(ubicacionUsuario!, estacion)) : String(indice + 1);
        const identidad = document.createElement('span'); const nombre = document.createElement('strong'); nombre.textContent = estacion.rotulo; const lugar = document.createElement('small'); lugar.textContent = nombreVisible(estacion.municipio, 'municipio'); identidad.append(nombre, lugar);
        const precio = document.createElement('b'); precio.textContent = (estacion.precios[combustible] ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 3 });
        boton.append(posicion, identidad, precio); boton.onclick = () => { cerrarSheet(); abrirEstacion(estacion); }; li.append(boton); listaSheet.append(li);
      });
      const detalle = contenedor.querySelector<HTMLElement>('[data-detalle-estacion]')!; detalle.hidden = !estacionActiva;
      if (estacionActiva) {
        contenedor.querySelector<HTMLElement>('[data-estacion-titulo]')!.textContent = estacionActiva.rotulo;
        contenedor.querySelector<HTMLElement>('[data-estacion-resumen]')!.textContent = `${cajaDeTitulo(estacionActiva.direccion)}, ${nombreVisible(estacionActiva.municipio, 'municipio')}.`;
        contenedor.querySelector<HTMLButtonElement>('[data-cerrar-estacion]')!.textContent = nombreMunicipioActivo ? `← Media de ${nombreMunicipioActivo}` : '← Media provincial';
      }
    };
    botonesCombustible.forEach((b) => b.onclick = () => { combustible = b.dataset.clave as ClavePrecioHistorico; actualizarUrl(); render(); });
    botonesPeriodo.forEach((b) => b.onclick = () => { periodo = Number(b.dataset.periodo) as PeriodoEvolucion; actualizarUrl(); render(); });
    const pedirUbicacion = (): void => {
      if (pidiendoUbicacion) return;
      if (!('geolocation' in navigator)) { contadorSheet.textContent = 'Este navegador no admite geolocalización.'; return; }
      pidiendoUbicacion = true;
      navigator.geolocation.getCurrentPosition(
        (posicion) => { pidiendoUbicacion = false; ubicacionUsuario = { lat: posicion.coords.latitude, lon: posicion.coords.longitude }; render(); },
        (error) => { pidiendoUbicacion = false; filtroSheet = 'baratas'; render(); contadorSheet.textContent = mensajeErrorGeolocalizacion(error); },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
      );
    };
    botonesFiltroSheet.forEach((b) => b.onclick = () => {
      const filtro = b.dataset.filtroSheet as 'baratas' | 'cercanas' | 'abiertas';
      filtroSheet = filtro;
      if (filtro === 'cercanas' && !ubicacionUsuario) { render(); pedirUbicacion(); return; }
      render();
    });
    contenedor.querySelector<HTMLButtonElement>('[data-volver-provincia]')!.onclick = () => { estacionActiva = null; municipioIdActivo = null; actualizarUrl(); render(); };
    const actualizarBusqueda = (): void => {
      const consulta = buscar.value.trim(); const q = consulta.toLocaleLowerCase('es'); resultados.replaceChildren();
      limpiarBusqueda.hidden = consulta.length === 0;
      if (q.length < 2) { resumenBusqueda.hidden = true; resumenBusqueda.textContent = ''; return; }
      const coincidencias = estaciones.filter((e) => `${e.rotulo} ${e.municipio} ${e.direccion}`.toLocaleLowerCase('es').includes(q));
      resumenBusqueda.textContent = `“${consulta}” · ${coincidencias.length} ${coincidencias.length === 1 ? 'resultado' : 'resultados'}`; resumenBusqueda.hidden = false;
      coincidencias.slice(0, 8).forEach((estacion) => {
        const li = document.createElement('li'); const boton = document.createElement('button'); boton.type = 'button';
        const identidad = document.createElement('span'); const nombre = document.createElement('strong'); nombre.textContent = estacion.rotulo; const lugar = document.createElement('small'); lugar.textContent = `${nombreVisible(estacion.municipio, 'municipio')} · ${cajaDeTitulo(estacion.direccion)}`; identidad.append(nombre, lugar);
        const precio = document.createElement('b'); precio.textContent = estacion.precios[combustible] === null ? mensajeNoVende() : estacion.precios[combustible]!.toLocaleString('es-ES', { minimumFractionDigits: 3 }); boton.append(identidad, precio); boton.onclick = () => abrirEstacion(estacion); li.append(boton); resultados.append(li);
      });
    };
    buscar.oninput = actualizarBusqueda;
    limpiarBusqueda.onclick = () => { buscar.value = ''; actualizarBusqueda(); buscar.focus(); };
    const buscarSheet = contenedor.querySelector<HTMLInputElement>('[data-buscar-estacion-sheet]')!;
    buscarSheet.oninput = () => { const q = buscarSheet.value.trim().toLocaleLowerCase('es'); contenedor.querySelectorAll<HTMLElement>('[data-sheet-lista] > li').forEach((li) => { li.hidden = q.length > 0 && !li.textContent!.toLocaleLowerCase('es').includes(q); }); };
    contenedor.querySelector<HTMLButtonElement>('[data-cerrar-estacion]')!.onclick = () => { estacionActiva = null; actualizarUrl(); render(); };
    estado.hidden = true; contenedor.querySelector<HTMLElement>('[data-contenido]')!.hidden = false; actualizarUrl(); render();
  } catch (error) { estado.textContent = `No hemos podido cargar la evolución. ${error instanceof Error ? error.message : ''}`; estado.dataset.tipo = 'error'; }
}
