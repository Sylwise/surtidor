# ADR-0006 · Marcadores del DOM con agrupación y colisiones propias

**Fecha:** 2026-08-05 · **Estado:** aceptado · **Modifica:** ADR-0002

## Contexto

La primera implementación pintaba cada estación con un `maplibregl.Marker` y un
elemento HTML propio. Con datos reales de Álava aparecieron ocho o nueve
etiquetas superpuestas e ilegibles en el racimo de Vitoria-Gasteiz.

**No es un problema estético: si la más barata queda debajo de otra, la
aplicación no cumple su única función.** Y Álava tiene unas 90 estaciones. Madrid
pasa de 600.

Los marcadores del DOM no saben nada unos de otros: no hay detección de
colisiones y con cientos de nodos el desplazamiento se atasca.

## Decisión

Se mantienen los **marcadores del DOM**, y se añaden dos cosas:

1. **Agrupación por racimos** por debajo del zoom 11, con el número de estaciones
   y el precio mínimo del grupo. Al pulsar, el mapa se acerca.
2. **Detección de colisiones propia**, al terminar cada gesto del mapa:
   - proyectar las estaciones visibles a coordenadas de pantalla
   - ordenarlas por precio ascendente
   - colocar de forma voraz, descartando la que solape con una ya colocada
   - las descartadas se ocultan, no se amontonan

Como la cola va ordenada por precio, **la más barata se coloca siempre primero y
nunca pierde una colisión** (RF-18).

## Motivos

La alternativa era una capa `symbol` de MapLibre, que trae la detección de
colisiones de fábrica. Se descarta por una razón de proceso, no de calidad.

Con `symbol`, el fondo de la píldora es un *sprite*: una imagen que hay que
generar, con esquinas estirables de nueve zonas para adaptarse al ancho variable
del precio, en 2x y 3x para pantallas densas. Queda nítido y se puede hacer bien.
Pero **cada retoque de radio, sombra, relleno o tipografía obliga a regenerar el
sprite**.

Este proyecto se desarrolla iterando sobre el aspecto. Encarecer el bucle de
"cambio esto y miro cómo queda" es el peor sitio donde meter fricción. Con CSS,
ese bucle es una línea.

Se conserva además todo lo que la capa `symbol` no da: sombra, el poste del
tótem, transiciones, estados de foco y de selección, y contorno de la más barata.

## Consecuencias

Buenas: sin solapamientos ilegibles, con el aspecto íntegro y editable en CSS.
La navegación por teclado sigue funcionando, porque los marcadores son nodos
enfocables de verdad (RNF-20). Se cumplen RF-16 y RF-18.

Malas, y hay que asumirlas:

- **Durante el arrastre las etiquetas pueden solaparse un instante.** El cálculo
  corre al terminar el gesto, no en cada fotograma, porque hacerlo en cada uno
  costaría fluidez. Se recolocan al soltar.
- **Es código propio.** Unas cien líneas que hay que mantener y probar, frente a
  algo que MapLibre ya trae hecho.
- **Techo de rendimiento.** Por encima de unos 150 marcadores simultáneos hay que
  medir. Con la agrupación activa no debería alcanzarse; **si se alcanza, la
  salida está escrita más abajo.**

## Vía de escape

Si el rendimiento no aguanta con datos reales de Madrid o Barcelona, se cambia a
capa `symbol` con `symbol-sort-key` por precio, generando los sprites de la
píldora. Es la decisión que se descarta aquí, no una que sea imposible.

El disparador es concreto: **si el desplazamiento baja de 30 fps con la zona más
poblada** (RNF-14). Si eso ocurre, se escribe un ADR nuevo que supersede a este.

## Alternativas descartadas

- **Capa `symbol` desde el principio.** Correcta y más barata de escribir, pero
  encarece cada iteración visual. Ver arriba.
- **Ocultar las caras cuando hay aglomeración.** Esconde datos que el usuario no
  ha pedido esconder. La agrupación es honesta; el filtrado silencioso no.
- **Dejar el solapamiento.** No es una opción: rompe la función del producto.
