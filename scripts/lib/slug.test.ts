// H10 (segunda mitad): "escribe una prueba que compruebe que no hay slugs
// duplicados en todo el catálogo. Es el fallo que ningún test detecta si no
// lo buscas a propósito" (docs/06-roadmap.md). Aquí se prueban las dos
// piezas: la función de slug en sí, con los casos bilingües y de puntuación
// que cita la instrucción, y la guarda de colisión que scripts/descargar-datos.ts
// llama antes de escribir nada.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generarSlug, comprobarSlugsUnicos } from './slug.ts';

describe('generarSlug', () => {
  it('ARABA/ALAVA es araba-alava (el ejemplo literal del encargo)', () => {
    assert.equal(generarSlug('ARABA/ALAVA'), 'araba-alava');
  });

  it('forma bilingüe con barra: Donostia/San Sebastián', () => {
    assert.equal(generarSlug('Donostia/San Sebastián'), 'donostia-san-sebastian');
  });

  it('forma bilingüe con guion, ya presente: Vitoria-Gasteiz', () => {
    assert.equal(generarSlug('Vitoria-Gasteiz'), 'vitoria-gasteiz');
  });

  it('la ñ se pierde igual que un acento (NFD la descompone en n + tilde)', () => {
    assert.equal(generarSlug('Baños de Ebro/Mañueta'), 'banos-de-ebro-manueta');
  });

  it('comas y espacios colapsan a un solo guion', () => {
    assert.equal(generarSlug('Palmas de Gran Canaria (Las)'), 'palmas-de-gran-canaria-las');
  });

  it('recorta espacio sobrante: el catálogo real de Listados/Municipios trae alguno', () => {
    assert.equal(
      generarSlug('Etxebarri, Anteiglesia de San Esteban-Etxebarri Doneztebeko '),
      'etxebarri-anteiglesia-de-san-esteban-etxebarri-doneztebeko',
    );
  });

  it('nunca deja guiones al principio o al final', () => {
    assert.equal(generarSlug('  Ceuta  '), 'ceuta');
  });
});

interface Fixture {
  nombre: string;
  provinciaId: string;
}

function fixture(nombre: string, provinciaId: string): Fixture {
  return { nombre, provinciaId };
}

describe('comprobarSlugsUnicos', () => {
  it('no lanza si todos los slugs del grupo son distintos', () => {
    const municipios = [
      fixture('Vitoria-Gasteiz', '01'),
      fixture('Amurrio', '01'),
      fixture('Bilbao', '48'),
    ];
    assert.doesNotThrow(() =>
      comprobarSlugsUnicos(municipios, (m) => m.nombre, (m) => m.provinciaId, 'Municipios'),
    );
  });

  it('lanza si dos nombres distintos de la MISMA provincia generan el mismo slug', () => {
    // Caso fabricado: dos nombres que normalizan igual dentro de la misma
    // provincia. No hace falta que exista de verdad; la guarda tiene que
    // dispararse igualmente si algún día el catálogo del ministerio trae dos
    // así.
    const municipios = [fixture('Peña-lba', '05'), fixture('Peña lba', '05')];
    assert.throws(
      () => comprobarSlugsUnicos(municipios, (m) => m.nombre, (m) => m.provinciaId, 'Municipios'),
      /generan el mismo slug/,
    );
  });

  it('el mismo nombre repetido dos veces (idéntico) no cuenta como colisión', () => {
    const municipios = [fixture('Amurrio', '01'), fixture('Amurrio', '01')];
    assert.doesNotThrow(() =>
      comprobarSlugsUnicos(municipios, (m) => m.nombre, (m) => m.provinciaId, 'Municipios'),
    );
  });

  it('el mismo slug en provincias DISTINTAS no colisiona (la URL lleva la provincia delante)', () => {
    // Nombre de municipio repetido en dos provincias es algo real y frecuente
    // en España (p.ej. "Valverde"). No es una colisión porque la URL final
    // es /{provincia}/{municipio}/, con la provincia delante.
    const municipios = [fixture('Valverde', '10'), fixture('Valverde', '21')];
    assert.doesNotThrow(() =>
      comprobarSlugsUnicos(municipios, (m) => m.nombre, (m) => m.provinciaId, 'Municipios'),
    );
  });
});
