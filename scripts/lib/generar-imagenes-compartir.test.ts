import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { construirTarjetasEditoriales, renderizarSvgEditorial } from '../generar-imagenes-compartir.ts';

describe('imágenes de compartición editoriales', () => {
  it('construye una imagen propia para cada una de las seis rutas', () => {
    const tarjetas = construirTarjetasEditoriales();

    assert.equal(tarjetas.length, 6);
    assert.deepEqual(
      tarjetas.map(({ rutaSalida }) => rutaSalida.split('/og/')[1]),
      [
        'hoy/provincias-mas-baratas.png',
        'hoy/cuanto-te-juegas.png',
        'hoy/marcas-mas-baratas.png',
        'hoy/capitales-de-provincia.png',
        'hoy/la-mas-barata-de-espana.png',
        'hoy/canarias-ceuta-melilla.png',
      ],
    );
    for (const tarjeta of tarjetas) {
      assert.notEqual(tarjeta.gasolina95, 'sin datos');
      assert.notEqual(tarjeta.diesel, 'sin datos');
      assert.notEqual(tarjeta.origenGasolina95, 'Sin origen disponible');
      assert.notEqual(tarjeta.origenDiesel, 'Sin origen disponible');
    }
  });

  it('usa una sola plantilla con Gasolina 95 y Diésel al mismo nivel', () => {
    const svg = renderizarSvgEditorial({
      rutaSalida: '/tmp/editorial.png',
      titulo: 'Un titular editorial suficientemente descriptivo',
      gasolina95: '1,499 €/L',
      origenGasolina95: 'Provincia de prueba',
      diesel: '1,399 €/L',
      origenDiesel: 'Otra provincia',
      actualizado: '2026-08-09T10:00:00+02:00',
    });

    assert.match(svg, /GASOLINA 95/);
    assert.match(svg, /DIÉSEL/);
    assert.doesNotMatch(svg, /GASOLINA 98/);
    assert.doesNotMatch(svg, /DIÉSEL PREMIUM/);
    assert.equal(svg.match(/font-size="82"/g)?.length, 2);
    assert.match(svg, /Provincia de prueba/);
    assert.match(svg, /Otra provincia/);
  });
});
