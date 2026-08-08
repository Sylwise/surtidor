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

/** Fecha y hora legibles ("06/08 a las 16:49"), para el aviso de frescura
 *  (RF-43) en el cliente y para la marca de "actualizado" de la tabla
 *  estática de zona. Misma función en los dos sitios para que no diverjan. */
export function formatearFechaHora(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return 'hora desconocida';
  return fecha.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// RF-86: el ministerio devuelve dirección y municipio en mayúsculas. Es
// prosa, no un rótulo, así que se pasa a caja de título con estas
// partículas en minúscula (docs/05-diseno.md#Mayúsculas). El rótulo de la
// estación se deja verbatim: esta función no se aplica ahí.
//
// La provincia también se deja verbatim (RF-76) en todo lo que un
// rastreador ve: portada, `<h1>`, `<title>`, JSON-LD. La única excepción es
// el panel del selector de zona (docs/05-diseno.md#Selector-de-zona): es un
// `<button>` sin `href` (ADR-0017), invisible para un rastreador, así que
// ahí sí gana la legibilidad y se pasa por esta misma función.
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
