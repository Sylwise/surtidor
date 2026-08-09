# ADR-0021 · Racimos estables al desplazar el mapa

**Fecha:** 2026-08-09 · **Estado:** aceptado · **Modifica:** ADR-0006

## Contexto

ADR-0006 decidió agrupar las estaciones por debajo del zoom 11 y recalcular la
disposición al terminar cada gesto del mapa. La implementación repartía las
estaciones en una rejilla anclada a las coordenadas de pantalla y reutilizaba
los marcadores de racimo por su posición en el resultado.

En una zona densa como Madrid, desplazar el mapa incluso una distancia pequeña
hace que las estaciones crucen los límites de esa rejilla. Los racimos se
calculan de nuevo con miembros distintos y el marcador que ocupaba una posición
en el resultado pasa de golpe a representar otro grupo, con otra cifra y otra
ubicación. El efecto visible es que todas las pastillas parecen regenerarse
desde cero aunque el nivel de zoom y la relación geográfica entre las
estaciones no hayan cambiado.

## Decisión

La rejilla de agrupación se ancla a **coordenadas globales del mapa para el
nivel de zoom actual**, no al origen de la pantalla. Un desplazamiento conserva
la pertenencia de cada estación a su celda; un cambio de zoom sí puede formar
racimos distintos.

Cada racimo se identifica mediante los **identificadores ordenados de las
estaciones que lo componen**, no mediante su índice en el resultado del
cálculo. Mientras conserve sus miembros, conserva también el mismo marcador
del DOM. Solo se crean o retiran marcadores cuando aparece o desaparece un
racimo real.

La disposición se sigue recalculando al terminar cada gesto, nunca en cada
fotograma del arrastre, como decidió ADR-0006.

## Motivos

La pertenencia a un grupo debe depender de la posición geográfica y del nivel
de zoom, no del encuadre accidental de la pantalla. Del mismo modo, la
identidad de una pastilla es el conjunto de estaciones que representa, no el
orden en que lo devuelve un recorrido interno.

Así MapLibre puede desplazar durante el gesto los mismos nodos que ya estaban
en pantalla y el recálculo final solo modifica los racimos que hayan cambiado
de verdad.

## Consecuencias

Buenas: un desplazamiento del mapa ya no reorganiza los racimos ni intercambia
la identidad de sus pastillas. La cifra permanece asociada al mismo conjunto de
estaciones. El zoom conserva su función: al cambiar la escala puede cambiar
también la agrupación.

Malas: la gestión de marcadores deja de ser un array reutilizado por posición y
pasa a mantener un registro por identidad de racimo. La implementación debe
retirar explícitamente las entradas que ya no existan.

La función pura de agrupación debe probar que trasladar todos los puntos la
misma distancia, sin cambiar la escala, conserva los mismos grupos. La
integración con el mapa debe usar la identidad estable para conservar el nodo
del DOM mientras sobreviva el racimo.

## Alternativas descartadas

- **Mantener la rejilla anclada a la pantalla.** Reproduce el salto que motiva
  esta decisión: un desplazamiento altera grupos aunque no cambie el zoom.
- **Seguir reutilizando marcadores por índice.** El orden del resultado no es la
  identidad de un grupo y permite que una pastilla pase a representar otro
  racimo de golpe.
- **Recalcular durante cada fotograma.** No resuelve la inestabilidad de la
  rejilla y contradice la decisión de fluidez de ADR-0006.
