import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';

import { construirEstadoHistorico } from './estado-historico.ts';
import { recuperarEstadoDesplegado } from './transporte-historico.ts';

function preparar() {
  const estado = construirEstadoHistorico([
    { version: 1, fecha: '2026-08-09', estaciones: [['1', '01', '01059', 1400, null, null, null]] },
  ]);
  const comprimido = gzipSync(JSON.stringify(estado));
  const sha256 = createHash('sha256').update(comprimido).digest('hex');
  const manifiesto = {
    version: 1,
    desde: '2026-08-09',
    hasta: '2026-08-09',
    dias: 1,
    estaciones: 1,
    estado: 'estado.json.gz',
    sha256,
  };
  return { estado, comprimido, manifiesto };
}

test('recupera manifiesto y estado unidos por SHA-256 y evita caché', async () => {
  const { estado, comprimido, manifiesto } = preparar();
  const urls: string[] = [];
  const fetchFalso: typeof fetch = async (input) => {
    const url = String(input);
    urls.push(url);
    return url.includes('manifiesto')
      ? new Response(JSON.stringify(manifiesto))
      : new Response(comprimido);
  };

  const recuperado = await recuperarEstadoDesplegado('https://surtidor.test/data/historico/', {
    fetch: fetchFalso,
    cachebuster: 'prueba',
  });

  assert.deepEqual(recuperado.estado, estado);
  assert.match(urls[0]!, /manifiesto\.json\?v=prueba/);
  assert.match(urls[1]!, new RegExp(`estado\\.json\\.gz\\?v=${manifiesto.sha256}`));
});

test('rechaza estado corrupto y manifiesto que no lo describe', async () => {
  const preparado = preparar();
  const fetchCorrupto: typeof fetch = async (input) =>
    String(input).includes('manifiesto')
      ? new Response(JSON.stringify(preparado.manifiesto))
      : new Response(new Uint8Array([1, 2, 3]));
  await assert.rejects(
    recuperarEstadoDesplegado('https://surtidor.test/data/historico/', { fetch: fetchCorrupto }),
    /SHA-256 histórico incorrecto/,
  );

  const manifiestoRoto = { ...preparado.manifiesto, estaciones: 2 };
  const fetchRoto: typeof fetch = async (input) =>
    String(input).includes('manifiesto')
      ? new Response(JSON.stringify(manifiestoRoto))
      : new Response(preparado.comprimido);
  await assert.rejects(
    recuperarEstadoDesplegado('https://surtidor.test/data/historico/', { fetch: fetchRoto }),
    /manifiesto no describe/,
  );
});

test('recupera un estado mock cuando manifiesto y estado coinciden, y rechaza si discrepan (RNF-43)', async () => {
  const estadoMock = construirEstadoHistorico([
    { version: 1, fecha: '2026-08-09', estaciones: [['1', '01', '01059', 1400, null, null, null]], mock: true },
  ]);
  const comprimidoMock = gzipSync(JSON.stringify(estadoMock));
  const manifiestoMock = {
    version: 1 as const,
    desde: '2026-08-09',
    hasta: '2026-08-09',
    dias: 1,
    estaciones: 1,
    estado: 'estado.json.gz',
    sha256: createHash('sha256').update(comprimidoMock).digest('hex'),
    mock: true as const,
  };
  const fetchMock: typeof fetch = async (input) =>
    String(input).includes('manifiesto')
      ? new Response(JSON.stringify(manifiestoMock))
      : new Response(comprimidoMock);
  const recuperado = await recuperarEstadoDesplegado('https://surtidor.test/data/historico/', { fetch: fetchMock });
  assert.equal(recuperado.estado.mock, true);

  // Mismo estado mock, pero el manifiesto dice que no lo es: debe rechazarse
  // aunque el SHA-256 sea correcto, porque describe mal lo que hay dentro.
  const { mock: _sinUsar, ...manifiestoQueMiente } = manifiestoMock;
  const fetchQueMiente: typeof fetch = async (input) =>
    String(input).includes('manifiesto')
      ? new Response(JSON.stringify(manifiestoQueMiente))
      : new Response(comprimidoMock);
  await assert.rejects(
    recuperarEstadoDesplegado('https://surtidor.test/data/historico/', { fetch: fetchQueMiente }),
    /manifiesto no describe/,
  );
});
