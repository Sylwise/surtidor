# ADR-0025 · La escala de color exige muestra y dispersión suficientes

**Fecha:** 2026-08-17 · **Estado:** aceptado · **Acota:** ADR-0003

## Contexto

ADR-0003 fija que el color sale del percentil del precio dentro del conjunto
de cálculo, con cinco bandas. La escala ordena correctamente los precios, pero
su fuerza visual puede afirmar más de lo que la diferencia económica justifica.

El problema aparece por dos vías distintas:

- con menos de dos precios comparables no existe una relación que ordenar;
- con dos o más precios y muy poca dispersión, los extremos siguen recibiendo
  colores opuestos aunque estén prácticamente juntos.

Los combustibles minoritarios harán más frecuente el primer caso, pero no lo
crean: ya aparece en territorios pequeños y afecta a cualquier combustible. Por
tanto, la regla no puede depender del nombre del producto ni aplicarse solo a
una futura ampliación del catálogo.

La medición del 17 de agosto de 2026, sobre 11.439 estaciones descargadas del
MITECO, descarta usar 12 estaciones como mínimo general: neutralizaría 926 de
las 1.078 páginas municipales con gasolina 95, el 85,90 %. Los tres casos
medidos que motivan la corrección —Alcalá de los Gazules, Coria y Valencia de
Alcántara— tienen tres precios comparables de gasolina 95 y amplitudes de 16 o
17 milésimas por litro. Alcalá de los Gazules y Valencia de Alcántara tienen
tres estaciones en la página; Coria tiene cuatro, pero solo tres venden ese
combustible. Un mínimo de muestra de 3 no evitaría en ninguno el contraste
completo entre la más barata y `--p5`.

## Decisión

La escala de cinco bandas se rige por dos constantes únicas y declaradas:

- `MINIMO_MUESTRA_ESCALA = 2` precios comparables;
- `AMPLITUD_MINIMA_ESCALA_MILESIMAS = 20` milésimas por litro.

Con menos de dos precios comparables no hay nada que ordenar y no se aplica la
escala. Con dos o más, la condición que manda es la dispersión: si la diferencia
entre el precio mayor y el menor es inferior a 20 milésimas por litro, tampoco
se aplica. Una amplitud de exactamente 20 milésimas sí permite aplicar las
bandas.

Cuando no se aplique la escala, todos los elementos usan la banda neutra `--p3`
y, si hay al menos dos precios comparables, la estación más barata conserva el
tratamiento `--mejor`. El precio sigue escrito siempre: la supresión afecta a
la comparación cromática, nunca al dato.

La regla se aplica a todos los consumidores de la escala compartida, incluidos
mapa, lista y comparaciones. Un mismo precio no puede aparecer neutral en un
componente y en una banda extrema en otro dentro del mismo contexto.

Los conjuntos pequeños y los empates se resuelven así:

- sin estaciones, se muestra el estado vacío correspondiente;
- con una estación, se usa la banda neutra y no se presenta como «la más
  barata»;
- con dos o más estaciones, la estación más barata conserva el tratamiento
  `--mejor`; si varias empatan en el mínimo, todas lo conservan.

Cuando la escala esté suprimida, la interfaz explica brevemente que el conjunto
no ofrece muestra o variación suficiente para comparar mediante colores. El
lugar y el texto exactos se deciden con el diseño delante.

En la medición, la dispersión inferior a 20 milésimas afecta a 53 páginas
municipales con gasolina 95, el 4,92 %. Otras 10 quedan neutralizadas por el
mínimo de muestra porque solo tienen un precio comparable. La suma de ambas
reglas afecta a 63 páginas, el 5,84 %. A nivel territorial hay seis casos
zona-combustible repartidos entre cuatro páginas: Ceuta y Melilla con gasolina
95, y Melilla con diésel, cada territorio con su página de provincia y la de
comunidad.

## Motivos

El precio de pantalla es el precio del cartel. El color añade una interpretación:
«esto es barato o caro comparado con lo que tienes cerca». La posición relativa
es cierta con dos precios, pero cinco grados visuales pueden exagerar una
diferencia de precio irrelevante.

El mínimo de muestra cubre únicamente el caso degenerado. La dispersión es la
regla que resuelve el problema real: conserva el contraste cuando dos
estaciones difieren de forma sustancial y lo suprime cuando incluso un conjunto
mayor apenas varía. Mantener el precio escrito y los empates en el mínimo
preserva los hechos verificables sin atribuir precisión a la escala.

## Consecuencias

Buenas: la escala deja de amplificar diferencias que los datos no sostienen y
mantiene una semántica coherente en todos sus consumidores. La regla sirve para
combustibles actuales y futuros sin excepciones por producto.

Malas: hacen falta dos umbrales y un mensaje de interfaz. Los umbrales son una
decisión de producto basada en datos, no una propiedad estadística universal, y
cualquier cambio deberá conservar la medición que lo justifica.

La supresión no queda limitada a un caso raro de municipio pequeño. Melilla
entera tiene una amplitud de un céntimo en gasolina 95, así que cualquiera que
abra esa zona verá el mapa neutro. La explicación en pantalla es obligatoria y
su forma se decide con el diseño delante.

## Alternativas descartadas

- **Usar 12 estaciones como mínimo.** Neutralizaría el 85,90 % de las páginas
  municipales con gasolina 95 y ocultaría comparaciones útiles con pocos
  precios pero una diferencia grande.
- **Usar 3 estaciones como mínimo.** No resuelve los tres casos reales medidos:
  todos tienen exactamente tres precios comparables de gasolina 95 y una
  amplitud de 16 o 17 milésimas.
- **Usar solo un mínimo de muestra.** No cubre un conjunto grande cuyos precios
  apenas difieren y neutraliza conjuntos pequeños con diferencias relevantes.
- **Dejar la escala tal cual.** Mantiene casos en los que una diferencia mínima
  recibe el contraste completo entre extremos.
- **Reducir el número de bandas.** Añade comportamientos intermedios que también
  necesitarían umbrales y explicación sin resolver la dispersión mínima.
- **Calcular el percentil sobre el conjunto nacional.** Rompe la pregunta local
  de ADR-0003 y permite comparar colores de territorios que no son alternativas
  prácticas entre sí.
- **Ocultar las estaciones.** Esconde precios reales cuando lo que carece de
  respaldo es la interpretación cromática, no el dato.
