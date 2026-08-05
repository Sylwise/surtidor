import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { estaAbierta } from './horario.ts';

/** Construye una fecha local a partir de un día de la semana y una hora.
 * `diaSemana`: 0 = lunes ... 6 = domingo (para que coincida con el orden de
 * la documentación, L M X J V S D). Usamos una semana de referencia fija
 * donde el 3 de agosto de 2026 es lunes.
 */
function fecha(diaSemana: number, horas: number, minutos = 0): Date {
  // 2026-08-03 es lunes.
  const dia = 3 + diaSemana;
  return new Date(2026, 7, dia, horas, minutos, 0);
}

describe('estaAbierta', () => {
  describe('L-D: 24H', () => {
    const horario = 'L-D: 24H';

    it('está abierta un lunes a primera hora', () => {
      assert.equal(estaAbierta(horario, fecha(0, 0, 0)), true);
    });

    it('está abierta un domingo a medianoche', () => {
      assert.equal(estaAbierta(horario, fecha(6, 23, 59)), true);
    });

    it('está abierta cualquier día a mediodía', () => {
      assert.equal(estaAbierta(horario, fecha(3, 12, 0)), true);
    });
  });

  describe('L-V: 06:00-22:00; S: 08:00-14:00', () => {
    const horario = 'L-V: 06:00-22:00; S: 08:00-14:00';

    it('está abierta un martes dentro del bloque L-V', () => {
      assert.equal(estaAbierta(horario, fecha(1, 10, 0)), true);
    });

    it('está cerrada un martes fuera del bloque L-V (antes de abrir)', () => {
      assert.equal(estaAbierta(horario, fecha(1, 5, 0)), false);
    });

    it('está cerrada un martes fuera del bloque L-V (después de cerrar)', () => {
      assert.equal(estaAbierta(horario, fecha(1, 23, 0)), false);
    });

    it('está abierta justo a la hora de apertura (06:00, límite inclusivo)', () => {
      assert.equal(estaAbierta(horario, fecha(1, 6, 0)), true);
    });

    it('está cerrada justo a la hora de cierre (22:00, límite exclusivo)', () => {
      assert.equal(estaAbierta(horario, fecha(1, 22, 0)), false);
    });

    it('está abierta un sábado dentro del bloque S', () => {
      assert.equal(estaAbierta(horario, fecha(5, 10, 0)), true);
    });

    it('está cerrada un sábado fuera del bloque S', () => {
      assert.equal(estaAbierta(horario, fecha(5, 15, 0)), false);
    });

    it('está cerrada un domingo, día no declarado en ningún bloque', () => {
      assert.equal(estaAbierta(horario, fecha(6, 12, 0)), false);
    });
  });

  describe('L-D: 22:00-02:00 (cierre pasada medianoche)', () => {
    const horario = 'L-D: 22:00-02:00';

    it('está abierta a la 01:00, dentro del tramo que cruza medianoche', () => {
      assert.equal(estaAbierta(horario, fecha(2, 1, 0)), true);
    });

    it('está cerrada a las 10:00, fuera del tramo nocturno', () => {
      assert.equal(estaAbierta(horario, fecha(2, 10, 0)), false);
    });

    it('está abierta justo a las 22:00, hora de apertura', () => {
      assert.equal(estaAbierta(horario, fecha(2, 22, 0)), true);
    });

    it('está cerrada justo a las 02:00, hora de cierre', () => {
      assert.equal(estaAbierta(horario, fecha(2, 2, 0)), false);
    });
  });

  describe('V-L: 08:00-20:00 (rango de días que da la vuelta a la semana)', () => {
    const horario = 'V-L: 08:00-20:00';

    it('está abierta un sábado dentro del rango de días', () => {
      assert.equal(estaAbierta(horario, fecha(5, 10, 0)), true);
    });

    it('está abierta un domingo dentro del rango de días', () => {
      assert.equal(estaAbierta(horario, fecha(6, 10, 0)), true);
    });

    it('está abierta un lunes, extremo final del rango que da la vuelta', () => {
      assert.equal(estaAbierta(horario, fecha(0, 10, 0)), true);
    });

    it('está abierta un viernes, extremo inicial del rango', () => {
      assert.equal(estaAbierta(horario, fecha(4, 10, 0)), true);
    });

    it('está cerrada un miércoles, fuera del rango de días', () => {
      assert.equal(estaAbierta(horario, fecha(2, 10, 0)), false);
    });
  });

  describe('campo vacío', () => {
    it('devuelve abierta con cadena vacía', () => {
      assert.equal(estaAbierta('', fecha(0, 10, 0)), true);
    });

    it('devuelve abierta con cadena solo de espacios', () => {
      assert.equal(estaAbierta('   ', fecha(0, 10, 0)), true);
    });
  });

  describe('campo ininteligible', () => {
    it('devuelve abierta con texto libre sin ningún patrón reconocible', () => {
      assert.equal(estaAbierta('consultar en tienda', fecha(0, 10, 0)), true);
    });

    it('devuelve abierta con un día inventado que no es ninguna inicial', () => {
      assert.equal(estaAbierta('Z-Q: 08:00-20:00', fecha(0, 10, 0)), true);
    });

    it('devuelve abierta con una franja horaria mal formada', () => {
      assert.equal(estaAbierta('L-V: 6h a 22h', fecha(1, 10, 0)), true);
    });
  });

  describe('bloques mixtos, uno interpretable y otro no', () => {
    it('usa el bloque válido y descarta el ininteligible', () => {
      // El segundo bloque es basura; el intérprete debe apoyarse en el
      // primero en vez de rendirse a devolver "abierta" sin más.
      const horario = 'L-V: 06:00-22:00; blablabla';
      assert.equal(estaAbierta(horario, fecha(1, 23, 0)), false);
      assert.equal(estaAbierta(horario, fecha(1, 10, 0)), true);
    });
  });
});
