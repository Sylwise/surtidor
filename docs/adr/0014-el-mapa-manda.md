# ADR-0014 · El mapa manda: la vista decide qué zona se muestra

**Fecha:** 2026-08-07 · **Estado:** aceptado · **Amplía:** ADR-0003, ADR-0005

## Contexto

La corrección de ADR-0005 dejó un caso sin cubrir: repostar cruzando frontera
provincial, de Vitoria-Gasteiz a Miranda de Ebro. Lo remitió a la v2 como
"cargar la provincia vecina al desplazar el mapa", y `docs/06-roadmap.md`
añadía que haría falta una tabla de adyacencia entre las 52 provincias,
escrita a mano.

Al diseñarlo se ha visto que esa formulación es la equivocada. El problema no
es añadir vecinas a una zona que se mantiene: es que la zona mostrada debería
ser consecuencia de lo que hay en pantalla. Quien arrastra el mapa hasta
Madrid no quiere Álava con Madrid añadido; quiere Madrid.

## Decisión

**1. Lo cargado lo decide el porcentaje de pantalla.** En el build se calcula
el rectángulo envolvente de cada provincia a partir de las coordenadas de sus
estaciones. Se cargan las provincias cuyo rectángulo ocupa más de un umbral de
la vista actual. El umbral es una constante única y declarada; valor de
partida 15 %, a ajustar probando en un móvil real, no por cálculo.

Con esta regla desaparece la pregunta de cuándo sumar y cuándo sustituir: una
provincia entra al ocupar pantalla suficiente y sale al dejar de ocuparla.

**2. Todo sigue a lo cargado.** Lista, escala de color (ADR-0003), selector y
dirección se recalculan sobre el conjunto cargado, no sobre una zona elegida
a mano. La escala de color se recalcula sobre todas las estaciones cargadas,
porque son exactamente aquellas entre las que el usuario puede elegir, que es
el criterio de ADR-0003.

**3. Selector y dirección siguen a la provincia que más pantalla ocupa.**

- Una sola provincia cargada: la dirección es su página real, `/provincia/`,
  y el selector la muestra.
- Varias: el selector muestra una entrada `Personalizado`, que **no figura en
  la lista desplegable** —no gasta hueco del presupuesto de interfaz— y la
  dirección pasa a `/?zonas=NN,NN` con los códigos de provincia del
  ministerio. Abrir esa dirección reconstruye el conjunto.

Lo que se guarda en `localStorage` para la siguiente visita (ADR-0008) es
siempre una provincia, la dominante. Nunca el estado personalizado.

**3 bis. El encuadre automático solo lo dispara una elección explícita.** El
`fitBounds` de RF-19 se ejecuta al elegir zona en el selector, en la carga
inicial y al llegar con `?zonas=`. Un cambio del conjunto cargado provocado
por mover o alejar el mapa **no toca la cámara jamás**.

Encuadrar sobre el conjunto cargado cierra un bucle: la vista decide qué se
carga, y si lo cargado reencuadra la vista, cada carga provoca la siguiente.
Con provincias pequeñas y rodeadas —Álava es el caso peor— el mapa se aleja
solo hasta que la guarda de zoom lo apaga todo en silencio. Verificado en la
rama del H12 antes de corregirlo.

**4. En las páginas de municipio no actúa.** Su identidad es estrecha a
propósito (ADR-0007) y son el activo de captación. El mapa manda solo en las
páginas de zona y en la raíz.

**5. Vista nacional por zoom.** Por debajo de un nivel de zoom no se cargan
estaciones: se muestra una pastilla por provincia con su nombre y el precio
**medio** del combustible elegido, situada en el centroide de sus estaciones.
Cargar las 52 provincias son unos 8 MB y rompe RNF-12 y RNF-13; el resumen son
52 números.

El corte lo manda el nivel de zoom, no el número de provincias visibles: con
un contador, desplazarse de lado sin tocar el zoom hace parpadear la vista
entre estaciones y pastillas. Los dos límites no coinciden —se pasa a
pastillas por debajo de un nivel y se vuelve a estaciones por encima de otro
ligeramente mayor— para que no baile en la frontera.

El número escrito es la media, no el mínimo. El mínimo de una provincia es una
estación concreta, casi siempre una low-cost aislada, y una pastilla que dice
"Álava 1,399" se lee como "en Álava se paga eso", que es falso. La media
describe la provincia. Es además el mismo número que necesita la página
editorial de provincias más baratas (V2-10): un solo cálculo para los dos
sitios.

El centroide se calcula sobre las estaciones, no sobre la geometría de la
provincia: el centro geométrico de Huesca cae en el Pirineo, donde no reposta
nadie.

**6. Canarias nunca comparte escala de color con provincias peninsulares.**
ADR-0003 y ADR-0005 ya lo advertían en abstracto; con la vista nacional deja
de ser hipotético y pasa a ser un caso que se dispara solo.

## Motivos

Una sola regla —el porcentaje de pantalla— cubre a la vez el caso de asomarse
a la provincia de al lado y el de irse a otra punta de España. La formulación
anterior necesitaba además un tope de provincias acumuladas y una regla de
expulsión; con esta, las provincias se sueltan solas al salir de la vista.

Los rectángulos envolventes salen de datos que ya existen y se recalculan en
cada build. Una tabla de adyacencia escrita a mano sería una lista que
mantener, y además no responde a la pregunta real: lo que importa no es que
dos provincias sean limítrofes, es que estén en pantalla. Con el zoom alejado
la adyacencia no dice nada.

## Consecuencias

Buenas: desaparece el problema de acumulación de memoria. La escala de color
gana sentido, porque el conjunto comparado es siempre el que se ve.

Malas, y aceptadas:

- **La tarjeta de compartición de `/?zonas=NN,NN` es la genérica, sin precio.**
  El HTML de la raíz es estático y un parámetro de consulta no puede
  cambiarlo. Solo las páginas de zona y de municipio llevan tarjeta con dato.
- El estado personalizado no tiene página propia y por tanto no es indexable.
  Es correcto: no se crean páginas nuevas, que era la razón por la que ADR-0005
  descartó las zonas de limítrofes.
- Las pastillas de la vista nacional se pisan entre sí en pantallas pequeñas.
  Se resuelve con la agrupación y detección de colisiones que ya existe para
  los marcadores (ADR-0006).

## Alternativas descartadas

- **Tabla de adyacencia entre las 52 provincias, escrita a mano.** Lo que
  proponía el roadmap. Es una lista que mantener, y no sirve con el zoom
  alejado. Los rectángulos envolventes calculados en el build son objetivos y
  no hay nada que mantener.
- **Cambiar de vista al superar un número de provincias visibles.** Hace
  parpadear la vista al desplazarse de lado sin tocar el zoom.
- **Escribir el precio mínimo en la pastilla.** Sugiere que ese precio es el
  de la provincia. Se descarta por la misma razón por la que el proyecto no
  inventa datos.
- **Pintar las provincias rellenas con sus contornos.** Exige geometría de
  límites administrativos, que el MITECO no da: sería un fichero nuevo de
  cientos de KB traído de otra fuente, sin medir, contra RNF-12. Y una forma
  rellena promete uniformidad de precio dentro de la provincia, que no existe.
  Queda como posible mejora futura, después de medir el peso real.
- **Cargar las 52 provincias al alejar el zoom.** Unos 8 MB, ya descartado en
  ADR-0005.
