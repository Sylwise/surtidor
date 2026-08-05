// Pruebas de scripts/lib/miteco.ts. No dependen de red real: inyectan un
// `fetch` falso, construido a mano con la forma exacta de ejemplo de
// docs/04-fuente-datos.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  obtenerEstacionesPorProvincia,
  ErrorValidacionMiteco,
  ErrorResultadoMiteco,
  ErrorPeticionMiteco,
} from './miteco.ts';

type FuncionFetch = typeof fetch;

/** Estación de ejemplo, calcada del ejemplo de docs/04-fuente-datos.md. */
function estacionEjemplo(): Record<string, string> {
  return {
    IDEESS: '1234',
    Rótulo: 'BALLENOIL',
    Dirección: 'PORTAL DE GAMARRA 42',
    Municipio: 'VITORIA-GASTEIZ',
    Provincia: 'ARABA/ALAVA',
    Localidad: 'VITORIA-GASTEIZ',
    'C.P.': '01013',
    Latitud: '42,869500',
    'Longitud (WGS84)': '-2,671600',
    Margen: 'D',
    Horario: 'L-D: 24H',
    'Tipo Venta': 'P',
    'Precio Gasolina 95 E5': '1,409',
    'Precio Gasoleo A': '1,489',
    'Precio Gasolina 98 E5': '',
    'Precio Gasoleo Premium': '',
  };
}

function respuestaEjemplo(sobrescribir: Record<string, unknown> = {}) {
  return {
    Fecha: '05/08/2026 11:00:00',
    ResultadoConsulta: 'OK',
    ListaEESSPrecio: [estacionEjemplo()],
    ...sobrescribir,
  };
}

interface LlamadaRegistrada {
  url: string;
  init: RequestInit | undefined;
}

/**
 * Fabrica un `fetch` falso que, en cada llamada sucesiva, ejecuta el
 * siguiente "comportamiento" de la lista (repitiendo el último si se
 * queda corta). Cada comportamiento devuelve una `Response` o lanza.
 */
function fetchFalso(comportamientos: Array<() => Response | Promise<Response>>): {
  fetch: FuncionFetch;
  llamadas: LlamadaRegistrada[];
} {
  const llamadas: LlamadaRegistrada[] = [];
  let indice = 0;
  const impl: FuncionFetch = async (input, init) => {
    llamadas.push({ url: String(input), init });
    const comportamiento = comportamientos[Math.min(indice, comportamientos.length - 1)];
    indice++;
    return comportamiento();
  };
  return { fetch: impl, llamadas };
}

function respuestaJson(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('descarga y valida una respuesta correcta, pidiendo JSON explícitamente', async () => {
  const { fetch, llamadas } = fetchFalso([() => respuestaJson(respuestaEjemplo())]);

  const resultado = await obtenerEstacionesPorProvincia('01', { fetch });

  assert.equal(resultado.ListaEESSPrecio.length, 1);
  assert.equal(resultado.ListaEESSPrecio[0]?.Rótulo, 'BALLENOIL');
  assert.equal(llamadas.length, 1);
  assert.match(llamadas[0].url, /EstacionesTerrestres\/FiltroProvincia\/01$/);

  const cabeceras = new Headers(llamadas[0].init?.headers);
  assert.equal(cabeceras.get('Accept'), 'application/json');
});

test('no convierte los datos: los precios siguen siendo cadenas con coma', async () => {
  const { fetch } = fetchFalso([() => respuestaJson(respuestaEjemplo())]);

  const resultado = await obtenerEstacionesPorProvincia('01', { fetch });

  assert.equal(resultado.ListaEESSPrecio[0]?.['Precio Gasoleo A'], '1,489');
  assert.equal(resultado.ListaEESSPrecio[0]?.['Precio Gasolina 98 E5'], '');
});

test('conserva campos de combustible desconocidos gracias a passthrough', async () => {
  const conCampoExtra = respuestaEjemplo();
  (conCampoExtra.ListaEESSPrecio[0] as Record<string, string>)['Precio Biodiesel'] = '1,300';
  const { fetch } = fetchFalso([() => respuestaJson(conCampoExtra)]);

  const resultado = await obtenerEstacionesPorProvincia('01', { fetch });

  assert.equal((resultado.ListaEESSPrecio[0] as Record<string, string>)['Precio Biodiesel'], '1,300');
});

test('revienta con ErrorValidacionMiteco si cambia un nombre de campo, y no reintenta', async () => {
  const cuerpoRoto = respuestaEjemplo();
  const estacionRota = estacionEjemplo() as Record<string, unknown>;
  delete estacionRota.Rótulo;
  estacionRota.Rotulo = 'BALLENOIL'; // el ministerio "cambió" el campo: sin tilde
  (cuerpoRoto as { ListaEESSPrecio: unknown[] }).ListaEESSPrecio = [estacionRota];

  const { fetch, llamadas } = fetchFalso([() => respuestaJson(cuerpoRoto)]);

  await assert.rejects(
    () => obtenerEstacionesPorProvincia('01', { fetch }),
    ErrorValidacionMiteco,
  );
  assert.equal(llamadas.length, 1, 'un fallo de validación no debe consumir reintentos');
});

test('revienta con ErrorValidacionMiteco si falta la lista de estaciones', async () => {
  const { fetch } = fetchFalso([
    () => respuestaJson({ Fecha: '05/08/2026 11:00:00', ResultadoConsulta: 'OK' }),
  ]);

  await assert.rejects(
    () => obtenerEstacionesPorProvincia('01', { fetch }),
    ErrorValidacionMiteco,
  );
});

test('lanza ErrorResultadoMiteco si ResultadoConsulta no es OK, sin reintentar', async () => {
  const { fetch, llamadas } = fetchFalso([
    () => respuestaJson(respuestaEjemplo({ ResultadoConsulta: 'ERROR' })),
  ]);

  await assert.rejects(
    () => obtenerEstacionesPorProvincia('01', { fetch }),
    ErrorResultadoMiteco,
  );
  assert.equal(llamadas.length, 1);
});

test('reintenta con fallos de red transitorios y se recupera al tercer intento', async () => {
  const { fetch, llamadas } = fetchFalso([
    () => {
      throw new TypeError('fetch failed');
    },
    () => {
      throw new TypeError('fetch failed');
    },
    () => respuestaJson(respuestaEjemplo()),
  ]);

  const resultado = await obtenerEstacionesPorProvincia('01', {
    fetch,
    esperasReintentoMs: [1, 1, 1],
  });

  assert.equal(llamadas.length, 3);
  assert.equal(resultado.ListaEESSPrecio.length, 1);
});

test('un HTTP no-OK cuenta como fallo transitorio y se reintenta', async () => {
  const { fetch, llamadas } = fetchFalso([
    () => new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' }),
    () => respuestaJson(respuestaEjemplo()),
  ]);

  const resultado = await obtenerEstacionesPorProvincia('01', {
    fetch,
    esperasReintentoMs: [1, 1, 1],
  });

  assert.equal(llamadas.length, 2);
  assert.equal(resultado.ListaEESSPrecio.length, 1);
});

test('agota los reintentos configurados y lanza ErrorPeticionMiteco', async () => {
  const { fetch, llamadas } = fetchFalso([
    () => {
      throw new TypeError('fetch failed');
    },
  ]);

  await assert.rejects(
    () =>
      obtenerEstacionesPorProvincia('01', {
        fetch,
        esperasReintentoMs: [1, 1],
      }),
    ErrorPeticionMiteco,
  );
  assert.equal(llamadas.length, 3, '1 intento inicial + 2 reintentos = 3 llamadas');
});

test('el timeout por intento aborta la petición y cuenta como fallo reintentable', async () => {
  let llamadas = 0;
  const fetchQueNuncaResponde: FuncionFetch = (_input, init) => {
    llamadas++;
    return new Promise((_resolver, rechazar) => {
      init?.signal?.addEventListener('abort', () => {
        rechazar(new DOMException('aborted', 'AbortError'));
      });
    });
  };

  await assert.rejects(
    () =>
      obtenerEstacionesPorProvincia('01', {
        fetch: fetchQueNuncaResponde,
        timeoutMs: 5,
        esperasReintentoMs: [1],
      }),
    ErrorPeticionMiteco,
  );
  assert.equal(llamadas, 2, '1 intento inicial + 1 reintento tras el timeout');
});
