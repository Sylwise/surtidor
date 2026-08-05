// Intérprete del campo "Horario" de la API del MITECO. Ver la sección
// "El campo Horario" de docs/04-fuente-datos.md para las reglas.
//
// TypeScript puro: nada de `fs`, `process` ni ninguna otra API de Node. Solo
// manipulación de cadenas y `Date`. Esto es a propósito: RF-31 necesita esta
// misma función también en el navegador (filtro "solo abiertas ahora"),
// evaluada con la hora real de quien mira la página, así que tiene que poder
// importarse tanto desde scripts/ (Node) como desde src/ (navegador, vía
// Vite/Astro) sin ningún cambio.

/** Orden de las iniciales de los días, de lunes a domingo. */
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

interface BloqueHorario {
  /** Índices en DIAS, en el orden en que hay que recorrerlos (circular). */
  diasIndices: number[];
  /** true si el bloque es "24H" (abierto todo el rango de días, sin franja). */
  veinticuatroHoras: boolean;
  /** Minutos desde medianoche. Solo si no es 24H. */
  aperturaMinutos?: number;
  cierreMinutos?: number;
}

/**
 * Convierte "HH:MM" a minutos desde medianoche. Devuelve `null` si el formato
 * no encaja (dos dígitos, dos puntos, dos dígitos).
 */
function horaAMinutos(hora: string): number | null {
  const coincidencia = /^([0-9]{2}):([0-9]{2})$/.exec(hora.trim());
  if (!coincidencia) return null;

  const horas = Number(coincidencia[1]);
  const minutos = Number(coincidencia[2]);
  if (horas > 23 || minutos > 59) return null;

  return horas * 60 + minutos;
}

/**
 * Traduce "L-V", "S" o "V-L" a la lista circular de índices de días que
 * cubre. Devuelve `null` si alguna letra no es una inicial de día válida.
 */
function diasARangoIndices(dias: string): number[] | null {
  const partes = dias.trim().split('-');
  if (partes.length === 1) {
    const indice = DIAS.indexOf(partes[0] as (typeof DIAS)[number]);
    if (indice === -1) return null;
    return [indice];
  }

  if (partes.length !== 2) return null;

  const inicio = DIAS.indexOf(partes[0] as (typeof DIAS)[number]);
  const fin = DIAS.indexOf(partes[1] as (typeof DIAS)[number]);
  if (inicio === -1 || fin === -1) return null;

  const indices: number[] = [];
  let actual = inicio;
  // Recorrido circular: si "fin" está antes que "inicio" en la semana, el
  // rango da la vuelta (p. ej. V-L: viernes, sábado, domingo, lunes).
  while (true) {
    indices.push(actual);
    if (actual === fin) break;
    actual = (actual + 1) % DIAS.length;
  }

  return indices;
}

/**
 * Interpreta un bloque de horario del tipo "L-V: 06:00-22:00" o "L-D: 24H".
 * Devuelve `null` si el bloque no encaja en ningún patrón conocido.
 */
function interpretarBloque(bloque: string): BloqueHorario | null {
  const coincidencia = /^([^:]+):\s*(.+)$/.exec(bloque.trim());
  if (!coincidencia) return null;

  const diasIndices = diasARangoIndices(coincidencia[1]);
  if (!diasIndices) return null;

  const franja = coincidencia[2].trim();

  if (franja.toUpperCase() === '24H') {
    return { diasIndices, veinticuatroHoras: true };
  }

  const coincidenciaFranja = /^([0-9]{2}:[0-9]{2})-([0-9]{2}:[0-9]{2})$/.exec(franja);
  if (!coincidenciaFranja) return null;

  const aperturaMinutos = horaAMinutos(coincidenciaFranja[1]);
  const cierreMinutos = horaAMinutos(coincidenciaFranja[2]);
  if (aperturaMinutos === null || cierreMinutos === null) return null;

  return { diasIndices, veinticuatroHoras: false, aperturaMinutos, cierreMinutos };
}

/**
 * Indica si una estación está abierta en el momento `fecha`, según su campo
 * `horario` tal como lo declara el MITECO.
 *
 * Si el campo está vacío o no se reconoce ningún bloque, devuelve `true`:
 * enseñar una estación cerrada como abierta molesta menos que ocultar una que
 * sí abre.
 */
export function estaAbierta(horario: string, fecha: Date): boolean {
  const texto = horario.trim();
  if (texto === '') return true;

  const bloques = texto
    .split(';')
    .map((b) => b.trim())
    .filter((b) => b !== '')
    .map(interpretarBloque);

  // Si ningún bloque se ha podido interpretar, el campo es ininteligible.
  if (bloques.every((b) => b === null)) return true;

  // getDay() de JS: 0 = domingo ... 6 = sábado. Lo llevamos al índice de
  // DIAS, donde 0 = lunes ... 6 = domingo.
  const diaSemanaJs = fecha.getDay();
  const diaActual = diaSemanaJs === 0 ? 6 : diaSemanaJs - 1;
  const minutosActuales = fecha.getHours() * 60 + fecha.getMinutes();

  for (const bloque of bloques) {
    if (!bloque) continue;
    if (!bloque.diasIndices.includes(diaActual)) continue;

    if (bloque.veinticuatroHoras) return true;

    const apertura = bloque.aperturaMinutos!;
    let cierre = bloque.cierreMinutos!;

    // Cierre menor o igual que la apertura: cruza medianoche, se le suma un
    // día entero antes de comparar.
    if (cierre <= apertura) cierre += 24 * 60;

    if (minutosActuales >= apertura && minutosActuales < cierre) return true;
  }

  // Puede que el bloque relevante sea el del día anterior, cruzando
  // medianoche hacia el momento actual. Se comprueba por separado porque el
  // día que hay que mirar en `bloque.diasIndices` es el de ayer.
  const diaAnterior = (diaActual + 6) % 7;
  for (const bloque of bloques) {
    if (!bloque) continue;
    if (bloque.veinticuatroHoras) continue; // ya cubierto arriba
    if (!bloque.diasIndices.includes(diaAnterior)) continue;

    const apertura = bloque.aperturaMinutos!;
    let cierre = bloque.cierreMinutos!;
    if (cierre <= apertura) cierre += 24 * 60;
    else continue; // no cruza medianoche, no afecta a "hoy"

    // "Ahora" expresado en minutos desde la medianoche de ayer.
    const minutosDesdeAyer = minutosActuales + 24 * 60;
    if (minutosDesdeAyer >= apertura && minutosDesdeAyer < cierre) return true;
  }

  return false;
}
