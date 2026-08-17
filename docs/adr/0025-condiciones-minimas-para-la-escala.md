# ADR-0025 · La escala de color exige muestra y dispersión suficientes

**Fecha:** 2026-08-17 · **Estado:** propuesto · **Acota:** ADR-0003

## Contexto

ADR-0003 fija que el color sale del percentil del precio dentro del conjunto
mostrado, con cinco bandas. La escala ordena correctamente los precios, pero su
fuerza visual puede afirmar más de lo que la diferencia económica justifica.

El problema aparece por dos vías distintas:

- con pocas estaciones, las cinco bandas fuerzan diferencias cromáticas entre
  un conjunto que apenas permite graduarlas;
- con muchas estaciones y muy poca dispersión, los extremos siguen recibiendo
  colores opuestos aunque sus precios estén prácticamente juntos.

Los combustibles minoritarios harán más frecuente el primer caso, pero no lo
crean: ya puede aparecer en territorios pequeños y afecta a cualquier
combustible. Por tanto, la regla no puede depender del nombre del producto ni
aplicarse solo a una futura ampliación del catálogo.

No hay todavía en el repositorio una medición reproducible que permita fijar
los umbrales. Antes de aceptar este ADR hay que conservar la fecha y fuente del
conjunto analizado y contrastar las distribuciones reales por combustible y
territorio.

## Decisión propuesta

La escala de cinco bandas solo se aplica cuando el conjunto mostrado cumple a
la vez dos condiciones declaradas como constantes únicas:

1. un número mínimo de estaciones que vendan el combustible seleccionado;
2. una amplitud mínima entre el precio menor y el mayor.

Los valores de ambas constantes se fijarán después de medir los datos reales.
No forman parte de esta propuesta mientras esa medición no sea trazable.

Cuando falle cualquiera de las dos condiciones, todos los elementos usan la
banda neutra `--p3`. El precio sigue escrito siempre: la supresión afecta a la
comparación cromática, nunca al dato.

La regla se aplica a todos los consumidores de la escala compartida, incluidos
mapa, lista y comparaciones. Un mismo precio no puede aparecer neutral en un
componente y en una banda extrema en otro dentro del mismo contexto.

Los conjuntos pequeños se resuelven así:

- sin estaciones, se muestra el estado vacío correspondiente;
- con una estación, se usa la banda neutra y no se presenta como «la más
  barata»;
- con dos o más estaciones, la estación más barata conserva el tratamiento
  `--mejor`; si varias empatan en el mínimo, todas lo conservan.

Cuando la escala esté suprimida, la interfaz explica brevemente que el conjunto
no ofrece muestra o variación suficiente para comparar mediante colores. El
lugar y el texto exactos se deciden con el diseño delante.

## Motivos

El precio de pantalla es el precio del cartel. El color añade una interpretación:
«esto es barato o caro comparado con lo que tienes cerca». La posición relativa
es cierta incluso en una muestra pequeña, pero cinco grados visuales pueden
exagerar tanto una muestra escasa como una diferencia de precio irrelevante.

Usar muestra y dispersión evita confundir cantidad de observaciones con fuerza
de la señal. Mantener el precio escrito y los empates en el mínimo preserva los
hechos verificables sin atribuir precisión a la escala.

## Consecuencias

Buenas: la escala deja de amplificar diferencias que los datos no sostienen y
mantiene una semántica coherente en todos sus consumidores. La regla sirve para
combustibles actuales y futuros sin excepciones por producto.

Malas: hacen falta dos umbrales y un mensaje de interfaz. Los umbrales son una
decisión de producto basada en datos, no una propiedad estadística universal, y
cualquier cambio deberá conservar la medición que lo justifica.

Mientras el ADR siga propuesto, ADR-0003 continúa vigente sin cambios y RF-118
permanece pendiente.

## Alternativas descartadas

- **Usar solo un mínimo de muestra.** No cubre un conjunto grande cuyos precios
  apenas difieren.
- **Dejar la escala tal cual.** Mantiene casos en los que una diferencia mínima
  recibe el contraste completo entre extremos.
- **Reducir el número de bandas.** Añade comportamientos intermedios que también
  necesitarían umbrales y explicación sin resolver la dispersión mínima.
- **Calcular el percentil sobre el conjunto nacional.** Rompe la pregunta local
  de ADR-0003 y permite comparar colores de territorios que no son alternativas
  prácticas entre sí.
- **Ocultar las estaciones.** Esconde precios reales cuando lo que carece de
  respaldo es la interpretación cromática, no el dato.
