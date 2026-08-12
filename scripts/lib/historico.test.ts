import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ayerEnMadrid,
  desplazarFecha,
  fechaIsoAMiteco,
  fechasDeVentana,
  normalizarRespuestaHistorica,
  obtenerInstantaneaHistorica,
  parsearInstantaneaHistorica,
} from './historico.ts';

function fila(extra: Record<string, string> = {}): Record<string, string> {
  return {
    IDEESS: '1234',
    IDProvincia: '01',
    IDMunicipio: '01059',
    'Tipo Venta': 'P',
    'Precio Gasolina 95 E5': '1,429',
    'Precio Gasoleo A': '1,389',
    'Precio Gasolina 98 E5': '',
    'Precio Gasoleo Premium': '1,509',
    ...extra,
  };
}

function respuesta(filas: Record<string, string>[] = [fila()]) {
  return {
    Fecha: '09/08/2026 0:00:00',
    ResultadoConsulta: 'OK',
    ListaEESSPrecio: filas,
  };
}

test('convierte fechas ISO al formato de ruta y rechaza fechas imposibles', () => {
  assert.equal(fechaIsoAMiteco('2026-08-09'), '09-08-2026');
  assert.throws(() => fechaIsoAMiteco('2026-02-30'), /inexistente/);
  assert.throws(() => fechaIsoAMiteco('09-08-2026'), /AAAA-MM-DD/);
});

test('genera una ventana inclusiva y atraviesa cambios de mes y año', () => {
  assert.deepEqual(fechasDeVentana('2026-01-02', 4), [
    '2025-12-30',
    '2025-12-31',
    '2026-01-01',
    '2026-01-02',
  ]);
  assert.equal(desplazarFecha('2024-02-28', 1), '2024-02-29');
});

test('calcula ayer civil en Madrid alrededor del cambio de día UTC', () => {
  assert.equal(ayerEnMadrid(new Date('2026-08-09T22:30:00Z')), '2026-08-09');
  assert.equal(ayerEnMadrid(new Date('2026-01-01T00:30:00Z')), '2025-12-31');
});

test('compacta precios como milésimas, conserva IDs territoriales y ordena por IDEESS', () => {
  const resultado = normalizarRespuestaHistorica(
    respuesta([
      fila({ IDEESS: '20', 'Precio Gasolina 95 E5': '1,4' }),
      fila({ IDEESS: '10', IDProvincia: '28', IDMunicipio: '28079' }),
    ]),
    '2026-08-09',
  );

  assert.deepEqual(resultado, {
    version: 1,
    fecha: '2026-08-09',
    estaciones: [
      ['10', '28', '28079', 1429, 1389, null, 1509],
      ['20', '01', '01059', 1400, 1389, null, 1509],
    ],
  });
});

test('acepta claves escapadas y Tipo Venta histórico en minúscula', () => {
  const normal = fila({ 'Tipo Venta': 'p' });
  const escapada = Object.fromEntries(
    Object.entries(normal).map(([clave, valor]) => [
      clave.replaceAll(' ', '_x0020_'),
      valor,
    ]),
  );

  const resultado = normalizarRespuestaHistorica(respuesta([escapada]), '2026-08-09');
  assert.equal(resultado.estaciones.length, 1);
  assert.equal(resultado.estaciones[0]?.[3], 1429);
});

test('excluye venta no pública y rechaza códigos desconocidos', () => {
  const resultado = normalizarRespuestaHistorica(
    respuesta([fila({ IDEESS: '1' }), fila({ IDEESS: '2', 'Tipo Venta': 'A' })]),
    '2026-08-09',
  );
  assert.deepEqual(resultado.estaciones.map(([id]) => id), ['1']);

  assert.throws(
    () => normalizarRespuestaHistorica(respuesta([fila({ 'Tipo Venta': '?' })]), '2026-08-09'),
    /Tipo Venta histórico inesperado/,
  );
});

test('rechaza fecha distinta, IDEESS duplicado y precio mal formado', () => {
  assert.throws(
    () => normalizarRespuestaHistorica(respuesta(), '2026-08-08'),
    /se solicitó 2026-08-08/,
  );
  assert.throws(
    () => normalizarRespuestaHistorica(respuesta([fila(), fila()]), '2026-08-09'),
    /IDEESS histórico duplicado/,
  );
  assert.throws(
    () =>
      normalizarRespuestaHistorica(
        respuesta([fila({ 'Precio Gasoleo A': 'gratis' })]),
        '2026-08-09',
      ),
    /Precio histórico inválido/,
  );
});

test('descarga la ruta histórica con Accept JSON mediante el cliente común', async () => {
  const llamadas: Array<{ url: string; init?: RequestInit }> = [];
  const fetchFalso: typeof fetch = async (input, init) => {
    llamadas.push({ url: String(input), init });
    return new Response(JSON.stringify(respuesta()), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const resultado = await obtenerInstantaneaHistorica('2026-08-09', { fetch: fetchFalso });

  assert.equal(resultado.estaciones.length, 1);
  assert.match(llamadas[0]!.url, /EstacionesTerrestresHist\/09-08-2026$/);
  assert.equal(new Headers(llamadas[0]!.init?.headers).get('Accept'), 'application/json');
});

test('valida instantáneas recuperadas y detecta IDEESS repetidos', () => {
  const instantanea = normalizarRespuestaHistorica(respuesta(), '2026-08-09');
  assert.deepEqual(parsearInstantaneaHistorica(JSON.parse(JSON.stringify(instantanea))), instantanea);

  const duplicada = structuredClone(instantanea);
  duplicada.estaciones.push(duplicada.estaciones[0]!);
  assert.throws(() => parsearInstantaneaHistorica(duplicada), /IDEESS duplicado/);
});

test('conserva mock:true al validar y lo rechaza si no es exactamente true (RNF-43)', () => {
  const instantanea = normalizarRespuestaHistorica(respuesta(), '2026-08-09');
  const marcada = { ...instantanea, mock: true as const };
  assert.deepEqual(parsearInstantaneaHistorica(JSON.parse(JSON.stringify(marcada))), marcada);

  assert.throws(
    () => parsearInstantaneaHistorica({ ...instantanea, mock: false }),
    /no cumple el contrato/,
  );
});
