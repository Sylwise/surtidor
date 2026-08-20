# ADR-0027 · Un selector de combustible en lugar de cuatro pastillas

**Fecha:** 2026-08-20 · **Estado:** aceptado · **Resuelve:** V2-12

## Contexto

V2-12 pide añadir gasóleo B y GLP. La API del ministerio los trae y la
demanda está documentada: Search Console recoge consultas como «precio gasoil
agrícola león», y un usuario de GLP pidió la función sin que nadie le
preguntara.

El problema es dónde ponerlos. La fila de combustibles tiene cuatro pastillas
y no vive en el ancho de la ventana: vive en el rail izquierdo, de unos
380 px, tan estrecho como un móvil. Seis pastillas no caben en ninguna de las
dos pantallas.

Se dibujaron cuatro alternativas en Pencil a lo largo de varias rondas.
Ninguna es indolora, y conviene decir por qué: **las cuatro pastillas
funcionan porque cuatro opciones se ven a la vez.** Cualquier control que las
sustituya por un estado plegado enseña menos. No hay dibujo que arregle eso.

## Decisión

**Las cuatro pastillas se sustituyen por un selector de combustible
desplegable**, hermano del selector de zona, con los seis combustibles
dentro.

**El selector de zona baja de la cabecera al rail en escritorio**, junto al
de combustible. En móvil ya conviven así. Con eso los dos controles tienen la
misma forma y la misma posición en las dos pantallas, y el comportamiento
queda unificado.

**El panel abierto agrupa los combustibles en dos secciones:** habituales
(gasolina 95, diésel, gasolina 98, diésel +) y alternativos (gasóleo B, GLP).
Cada uno muestra el precio mínimo de la zona a su derecha, en monoespaciada y
sin píldora de color: las píldoras pertenecen a las estaciones, no a los
combustibles, igual que las pastillas provinciales de la vista nacional son
cromáticamente neutras.

**El selector cerrado usa una pastilla oscura sólida con la denominación
dominante y un descriptor pequeño a su lado.** En las gasolinas, la cifra
(`95` o `98`) domina y `Gasolina` acompaña; los diéseles mantienen su nombre
como elemento principal. Como `Gasóleo B` y `GLP` no admiten esa estructura
de cifra más palabra, muestran el nombre completo como principal y
`Alternativo` como descriptor. La flecha va sin círculo. No lleva precio:
duplicaría la primera fila de la lista, que está inmediatamente debajo.

**El GLP no es comparable con el resto y se marca como tal.** Un coche de GLP
consume entre un 20 y un 30 % más volumen, así que su precio por litro
saldría siempre el más bajo sin serlo por kilómetro. Su fila del panel va sin
banda de color y con una nota que lo explica. Queda además fuera de las
comparaciones entre combustibles, de las editoriales y de la imagen de
compartición.

**Cuando el combustible elegido no se vende en el municipio pero sí en la
provincia, el ámbito se ensancha solo** y se dice: «GLP · ARABA/ÁLAVA — no
hay estaciones con GLP en Vitoria-Gasteiz, se muestran las 9 de la
provincia». Si tampoco hay ninguna en la zona, como ocurre con el GLP y el
gasóleo B en Ceuta y en Melilla, se muestra un mensaje claro de que no hay,
nunca un mapa o una lista vacíos.

## Motivos

Un selector no gasta más presupuesto de interfaz que las pastillas: es un
control con seis estados en lugar de cuatro botones. Y a diferencia de la
fila, no tiene techo: si algún día entra el GNC, cabe.

Bajar el selector de zona al rail no es un capricho de simetría. Deja los dos
controles del mismo tipo juntos, elimina la diferencia de comportamiento
entre escritorio y móvil, y hace que el usuario aprenda una sola forma de
elegir.

## Consecuencias

**Esto es un intercambio, no una mejora, y conviene no disfrazarlo.** Quien
echa gasolina 95 y quiere ver diésel pasa de un toque a dos, siempre. Se
acepta porque el combustible se elige una vez y se recuerda entre visitas
(RF-34): es una configuración inicial disfrazada de control permanente, no
una acción repetida.

Buenas: entran dos combustibles que no existían. La fila deja de tener techo.
El panel enseña de un vistazo a cuánto está cada combustible en la zona, cosa
que las pastillas no hacían.

Malas, y aceptadas:

- Dos toques en lugar de uno para cambiar de combustible.
- Cuatro opciones visibles pasan a cero: hay que abrir para ver qué hay.
- Aumenta el número de listas servidas en el HTML, de cuatro a seis. Hay que
  medir cuánto crece el build y el peso de las páginas, y compararlo con
  RNF-12, antes de dar el hito por bueno.

## Alternativas descartadas

- **Seis pastillas en la misma fila.** No caben en 380 px, ni en el rail ni
  en un móvil.
- **Gasolina 95 y diésel visibles, más un control «Otros».** Esconde el 98 y
  el diésel + para hacer sitio, así que sigue enseñando menos que hoy, y
  además obliga a intuir que el GLP está dentro de «Otros».
- **Sacar los combustibles alternativos a páginas propias por provincia,
  enlazadas desde el pie de la lista.** Se llegó a redactar. Se descarta
  porque el punto de entrada no funciona: nadie baja al final de una lista de
  precios buscando GLP, así que ese enlace lo vería justo quien no lo
  necesita.
- **Renunciar al gasóleo B y al GLP.** Era una salida legítima. Se descarta
  porque un mapa de carburantes que no trae todos los carburantes está
  incompleto, y porque la demanda está documentada.
