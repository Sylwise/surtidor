# ADR-0003 · La escala de color es relativa a la provincia

**Fecha:** 2026-08-05 · **Estado:** aceptado

## Contexto

Hay que codificar por color si un precio es bueno. La forma habitual es fijar
umbrales absolutos: por debajo de 1,45 verde, por encima de 1,60 rojo.

## Decisión

El color sale del **percentil del precio entre todas las estaciones públicas de
la zona que venden el combustible seleccionado**, no de umbrales absolutos. Ver
[ADR-0005](0005-provincia-unidad-y-zonas.md) para qué es una zona y
[ADR-0025](0025-condiciones-minimas-para-la-escala.md) para las condiciones
mínimas que permiten aplicar las bandas.

El conjunto de cálculo no cambia con los filtros de visualización. «Solo
abiertas» puede ocultar estaciones, pero la escala sigue usando todas las
estaciones públicas de la zona que venden el combustible. Recalcularla al
activar el filtro haría bailar los colores sin que hubiera cambiado ningún
precio y rompería la comparación estable dentro de la zona.

Bandas: 0-15 % `--p1`, 15-40 % `--p2`, 40-70 % `--p3`, 70-90 % `--p4`, 90-100 %
`--p5`. La más barata se pinta en `--mejor`, con contorno y cuerpo mayor.

**Corrección de 2026-08-05:** la más barata se pintaba en `--signal`, ámbar. Era
un error. El ámbar comparte familia de tono con `--p4` y `--p5`, el extremo caro,
así que el marcador más importante quedaba vestido del color del que hay que
huir. `--signal` queda relegado al chrome, donde el fondo es oscuro y no compite
con ninguna escala.

## Motivos

Los precios varían mucho entre provincias y se mueven con el tiempo. Un umbral
absoluto pintaría provincias enteras de rojo en una semana mala, sin decirle
nada útil a nadie.

La pregunta real del usuario no es "¿es barato esto en España?", sino "¿es
barato esto **comparado con donde puedo ir yo hoy**?". La escala relativa
responde a esa pregunta y la absoluta no.

Consecuencia obligada: al cambiar de combustible o de provincia, **hay que
recalcular todos los colores**. El color no es una propiedad de la estación.

## Consecuencias

Buenas: el color siempre significa algo accionable. Se mantiene útil sin
mantenimiento aunque los precios suban un 30 %.

Malas: no se pueden comparar colores entre zonas. Un verde en Euskadi y un verde
en Madrid no son el mismo precio. Dentro de una zona sí son comparables, que es
lo que importa: el usuario elige entre las estaciones a las que puede ir.

Caso a vigilar: **Canarias nunca va en la misma zona que provincias
peninsulares.** Su régimen fiscal hace que los precios sean mucho más bajos, y
mezclarlas pintaría toda la península de rojo.

**La banda central es gris a propósito**, no es un color a medio decidir. Afirma
que la mayoría de estaciones no tienen nada de particular y no deben llamar la
atención.

**El color nunca va solo** (RNF-21): el precio va siempre escrito dentro del
marcador. La escala evita rojo-verde puro porque se pierde con deuteranopia; teal
contra terracota conserva diferencia de luminosidad además de tono.
