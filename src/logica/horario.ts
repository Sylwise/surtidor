// TODO: sustituir por scripts/lib/horario.ts::estaAbierta(horario, fecha), que
// está escribiendo otro agente en paralelo (hito H4, ver docs/06-roadmap.md) y
// todavía no existe en este árbol de trabajo. Cuando aparezca, Controles.ts y
// Lista.ts deben importar esa función en vez de `estaAbiertaStub` de aquí, y
// este fichero puede borrarse entero.
//
// Regla por defecto del proyecto (CU-4, docs/01-especificacion.md): un campo de
// horario vacío o ininteligible cuenta como abierta. Es menos malo enseñar una
// estación de más que ocultar una que sí abre.

/**
 * Versión mínima de desarrollo del intérprete de horarios. No entiende de
 * verdad el campo `Horario` del ministerio: trata "L-D: 24H" como abierta de
 * forma explícita, y cualquier otro valor (vacío, horario parcial, texto
 * ininteligible) también como abierta, siguiendo la regla por defecto.
 *
 * El filtro "solo abiertas" queda así conectado de extremo a extremo aunque
 * hoy no cierre ninguna estación; cuando llegue el intérprete real empezará a
 * filtrar sin tocar ni Lista.ts ni Controles.ts, solo este import.
 */
export function estaAbiertaStub(_horario: string, _fecha: Date = new Date()): boolean {
  return true;
}
