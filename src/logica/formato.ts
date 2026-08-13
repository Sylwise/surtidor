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
 *  (RF-43) en el cliente, para la marca de "actualizado" de las editoriales y
 *  de la tabla estática de zona, y para la versión compacta de móvil ("ACT.
 *  06/08, 16:49"): sin fecha no se sabe si el dato es de hoy o de ayer.
 *  Única función en toda la aplicación para que no diverjan: `timeZone`
 *  fijo porque unas veces corre en el navegador del usuario y otras en el
 *  servidor de build, y cada uno tiene su propia hora local si no se
 *  fuerza una. */
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

// RF-86: el ministerio devuelve dirección y municipio en mayúsculas. Es
// prosa, no un rótulo, así que se pasa a caja de título con estas
// partículas en minúscula (docs/05-diseno.md#Mayúsculas). El rótulo de la
// estación se deja verbatim: esta función no se aplica ahí.
//
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

export type TipoNombreTerritorial = 'ccaa' | 'provincia' | 'municipio';

// RF-76: estas son claves del catálogo, no aliases para emparejar. La tabla
// solo decide qué se pinta y deliberadamente tiene las 19 filas completas.
const NOMBRES_VISIBLES_CCAA: Readonly<Record<string, string>> = {
  'Castilla la Mancha': 'Castilla-La Mancha',
  'Comunidad Valenciana': 'Comunitat Valenciana',
  Andalucia: 'Andalucía',
  'País Vasco': 'País Vasco',
  Asturias: 'Asturias',
  'Castilla y León': 'Castilla y León',
  Extremadura: 'Extremadura',
  Baleares: 'Illes Balears',
  Cataluña: 'Cataluña',
  Cantabria: 'Cantabria',
  Ceuta: 'Ceuta',
  Galicia: 'Galicia',
  Aragón: 'Aragón',
  Madrid: 'Madrid',
  Melilla: 'Melilla',
  Murcia: 'Murcia',
  Navarra: 'Navarra',
  Canarias: 'Canarias',
  'Rioja (La)': 'La Rioja',
};

const ARTICULO_FINAL = /\s+\((La|A|El|Els|Les|Illes|Las|Los)\)$/i;

/** Devuelve solo la etiqueta visible; la cadena cruda sigue siendo la clave. */
export function nombreVisible(nombreMinisterio: string, tipo: TipoNombreTerritorial): string {
  if (tipo === 'ccaa') {
    const visible = NOMBRES_VISIBLES_CCAA[nombreMinisterio];
    if (!visible) {
      throw new Error(`Falta el nombre visible de la comunidad autónoma \"${nombreMinisterio}\" del catálogo del ministerio.`);
    }
    return visible;
  }

  const sinEspacios = nombreMinisterio.trim();
  const coincidencia = sinEspacios.match(ARTICULO_FINAL);
  const reordenado = coincidencia
    ? `${coincidencia[1]} ${sinEspacios.slice(0, coincidencia.index)}`
    : sinEspacios;
  return cajaDeTitulo(reordenado);
}
