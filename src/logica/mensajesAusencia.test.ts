import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mensajeAquiNoHay,
  mensajeCombustibleNoDisponibleEnEvolucion,
  mensajeEnZonaNoHay,
  mensajeHistoricoInsuficiente,
  mensajeMuestraInsuficienteRanking,
  mensajeNoVende,
  mensajeSinDato,
} from './mensajesAusencia.ts';

test('cada ausencia conserva su redacción propia', () => {
  assert.equal(mensajeNoVende(), 'no vende');
  assert.equal(mensajeAquiNoHay('glp'), 'Aquí no hay GLP.');
  assert.equal(mensajeEnZonaNoHay('Ceuta', 'gasoleoB'), 'En Ceuta no hay gasóleo B.');
  assert.equal(mensajeSinDato(), 'sin dato');
  assert.equal(
    mensajeCombustibleNoDisponibleEnEvolucion('gasoleoB'),
    'Gasóleo B no está disponible en Evolución porque los datos históricos todavía no incluyen este combustible.',
  );
  assert.equal(mensajeHistoricoInsuficiente(7), 'Aún no hay histórico suficiente para comparar los últimos 7 días.');
  assert.equal(mensajeMuestraInsuficienteRanking(), 'No hay muestra suficiente para entrar en este ranking.');
});
