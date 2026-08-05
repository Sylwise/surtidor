// Formato de números a la española: coma decimal. Ver docs/03-arquitectura.md
// (los datos llegan con coma y se normalizan a number; aquí se hace el camino
// inverso solo para mostrar).

/** "1.409" → "1,409". Siempre tres decimales, como el surtidor. */
export function formatearPrecio(precio: number): string {
  return precio.toFixed(3).replace('.', ',');
}

/** "3.2" → "3,20 €". Dos decimales, como una caja registradora. */
export function formatearEuros(cantidad: number): string {
  return `${cantidad.toFixed(2).replace('.', ',')} €`;
}
