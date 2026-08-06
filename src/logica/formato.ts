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

// RF-86: el ministerio devuelve dirección y municipio en mayúsculas. Es
// prosa, no un rótulo, así que se pasa a caja de título con estas
// partículas en minúscula (docs/05-diseno.md#Mayúsculas). El rótulo de la
// estación y la provincia se dejan verbatim: esta función no se aplica ahí.
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'lo', 'los', 'y', 'e', 'a', 'en']);

/** "AVENIDA DE LOS HUETOS, 64" → "Avenida de los Huetos, 64". */
export function cajaDeTitulo(texto: string): string {
  let esPrimeraPalabra = true;
  return texto.toLowerCase().replace(/[\p{L}\p{N}][\p{L}\p{N}'’]*/gu, (palabra) => {
    const capitalizar = esPrimeraPalabra || !PARTICULAS.has(palabra);
    esPrimeraPalabra = false;
    return capitalizar ? palabra.charAt(0).toUpperCase() + palabra.slice(1) : palabra;
  });
}
