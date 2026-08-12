import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { z } from 'zod';

import { parsearEstadoHistorico, type EstadoHistorico } from './estado-historico.ts';

export interface ManifiestoHistorico {
  version: 1;
  desde: string;
  hasta: string;
  dias: number;
  estaciones: number;
  estado: string;
  sha256: string;
  /** Copia de `EstadoHistorico.mock`: permite detectar un despliegue de
   *  prueba leyendo solo el manifiesto, sin descomprimir el estado. */
  mock?: true;
}

const ManifiestoHistoricoEsquema = z.object({
  version: z.literal(1),
  desde: z.string(),
  hasta: z.string(),
  dias: z.number().int().min(1).max(90),
  estaciones: z.number().int().min(0),
  estado: z.string().regex(/^[a-zA-Z0-9._-]+$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  mock: z.literal(true).optional(),
});

export class ErrorRecuperacionHistorico extends Error {
  constructor(mensaje: string, opciones?: ErrorOptions) {
    super(mensaje, opciones);
    this.name = 'ErrorRecuperacionHistorico';
  }
}

async function pedir(respuestaUrl: URL, fetchImpl: typeof fetch): Promise<Response> {
  const respuesta = await fetchImpl(respuestaUrl, {
    headers: { Accept: 'application/json, application/gzip' },
    cache: 'no-store',
  });
  if (!respuesta.ok) {
    throw new ErrorRecuperacionHistorico(
      `El despliegue histórico respondió ${respuesta.status} en ${respuestaUrl}.`,
    );
  }
  return respuesta;
}

export async function recuperarEstadoDesplegado(
  base: string,
  opciones: { fetch?: typeof fetch; cachebuster?: string } = {},
): Promise<{ manifiesto: ManifiestoHistorico; estado: EstadoHistorico }> {
  const fetchImpl = opciones.fetch ?? fetch;
  const cachebuster = opciones.cachebuster ?? Date.now().toString();
  const urlManifiesto = new URL('manifiesto.json', base);
  urlManifiesto.searchParams.set('v', cachebuster);

  let valorManifiesto: unknown;
  try {
    valorManifiesto = await (await pedir(urlManifiesto, fetchImpl)).json();
  } catch (error) {
    if (error instanceof ErrorRecuperacionHistorico) throw error;
    throw new ErrorRecuperacionHistorico('No se pudo leer el manifiesto histórico.', { cause: error });
  }
  const resultado = ManifiestoHistoricoEsquema.safeParse(valorManifiesto);
  if (!resultado.success) {
    throw new ErrorRecuperacionHistorico(
      `El manifiesto histórico no cumple el contrato: ${resultado.error.message}`,
    );
  }
  const manifiesto = resultado.data;
  const urlEstado = new URL(manifiesto.estado, base);
  urlEstado.searchParams.set('v', manifiesto.sha256);
  const comprimido = new Uint8Array(await (await pedir(urlEstado, fetchImpl)).arrayBuffer());
  if (comprimido.byteLength > 10 * 1024 * 1024) {
    throw new ErrorRecuperacionHistorico(`El estado histórico comprimido ocupa ${comprimido.byteLength} B.`);
  }
  const sha256 = createHash('sha256').update(comprimido).digest('hex');
  if (sha256 !== manifiesto.sha256) {
    throw new ErrorRecuperacionHistorico(
      `SHA-256 histórico incorrecto: se esperaba ${manifiesto.sha256} y llegó ${sha256}.`,
    );
  }

  let valorEstado: unknown;
  try {
    const json = gunzipSync(comprimido, { maxOutputLength: 50 * 1024 * 1024 }).toString('utf8');
    valorEstado = JSON.parse(json);
  } catch (error) {
    throw new ErrorRecuperacionHistorico('No se pudo descomprimir o leer el estado histórico.', {
      cause: error,
    });
  }
  const estado = parsearEstadoHistorico(valorEstado);
  if (
    estado.fechas[0] !== manifiesto.desde ||
    estado.fechas.at(-1) !== manifiesto.hasta ||
    estado.fechas.length !== manifiesto.dias ||
    estado.estaciones.length !== manifiesto.estaciones ||
    Boolean(estado.mock) !== Boolean(manifiesto.mock)
  ) {
    throw new ErrorRecuperacionHistorico('El manifiesto no describe el estado histórico descargado.');
  }
  return { manifiesto, estado };
}
