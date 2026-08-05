import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarEstacion, normalizarEstaciones, type EstacionCruda } from './normalizar.ts';

// Estación base válida, tal y como la devuelve el endpoint normal (no histórico).
function estacionBase(extra: EstacionCruda = {}): EstacionCruda {
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
    Horario: 'L-D: 24H',
    'Precio Gasolina 95 E5': '1,409',
    'Precio Gasoleo A': '1,489',
    'Precio Gasolina 98 E5': '',
    'Precio Gasoleo Premium': '',
    ...extra,
  };
}

test('convierte coma decimal a punto en los precios: "1,479" -> 1.479', () => {
  const resultado = normalizarEstacion(estacionBase({ 'Precio Gasoleo A': '1,479' }));
  assert.equal(resultado?.precios.gasoleoA, 1.479);
});

test('convierte coma decimal a punto en las coordenadas: "-2,671600" -> -2.6716', () => {
  const resultado = normalizarEstacion(estacionBase({ 'Longitud (WGS84)': '-2,671600' }));
  assert.equal(resultado?.lon, -2.6716);
});

test('convierte la latitud con coma decimal correctamente', () => {
  const resultado = normalizarEstacion(estacionBase({ Latitud: '42,869500' }));
  assert.equal(resultado?.lat, 42.8695);
});

test('cadena vacía en un precio da null, nunca 0 ni cadena vacía', () => {
  const resultado = normalizarEstacion(estacionBase({ 'Precio Gasolina 98 E5': '' }));
  assert.equal(resultado?.precios.gasolina98e5, null);
  assert.notEqual(resultado?.precios.gasolina98e5, 0);
  assert.notEqual(resultado?.precios.gasolina98e5, '');
});

test('campo de precio ausente también da null', () => {
  const cruda = estacionBase();
  delete cruda['Precio Gasoleo Premium'];
  const resultado = normalizarEstacion(cruda);
  assert.equal(resultado?.precios.gasoleoPremium, null);
});

test('acepta las claves escapadas del endpoint histórico (_x0020_, _x0028_, _x0029_)', () => {
  const cruda: EstacionCruda = {
    IDEESS: '5678',
    Rótulo: 'REPSOL',
    Dirección: 'CALLE MAYOR 1',
    Municipio: 'MADRID',
    'C.P.': '28001',
    Latitud: '40,416900',
    Longitud_x0020__x0028_WGS84_x0029_: '-3,703500',
    Horario: 'L-D: 24H',
    Precio_x0020_Gasolina_x0020_95_x0020_E5: '1,650',
    Precio_x0020_Gasoleo_x0020_A: '1,590',
    Precio_x0020_Gasolina_x0020_98_x0020_E5: '',
    Precio_x0020_Gasoleo_x0020_Premium: '',
  };

  const resultado = normalizarEstacion(cruda);

  assert.ok(resultado);
  assert.equal(resultado?.lon, -3.7035);
  assert.equal(resultado?.precios.gasolina95e5, 1.65);
  assert.equal(resultado?.precios.gasoleoA, 1.59);
});

test('una estación sin coordenadas (lat/lon ausentes) se descarta', () => {
  const cruda = estacionBase();
  delete cruda.Latitud;
  delete cruda['Longitud (WGS84)'];
  const resultado = normalizarEstacion(cruda);
  assert.equal(resultado, null);
});

test('una estación con coordenadas vacías se descarta', () => {
  const resultado = normalizarEstacion(estacionBase({ Latitud: '', 'Longitud (WGS84)': '' }));
  assert.equal(resultado, null);
});

test('una estación con coordenadas que no parsean a número se descarta', () => {
  const resultado = normalizarEstacion(
    estacionBase({ Latitud: 'no-es-un-numero', 'Longitud (WGS84)': '-2,671600' }),
  );
  assert.equal(resultado, null);
});

test('normalizarEstaciones cuenta las descartadas sin perder las válidas', () => {
  const valida = estacionBase();
  const sinCoordenadas = estacionBase({ Latitud: '', 'Longitud (WGS84)': '' });

  const resultado = normalizarEstaciones([valida, sinCoordenadas, valida]);

  assert.equal(resultado.estaciones.length, 2);
  assert.equal(resultado.descartadas, 1);
});

test('traduce las cuatro claves de precio que nos interesan a sus nombres internos', () => {
  const resultado = normalizarEstacion(
    estacionBase({
      'Precio Gasolina 95 E5': '1,409',
      'Precio Gasoleo A': '1,489',
      'Precio Gasolina 98 E5': '1,559',
      'Precio Gasoleo Premium': '1,599',
    }),
  );

  assert.deepEqual(resultado?.precios, {
    gasolina95e5: 1.409,
    gasoleoA: 1.489,
    gasolina98e5: 1.559,
    gasoleoPremium: 1.599,
  });
});

test('no mezcla Gasolina 95 E5 con Gasolina 95 E10: E10 se ignora, no pisa E5', () => {
  const resultado = normalizarEstacion(
    estacionBase({
      'Precio Gasolina 95 E5': '1,409',
      'Precio Gasolina 95 E10': '1,399',
    }),
  );

  assert.equal(resultado?.precios.gasolina95e5, 1.409);
});

test('ignora campos de precio que no nos interesan (Biodiesel, GNC, Hidrógeno, Adblue) sin romperse', () => {
  const resultado = normalizarEstacion(
    estacionBase({
      'Precio Biodiesel': '1,200',
      'Precio Gas Natural Comprimido': '0,999',
      'Precio Hidrogeno': '9,999',
      'Precio Adblue': '0,650',
    }),
  );

  assert.ok(resultado);
  assert.deepEqual(Object.keys(resultado.precios).sort(), [
    'gasoleoA',
    'gasoleoPremium',
    'gasolina95e5',
    'gasolina98e5',
  ]);
});

test('no rompe si aparecen campos de precio nuevos y desconocidos en el futuro', () => {
  assert.doesNotThrow(() => {
    normalizarEstacion(estacionBase({ 'Precio Combustible Futurista': '3,140' }));
  });
});

test('conserva el resto de campos de texto tal cual (rótulo, dirección, municipio, cp, horario)', () => {
  const resultado = normalizarEstacion(estacionBase());
  assert.equal(resultado?.id, '1234');
  assert.equal(resultado?.rotulo, 'BALLENOIL');
  assert.equal(resultado?.direccion, 'PORTAL DE GAMARRA 42');
  assert.equal(resultado?.municipio, 'VITORIA-GASTEIZ');
  assert.equal(resultado?.cp, '01013');
  assert.equal(resultado?.horario, 'L-D: 24H');
});
