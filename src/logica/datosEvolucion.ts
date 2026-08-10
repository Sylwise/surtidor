import { validarHistoricoPublico } from './evolucion.ts';
import type { HistoricoProvincia } from '../../scripts/lib/artefactos-historicos.ts';

const TIMEOUT_MS = 8000;
const cache = new Map<string, Promise<HistoricoProvincia>>();

export function cargarHistoricoProvincia(provinciaId: string): Promise<HistoricoProvincia> {
  const existente = cache.get(provinciaId);
  if (existente) return existente;
  const promesa = (async () => {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);
    try {
      const respuesta = await fetch(`/data/historico/provincias/${encodeURIComponent(provinciaId)}.json`, { signal: controlador.signal });
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      return validarHistoricoPublico(await respuesta.json(), provinciaId);
    } finally {
      clearTimeout(temporizador);
    }
  })();
  cache.set(provinciaId, promesa);
  promesa.catch(() => cache.delete(provinciaId));
  return promesa;
}
