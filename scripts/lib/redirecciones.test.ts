// ADR-0018 · public/_redirects se genera, no se escribe a mano: esta prueba
// fija el formato exacto (una línea por par, "/antiguo/ /nuevo/ 301") y que
// nunca aparece un comodín.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generarRedirects } from './redirecciones.ts';

describe('generarRedirects', () => {
  it('una línea 301 exacta por par, en el mismo orden que se le pasan', () => {
    const contenido = generarRedirects([
      { idAntiguo: 'p-08', idNuevo: 'barcelona' },
      { idAntiguo: 'ccaa-13', idNuevo: 'comunidad/madrid' },
    ]);
    assert.equal(contenido, '/p-08/ /barcelona/ 301\n/ccaa-13/ /comunidad/madrid/ 301\n');
  });

  it('ninguna línea lleva un comodín', () => {
    const contenido = generarRedirects([{ idAntiguo: 'p-08', idNuevo: 'barcelona' }]);
    assert.ok(!contenido.includes('*'));
  });

  it('71 pares producen 71 líneas', () => {
    const pares = Array.from({ length: 71 }, (_, i) => ({ idAntiguo: `p-${i}`, idNuevo: `zona-${i}` }));
    const contenido = generarRedirects(pares);
    assert.equal(contenido.trim().split('\n').length, 71);
  });
});
