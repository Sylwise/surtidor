# ADR-0026 · Una página de municipio no se pierde por una ausencia

**Fecha:** 2026-08-18 · **Estado:** aceptado · **Amplía:** ADR-0012

## Contexto

Una página de municipio se genera si el municipio tiene al menos
`MINIMO_ESTACIONES_MUNICIPIO` estaciones visibles, que hoy vale 3 (RF-60).
Por debajo, la URL devuelve 404 real (ADR-0012).

Search Console detectó dos de esos 404 en agosto de 2026: Puerto Lápice
(Ciudad Real) y Anglès (Girona). Ambas páginas existieron, Google las
indexó, y dejaron de generarse al bajar el municipio del umbral.

La medición sobre la ventana histórica de 90 días (16 de mayo a 13 de agosto
de 2026) muestra que el problema no es el que parecía:

- 307 municipios, el 28,19 % de las páginas, tienen exactamente 3
  estaciones: pierden su página con una sola ausencia.
- 55 municipios cruzaron el umbral en esos 90 días, con **141 cruces**.
- De esos 55, solo **19** tienen un cambio neto real. Los otros 36 acaban
  como empezaron: cruzan la línea y vuelven. Uno la cruza ocho veces.

Y el dato que lo explica: en esta fuente, **la ausencia de una estación un
día no significa que haya cerrado**. Significa que esa fila no vino en el
fichero del ministerio. Ese ruido, hoy, decide qué páginas existen.

## Decisión

**El umbral es asimétrico.** Un municipio necesita
`MINIMO_ESTACIONES_MUNICIPIO` estaciones para ganar página, y conserva la que
ya tiene mientras le quede al menos una.

En concreto, un municipio tiene página si:

- tiene hoy 3 estaciones visibles o más; **o**
- alcanzó ese mínimo algún día dentro de la ventana histórica de 90 días
  **y** hoy tiene al menos una estación visible.

Un municipio con cero estaciones visibles no tiene página, y su URL devuelve
404 real. Eso no cambia: ADR-0012 sigue vigente tal cual.

No hace falta guardar nada nuevo. La ventana de 90 días de ADR-0024 ya
almacena el territorio de cada estación por día, así que «alcanzó el mínimo
en la ventana» se deriva de artefactos que ya existen.

El sitemap y los enlaces internos de las páginas de zona (RF-92) siguen
exactamente el mismo criterio: lo que tiene página se enlaza y se lista, sin
excepciones.

## Motivos

El problema no es que desaparezcan páginas, es que **parpadean**. Ciento
cuarenta y un cruces para diecinueve cambios reales significa que la mayoría
de las URLs afectadas devuelven 200, luego 404, luego 200 otra vez. Un 404
honesto lo digiere cualquier buscador; una URL que va y viene repetidamente
es una señal de sitio poco fiable.

Y la causa de ese parpadeo es en buena parte ruido de la fuente, no realidad.
Dejar que una fila ausente un día tumbe una página indexada es entregar una
decisión del producto a un fallo ajeno.

La asimetría corta los 36 casos de oscilación y deja pasar los 19 cambios
reales, que ocurren una sola vez y con 404 limpio.

## Consecuencias

Buenas: las URLs indexadas dejan de ir y venir. La maquinaria histórica de
ADR-0024 sirve para algo que no estaba previsto cuando se construyó.

Malas, y hay que atenderlas:

- **Un municipio que baje a dos estaciones de forma permanente conserva su
  página.** Es contenido más flaco de lo que ADR-0012 quería evitar, aunque
  lejos de una página vacía. Es el precio de no parpadear.
- **La regla depende de la ventana histórica.** Si el artefacto no está
  disponible en un despliegue, el criterio de retención no se puede evaluar.
  En ese caso se aplica el umbral simple de hoy, que es el comportamiento
  anterior: nunca se borran páginas en masa por no poder leer la ventana.
- La antigüedad efectiva de la retención es la de la ventana: un municipio
  que estuvo 91 días sin llegar al mínimo pierde la página, y es correcto.

## Alternativas descartadas

- **Dejarlo como está.** Produce 141 cruces por 19 cambios reales.
- **Bajar `MINIMO_ESTACIONES_MUNICIPIO` a 1 o 2.** Daría página a 601
  municipios más que hoy tienen dos estaciones, la mayoría de los cuales
  nunca han llegado al mínimo. Es exactamente el contenido delgado que
  ADR-0012 evita, y no resuelve el parpadeo: solo lo mueve al umbral nuevo.
- **Guardar una lista explícita de qué municipios tuvieron página.** Es
  estado adicional que mantener cuando el dato ya es derivable de la ventana
  histórica.
- **Servir una página con el aviso de que ya no hay estaciones.** Contenido
  sin valor en una URL indexada. Un 404 real es más honesto y es lo que
  ADR-0012 decidió.

## Cuándo

Se implementa una vez cerrado el hito de Evolución e histórico, del que
depende. Diecinueve cambios netos en noventa días no justifican abrir un
frente con ese hito a medias.
