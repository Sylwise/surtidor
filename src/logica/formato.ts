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

/** "10986" → "10.986", "5068" → "5.068". Separador de miles español, para
 *  recuentos de estaciones, rótulos y zonas en las editoriales de "Hoy". Una
 *  sola función para que un recuento no se quede sin separador en un sitio
 *  mientras lo lleva en otro.
 *
 *  `useGrouping: true` explícito porque el valor por defecto de `es-ES`
 *  (`'auto'`) usa `minimumGroupingDigits: 2` del propio CLDR: agrupa
 *  "10.429" pero deja "5068" sin separador por tener un solo dígito antes
 *  del primer punto. Sin este ajuste, el mismo bug que se está corrigiendo
 *  aquí —un número de cuatro cifras sin separador junto a otro que sí lo
 *  lleva— habría vuelto a aparecer con cifras distintas. */
export function formatearNumero(cantidad: number): string {
  return cantidad.toLocaleString('es-ES', { useGrouping: true });
}

/** Fecha y hora legibles ("06/08 a las 16:49"), para el aviso de frescura
 *  (RF-43) en el cliente y para la marca de "actualizado" de las editoriales
 *  y de la tabla estática de zona. Única función en toda la aplicación para
 *  que no diverjan: `timeZone` fijo porque unas veces corre en el navegador
 *  del usuario y otras en el servidor de build, y cada uno tiene su propia
 *  hora local si no se fuerza una. */
export function formatearFechaHora(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return 'hora desconocida';
  return fecha.toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Solo la hora ("16:49"), para el hueco reducido de la barra de estado en
 *  móvil. Misma zona horaria que {@link formatearFechaHora}. */
export function formatearHora(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '--:--';
  return fecha.toLocaleTimeString('es-ES', {
    timeZone: 'Europe/Madrid',
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
