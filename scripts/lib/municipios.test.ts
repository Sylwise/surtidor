import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { construirMunicipios } from './municipios.ts';
import { comprobarSlugsUnicos } from './slug.ts';
import type { DatosProvincia, Estacion } from './tipos.ts';
import type { MunicipioCatalogo } from './miteco.ts';

function estacion(extra: Partial<Estacion> = {}): Estacion {
  return {
    id: '1',
    rotulo: 'BALLENOIL',
    direccion: 'CALLE FALSA 1',
    municipio: 'Vitoria-Gasteiz',
    cp: '01013',
    lat: 42.8695,
    lon: -2.6716,
    horario: 'L-D: 24H',
    tipoVenta: 'P',
    margen: 'D',
    precios: { gasolina95e5: 1.409, gasoleoA: 1.489, gasolina98e5: null, gasoleoPremium: null },
    ...extra,
  };
}

function datosProvincia(id: string, nombre: string, estaciones: Estacion[]): DatosProvincia {
  return { provincia: { id, nombre }, actualizado: '2026-08-06T10:00:00Z', fechaMiteco: '', estaciones };
}

function municipioCatalogo(idProvincia: string, municipio: string): MunicipioCatalogo {
  return { IDMunicipio: '1', IDProvincia: idProvincia, IDCCAA: '16', Municipio: municipio, Provincia: '', CCAA: '' };
}

describe('construirMunicipios', () => {
  it('cuenta las estaciones visibles por (provincia, municipio)', () => {
    const datos = [
      datosProvincia('01', 'ARABA/ALAVA', [
        estacion({ id: 'a1', municipio: 'Vitoria-Gasteiz' }),
        estacion({ id: 'a2', municipio: 'Vitoria-Gasteiz' }),
        estacion({ id: 'a3', municipio: 'Amurrio' }),
      ]),
    ];
    const catalogo = [municipioCatalogo('01', 'Vitoria-Gasteiz'), municipioCatalogo('01', 'Amurrio')];

    const { municipios, sinCatalogar } = construirMunicipios(datos, catalogo);

    assert.equal(sinCatalogar, 0);
    const porNombre = new Map(municipios.map((m) => [m.nombre, m]));
    assert.equal(porNombre.get('Vitoria-Gasteiz')?.estaciones, 2);
    assert.equal(porNombre.get('Vitoria-Gasteiz')?.provinciaId, '01');
    assert.equal(porNombre.get('Amurrio')?.estaciones, 1);
  });

  it('excluye las estaciones de venta no pública (RF-48), igual que estacionesVisibles', () => {
    const datos = [
      datosProvincia('01', 'ARABA/ALAVA', [
        estacion({ id: 'a1', municipio: 'Amurrio', tipoVenta: 'P' }),
        estacion({ id: 'a2', municipio: 'Amurrio', tipoVenta: 'R' }),
        estacion({ id: 'a3', municipio: 'Amurrio', tipoVenta: 'A' }),
      ]),
    ];
    const { municipios } = construirMunicipios(datos, [municipioCatalogo('01', 'Amurrio')]);
    assert.equal(municipios[0]?.estaciones, 1);
  });

  it('recorta el espacio sobrante del catálogo antes de comparar (caso real de Bizkaia)', () => {
    const nombreConEspacio = 'Etxebarri, Anteiglesia de San Esteban-Etxebarri Doneztebeko ';
    const datos = [
      datosProvincia('48', 'BIZKAIA', [
        estacion({ id: 'b1', municipio: nombreConEspacio.trim() }),
      ]),
    ];
    const catalogo = [municipioCatalogo('48', nombreConEspacio)];

    const { municipios, sinCatalogar } = construirMunicipios(datos, catalogo);

    assert.equal(sinCatalogar, 0);
    assert.equal(municipios[0]?.nombre, nombreConEspacio.trim());
  });

  it('un municipio ausente del catálogo se cuenta igual, pero se marca sinCatalogar', () => {
    const datos = [datosProvincia('01', 'ARABA/ALAVA', [estacion({ id: 'a1', municipio: 'Pueblo Fantasma' })])];
    const { municipios, sinCatalogar } = construirMunicipios(datos, []);

    assert.equal(sinCatalogar, 1);
    assert.equal(municipios.length, 1);
    assert.equal(municipios[0]?.nombre, 'Pueblo Fantasma');
  });

  it('el mismo nombre de municipio en provincias distintas no se mezcla', () => {
    const datos = [
      datosProvincia('01', 'ARABA/ALAVA', [estacion({ id: 'a1', municipio: 'San Millán' })]),
      datosProvincia('26', 'RIOJA (LA)', [estacion({ id: 'r1', municipio: 'San Millán' })]),
    ];
    const catalogo = [municipioCatalogo('01', 'San Millán'), municipioCatalogo('26', 'San Millán')];

    const { municipios } = construirMunicipios(datos, catalogo);

    assert.equal(municipios.length, 2);
    assert.deepEqual(
      municipios.map((m) => m.provinciaId).sort(),
      ['01', '26'],
    );
  });
});

describe('construirMunicipios + comprobarSlugsUnicos (la guarda tal como la llama scripts/descargar-datos.ts)', () => {
  // Con el catálogo real de agosto de 2026 no hay ninguna colisión (por eso
  // hizo falta escribir esta prueba: la rama de "aborta" nunca se ha
  // disparado con datos de verdad). Aquí se fabrica una a propósito —dos
  // municipios de la MISMA provincia cuyo nombre normaliza al mismo slug,
  // por guion en vez de espacio— y se comprueba que la cadena completa que
  // usa el script real (construir el catálogo, luego validar sus slugs)
  // salta de verdad, antes de que nada se pudiera escribir a disco.
  it('aborta si dos municipios reales de la misma provincia generan el mismo slug', () => {
    const datos = [
      datosProvincia('41', 'SEVILLA', [
        estacion({ id: 's1', municipio: 'Villanueva del Río' }),
        estacion({ id: 's2', municipio: 'Villanueva-del Río' }),
      ]),
    ];
    const catalogo = [
      municipioCatalogo('41', 'Villanueva del Río'),
      municipioCatalogo('41', 'Villanueva-del Río'),
    ];

    const { municipios } = construirMunicipios(datos, catalogo);
    assert.equal(municipios.length, 2, 'de entrada son dos municipios distintos, no se fusionan');

    assert.throws(
      () => comprobarSlugsUnicos(municipios, (m) => m.nombre, (m) => m.provinciaId, 'Municipios'),
      /generan el mismo slug/,
    );
  });

  it('la misma colisión NO salta si los dos municipios son de provincias distintas', () => {
    const datos = [
      datosProvincia('41', 'SEVILLA', [estacion({ id: 's1', municipio: 'Villanueva del Río' })]),
      datosProvincia('14', 'CÓRDOBA', [estacion({ id: 'c1', municipio: 'Villanueva-del Río' })]),
    ];
    const catalogo = [
      municipioCatalogo('41', 'Villanueva del Río'),
      municipioCatalogo('14', 'Villanueva-del Río'),
    ];

    const { municipios } = construirMunicipios(datos, catalogo);

    assert.doesNotThrow(() =>
      comprobarSlugsUnicos(municipios, (m) => m.nombre, (m) => m.provinciaId, 'Municipios'),
    );
  });
});
