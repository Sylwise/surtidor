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
    Margen: 'D',
    'Tipo Venta': 'P',
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
  assert.equal(resultado.sinCoordenadas, 1);
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

test('propaga Tipo Venta y Margen cuando tienen un valor válido', () => {
  const resultado = normalizarEstacion(estacionBase({ 'Tipo Venta': 'R', Margen: 'N' }));
  assert.equal(resultado?.tipoVenta, 'R');
  assert.equal(resultado?.margen, 'N');
});

test('acepta el tercer código de Tipo Venta, "A", sin contarlo como inesperado', () => {
  const cruda = estacionBase({ 'Tipo Venta': 'A' });
  const resultado = normalizarEstacion(cruda);
  assert.equal(resultado?.tipoVenta, 'A');

  const { tipoVentaInesperados } = normalizarEstaciones([cruda]);
  assert.equal(tipoVentaInesperados, 0);
});

test('Margen vacío o ausente da null en silencio (no cuenta como inesperado)', () => {
  const cruda = estacionBase({ Margen: '' });
  const resultado = normalizarEstacion(cruda);
  assert.equal(resultado?.margen, null);

  const { margenInesperados } = normalizarEstaciones([cruda]);
  assert.equal(margenInesperados, 0);
});

test('Tipo Venta con un valor inesperado cae a "P" y se cuenta', () => {
  const cruda = estacionBase({ 'Tipo Venta': 'X' });
  const resultado = normalizarEstacion(cruda);
  assert.equal(resultado?.tipoVenta, 'P');

  const { tipoVentaInesperados } = normalizarEstaciones([cruda]);
  assert.equal(tipoVentaInesperados, 1);
});

test('Tipo Venta ausente también cae a "P" y se cuenta como inesperado', () => {
  const cruda = estacionBase();
  delete cruda['Tipo Venta'];
  const resultado = normalizarEstacion(cruda);
  assert.equal(resultado?.tipoVenta, 'P');

  const { tipoVentaInesperados } = normalizarEstaciones([cruda]);
  assert.equal(tipoVentaInesperados, 1);
});

test('Margen con un valor inesperado cae a null y se cuenta', () => {
  const cruda = estacionBase({ Margen: 'X' });
  const resultado = normalizarEstacion(cruda);
  assert.equal(resultado?.margen, null);

  const { margenInesperados } = normalizarEstaciones([cruda]);
  assert.equal(margenInesperados, 1);
});

test('una estación con latitud y longitud intercambiadas (caso Tui, id 16268) cae en "fuera de España", no en "sin coordenadas"', () => {
  // Coordenadas reales de la estación 16268 "GUAY" en Tui (Pontevedra), con
  // lat/lon intercambiadas en origen: la sitúan en el océano Índico
  // (docs/04-fuente-datos.md, trampa 11).
  const cruda = estacionBase({
    IDEESS: '16268',
    Rótulo: 'GUAY',
    Municipio: 'TUI',
    Latitud: '-8,664200',
    'Longitud (WGS84)': '42,051700',
  });

  const resultado = normalizarEstacion(cruda);
  assert.equal(resultado, null);

  const { sinCoordenadas, fueraDeEspana } = normalizarEstaciones([cruda]);
  assert.equal(fueraDeEspana, 1);
  assert.equal(sinCoordenadas, 0);
});

test('un par de coordenadas (0, 0) exacto cae en "sin coordenadas", no en "fuera de España"', () => {
  // Casos reales: 11988 "PETROZAL" en Barcelona y 12883 "SUPER GASOIL" en
  // Valdemoro (docs/04-fuente-datos.md, trampa 12). (0, 0) es el valor por
  // defecto del ministerio cuando no tiene la posición, no una posición real
  // en el golfo de Guinea.
  const cruda = estacionBase({
    IDEESS: '11988',
    Rótulo: 'PETROZAL',
    Municipio: 'BARCELONA',
    Latitud: '0,000000',
    'Longitud (WGS84)': '0,000000',
  });

  const resultado = normalizarEstacion(cruda);
  assert.equal(resultado, null);

  const { sinCoordenadas, fueraDeEspana } = normalizarEstaciones([cruda]);
  assert.equal(sinCoordenadas, 1);
  assert.equal(fueraDeEspana, 0);
});

test('una estación de Canarias y otra de Melilla no se descartan por ninguno de los dos filtros', () => {
  const canaria = estacionBase({
    IDEESS: '9001',
    Municipio: 'LAS PALMAS DE GRAN CANARIA',
    Latitud: '28,123500',
    'Longitud (WGS84)': '-15,436800',
  });
  const melillense = estacionBase({
    IDEESS: '9002',
    Municipio: 'MELILLA',
    Latitud: '35,292700',
    'Longitud (WGS84)': '-2,938100',
  });

  assert.ok(normalizarEstacion(canaria));
  assert.ok(normalizarEstacion(melillense));

  const { estaciones, sinCoordenadas, fueraDeEspana } = normalizarEstaciones([canaria, melillense]);
  assert.equal(estaciones.length, 2);
  assert.equal(sinCoordenadas, 0);
  assert.equal(fueraDeEspana, 0);
});

test('normalizarEstaciones no cuenta Tipo Venta ni Margen de una estación descartada', () => {
  const sinCoordenadas = estacionBase({
    Latitud: '',
    'Longitud (WGS84)': '',
    'Tipo Venta': 'X',
    Margen: 'X',
  });

  const resultado = normalizarEstaciones([sinCoordenadas]);

  assert.equal(resultado.sinCoordenadas, 1);
  assert.equal(resultado.tipoVentaInesperados, 0);
  assert.equal(resultado.margenInesperados, 0);
});
