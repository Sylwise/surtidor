# ADR-0005 · La provincia es la unidad de datos; la zona es la unidad de consulta

**Fecha:** 2026-08-05 · **Estado:** aceptado

## Contexto

El primer diseño tenía un fichero JSON por provincia y una interfaz que solo
dejaba mirar una a la vez. Las fronteras provinciales no significan nada para
quien conduce: desde Vitoria-Gasteiz se reposta con normalidad en Llodio, en
Miranda de Ebro o subiendo a Bizkaia, y ninguna de esas opciones aparecería en
la misma pantalla.

Hay además un problema más sutil. Por ADR-0003 la escala de color es relativa al
conjunto mostrado. Si el conjunto es siempre una provincia, un verde en Álava y
un verde en Bizkaia no son el mismo precio, y el usuario no tiene forma de
saberlo.

## Decisión

Se separan dos conceptos que antes iban juntos:

- **Provincia: unidad de almacenamiento.** Sigue habiendo un fichero por
  provincia, `public/data/provincias/NN.json`. No cambia nada de la generación.
- **Zona: unidad de consulta.** Una zona es una lista de provincias. La interfaz
  siempre muestra una zona, descarga en paralelo los ficheros que la componen y
  los fusiona en memoria.

Una provincia suelta es simplemente una zona de un elemento, así que no hay dos
caminos de código: **hay uno solo, y siempre trabaja sobre una lista**.

Las zonas se declaran en `public/data/indice.json`. Salen tres familias:

1. **Cada provincia**, como zona de un elemento. 52 zonas.
2. **Cada comunidad autónoma**, con sus provincias. Euskadi es `01`, `48`, `20`.
**Solo esos dos tipos.** Ambos se generan automáticamente desde los catálogos
del ministerio, sin ninguna lista escrita a mano.

**Los nombres salen del catálogo oficial, nunca los inventamos nosotros.** Si el
catálogo dice `ARABA/ALAVA`, eso es lo que se muestra.

## Motivos

La zona no obliga a duplicar datos. Un fichero de provincia se descarga una vez
y sirve para todas las zonas que lo incluyan, y el navegador lo cachea.

La escala de color pasa a calcularse **sobre la zona mostrada**, que es
justamente el conjunto de estaciones entre las que el usuario puede elegir de
verdad. Con eso, ADR-0003 deja de tener el borde raro que tenía.

Y el coste de mirar Euskadi entero son tres peticiones pequeñas y paralelas de
unos 30-80 KB. No hace falta ningún fichero nuevo ni ningún endpoint agregado.

## Consecuencias

Buenas: se puede mirar una comunidad entera, o una provincia con sus limítrofes,
que es lo que de verdad importa a quien vive cerca de una frontera provincial. La escala de color gana sentido. La generación de
datos no cambia ni una línea.

Malas: hay que gestionar varias descargas en paralelo, con su fallo parcial. Si
uno de los tres ficheros de Euskadi falla, **se muestra lo que sí ha llegado y
se avisa de qué falta**, en vez de fallar entero.

Vigilar: una zona muy grande empieza a pesar. El listón es 300 KB comprimido de
datos por zona; por encima, o se recorta la zona o se sirve un resumen con solo
las coordenadas y el precio del combustible elegido.

Ojo con Canarias: régimen fiscal distinto y precios mucho más bajos. **No
mezclarla nunca en una zona con provincias peninsulares**, o la escala relativa
pintaría toda la península de rojo.

## Alternativas descartadas

- **Un fichero por comunidad además del de provincia.** Duplica datos y obliga a
  decidir cuál es la fuente de verdad. Y no resuelve las zonas de limítrofes.
- **Zonas agrupadas a mano.** Se propusieron y se descartaron: ver más abajo.
- **Un único fichero con toda España.** Unos 8 MB. Rompe RNF-12 y RNF-13.
- **Radio en kilómetros alrededor del usuario.** Es lo más correcto
  conceptualmente, y probablemente el destino final. Se descarta para la v1
  porque exige geolocalización concedida y un índice espacial, y deja sin
  respuesta el caso de quien planifica desde casa un viaje a otra provincia. La
  zona funciona sin permisos y es enlazable.

## Nota de implementación

Los identificadores de comunidad autónoma **no se escriben a mano**. Se leen del
endpoint `Listados/ComunidadesAutonomas` del ministerio y se guardan en
`indice.json` durante la generación. La numeración del MITECO no tiene por qué
coincidir con la del INE, y ya hay una errata conocida en ese catálogo
(`IDPovincia`, ver `docs/04-fuente-datos.md`).


## Corrección de 2026-08-06 · fuera las zonas a mano

La primera versión de este ADR incluía un tercer tipo de zona, **definida a
mano**, y ponía como ejemplo "Euskadi y alrededores" agrupando las tres
provincias vascas con Navarra y Burgos.

Se retira, por dos motivos.

**Es una agrupación con carga política.** La intención era "sitios donde se
reposta desde Vitoria-Gasteiz", pero el usuario no ve la intención: ve el nombre.
Esa agrupación concreta se solapa con un mapa territorial que está en disputa, y
la inclusión de Navarra es justamente el punto en discusión. Un servicio de
precios de carburante no tiene por qué opinar sobre eso, ni tiene nada que ganar
haciéndolo.

**Y no era el caso aislado, era el mecanismo.** El problema no es esa zona: es
que cualquier lista de agrupaciones escogidas a mano es una sucesión de juicios
editoriales. Por qué Euskadi y no Cataluña. Por qué esa combinación de provincias
y no otra. Cada entrada es una decisión que hay que defender, en las 52
provincias, y el proyecto no gana nada a cambio.

Se evaluó sustituirlas por **provincia y limítrofes**, calculado por adyacencia
geográfica. Objetivo, uniforme, sin lista que mantener. También se descarta:

- **Sería contenido duplicado.** Cada zona de limítrofes es un superconjunto de
  páginas que ya existen, y 52 páginas cuyo contenido ya está repartido en otras
  es justo el contenido delgado que hunde el ADR-0007.
- **El selector pasaría de 71 entradas a 123**, contra el presupuesto de
  interfaz.
- **Las comunidades ya cubren el caso normal.** Quien vive en Vitoria-Gasteiz
  tiene Euskadi entero en un toque.

Queda sin cubrir repostar cruzando frontera provincial —de Vitoria-Gasteiz a
Miranda de Ebro—, pero eso **no es un problema de zonas, es un problema de
mapa**: al desplazarse hacia el sur deberían aparecer las de Burgos. Cargar la
provincia vecina al desplazar el mapa lo resuelve mejor y sin páginas nuevas.
Está en la v2.

Regla que queda de aquí en adelante: **el proyecto no inventa nombres de lugar ni
agrupaciones territoriales.** Los nombres vienen del catálogo del ministerio y
las agrupaciones, de la geografía o de los límites administrativos oficiales.
