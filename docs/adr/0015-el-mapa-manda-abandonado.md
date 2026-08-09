# ADR-0015 · El mapa no manda: se abandona la carga dinámica por vista

**Fecha:** 2026-08-07 · **Estado:** aceptado · **Supera:** ADR-0014

## Contexto

ADR-0014 decidió que la vista del mapa determinara la zona mostrada: cargar
las provincias que ocupasen más de un umbral de la pantalla, soltar las que
salieran, y que lista, escala de color, selector y dirección siguieran a lo
cargado.

Se implementó entero en la rama `hito-h12-el-mapa-manda`, commit `d48590d`, y
se probó en un navegador real. El resultado es inservible. Este ADR registra
por qué, porque el motivo no es de implementación: son dos decisiones
anteriores que no pueden convivir con aquella, y no se vieron al redactarla.

## Decisión

**V2-16 y V2-17 quedan descartados**, no aplazados. No habrá carga de
provincias en función de la vista, ni estado personalizado, ni `?zonas=`.

**V2-18 se mantiene y se reafirma aquí**, para que no dependa de un ADR
superado: por debajo de un nivel de zoom, las estaciones se sustituyen por una
pastilla por provincia con su nombre y el precio **medio** del combustible
elegido, situada en el centroide de sus estaciones. El número escrito es la
media y no el mínimo, porque el mínimo de una provincia es una estación
concreta y una pastilla que dijera "Álava 1,399" se leería como "en Álava se
paga eso", que es falso. El centroide se calcula sobre las estaciones y no
sobre la geometría de la provincia: el centro geométrico de Huesca cae en el
Pirineo, donde no reposta nadie. Canarias nunca comparte escala de color con
provincias peninsulares.

El caso que ADR-0005 dejó abierto —repostar cruzando frontera provincial,
de Vitoria-Gasteiz a Miranda de Ebro— vuelve a quedar sin cubrir. Se acepta.

**Alcance de este descarte.** Lo que se descarta es que la vista del mapa
determine qué se carga. No se descarta la navegación en cliente en general:
un cambio de zona disparado por una elección explícita del usuario no tiene
bucle, porque ocurre una sola vez y el mapa no decide nada. Ver ADR-0016.

## Motivos

**1. Una escala relativa no soporta un conjunto que cambia solo.** Por
ADR-0003 el color sale del percentil dentro del conjunto mostrado: el color no
es propiedad de la estación. Eso es estable mientras el conjunto solo cambie
cuando el usuario elige otra zona. Con la vista decidiendo, el conjunto cambia
a cada movimiento del dedo, así que **el mapa entero se recolorea
continuamente**: entra Burgos y todas las estaciones de Álava cambian de banda
sin que su precio se haya movido. Sumado a la reconstrucción de marcadores con
detección de colisiones de ADR-0006, el resultado en pantalla es parpadeo.
ADR-0003 y ADR-0014 son incompatibles tal como estaban escritos.

**2. El rectángulo envolvente no sirve para la geografía española.** El
Condado de Treviño es un exclave de Burgos dentro de Álava, así que el
rectángulo de Burgos se estira hasta el centro de Álava y **mirar Álava carga
Burgos siempre**, con cualquier umbral. No es un caso aislado: los rectángulos
de provincias irregulares se solapan por todo el país, y España tiene además
otros exclaves. Se verificó cargando cuatro provincias (`01,09,26,48`) al
abrir Álava, sin que el usuario tocara nada.

**3. La función se realimentaba a sí misma.** El `fitBounds` de RF-19
encuadraba sobre el conjunto cargado, y el conjunto cargado dependía de la
vista: cada carga movía la cámara, que provocaba la siguiente carga. Con
provincias pequeñas y rodeadas el mapa se alejaba solo hasta salirse del rango
útil. Se corrigió introduciendo un parámetro de origen obligatorio en el
estado (`eleccion` | `movimiento`), pero el bucle es un síntoma de que la
función se alimenta de su propio efecto, no un descuido puntual.

**4. La franja muerta a zoom medio.** La guarda provisional que impedía cargar
por debajo de cierto zoom —puesta para no descargar los ~8 MB de las 52
provincias mientras V2-18 no existiera— dejaba un rango en el que mover el
mapa no hacía nada y no lo decía. Este punto sí era corregible.

**5. Y la regla que decide.** `docs/06-roadmap.md`: *una función que estropea
la interfaz no entra*. Esta empeoraba la pantalla principal, que ve todo el
mundo, para resolver el caso de quien vive pegado a una frontera provincial.
La cuenta no sale.

## Consecuencias

Buenas: la pantalla principal vuelve a ser estable y predecible. Desaparece la
única función del proyecto que se realimentaba de su propio efecto.

Malas: sigue sin resolverse repostar cruzando frontera provincial. La zona por
comunidad autónoma cubre el caso normal —quien vive en Vitoria-Gasteiz tiene
Euskadi en un toque— pero no el de Miranda de Ebro.

Se rescatan de la rama abandonada dos cosas, en commits propios sobre `main`:
el cálculo del centroide por provincia, que V2-18 necesita tal cual, y la
corrección del dato sucio de Pontevedra descrito abajo.

## Hallazgo que sobrevive al abandono

Al calcular envolventes con datos reales apareció una estación de Pontevedra
(id MITECO 16268, "GUAY", Tui) con **latitud y longitud intercambiadas en
origen**, que la sitúa en el océano Índico. En la rama se filtró en el cálculo
geométrico, que es la capa equivocada: la estación seguía entrando en los
datos con las coordenadas mal. Corresponde a `scripts/lib/normalizar.ts`, que
ya descarta y cuenta las estaciones sin coordenadas, y queda documentado en
`docs/04-fuente-datos.md`.

## Si alguien lo reintenta

Las dos correcciones que harían viable la idea, por si vuelve a proponerse:

- **Anclar la escala de color a una provincia dominante**, no al conjunto
  cargado, para que añadir vecinas no recoloree lo que ya estaba. Eso exige un
  ADR que matice ADR-0003.
- **Distancia al centroide de las estaciones en lugar de rectángulos
  envolventes.** Es estable, no sufre con los exclaves y sale de datos que ya
  existen.

Ninguna de las dos se aborda ahora: el coste son dos rondas de diseño más y
una reescritura del hito, y hay funciones más baratas y mejores esperando.

## Precisión de V2-18 · 2026-08-09

La vista nacional entra por debajo de zoom 6,5 y sale al alcanzar zoom 7. La
histéresis conserva el modo anterior entre ambos valores; son constantes
ajustables después de probarlas en navegador real, no una razón para derivar la
zona de la cámara.

Pulsar una pastilla provincial sí selecciona esa provincia como zona, actualiza
la URL por RF-88, carga su único JSON y encuadra sus estaciones. Es una elección
explícita de la persona, igual que pulsar una fila del selector territorial, y
por tanto no recupera la carga automática por vista descartada en este ADR.
Alejar, acercar o desplazar sin pulsar no modifica nunca la zona cargada.

El centroide de V2-18 se calcula sobre todas las estaciones **públicas** con
coordenadas válidas, no sobre las restringidas ni solo sobre quienes vendan el
combustible activo. Sustituye para V2-18 el «tal cual» mencionado en las
consecuencias de este ADR: el cálculo matemático es el mismo, pero se precisa el
conjunto porque la vista representa las estaciones utilizables por el público.

Los agregados nacionales se sirven en un resumen de build y no mediante la
carga de 52 provincias. Ver ADR-0022.
