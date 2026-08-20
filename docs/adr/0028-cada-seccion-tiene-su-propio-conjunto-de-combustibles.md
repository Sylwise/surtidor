# ADR-0028 · Cada sección tiene su propio conjunto de combustibles

**Fecha:** 2026-08-21 · **Estado:** aceptado

## Contexto

Al implementar V2-12 apareció que el sitio tiene cuatro respuestas distintas
a «cuántos combustibles hay»: seis en Precios, cinco en las editoriales,
cuatro en Evolución y dos en las imágenes de compartición.

Parecía incoherencia. Al mirarlo, tres de las cuatro son correctas y
responden a razones distintas, pero ninguna estaba escrita, así que cada
pantalla lo resolvió por su cuenta y el sitio se comporta como si fuera un
descuido.

## Decisión

Cada sección declara su conjunto, y el motivo:

**Precios: los seis.** Es la aplicación, y su trabajo es decir a cuánto está
cada combustible donde estás.

**Editoriales y comparaciones entre combustibles: cinco.** Entra el gasóleo B,
queda fuera el GLP. Un coche de GLP consume entre un 20 y un 30 % más volumen,
así que su precio por litro no es comparable con el resto y saldría siempre
como el más barato sin serlo.

Esto no afecta a la comparación entre estaciones que venden el mismo
combustible. En Precios, mapa, lista y ficha calculan para los seis combustibles
la escala territorial de ADR-0025 usando únicamente las estaciones que venden
el combustible activo. Dos precios de GLP sí son comparables entre sí: el
vehículo y el consumo de referencia son los mismos y la diferencia de precio es
real. El panel del selector es la excepción visual: como coloca los seis
precios uno debajo de otro, no aplica bandas y conserva la nota que impide leer
el GLP como comparable con los demás combustibles.

**Evolución: cuatro, por ahora.** No es una decisión de producto, es una
restricción de datos: los artefactos históricos guardan cuatro claves, así
que no existe histórico de gasóleo B ni de GLP. Entrarán cuando la ventana
de 90 días los contenga, y no antes. Hasta entonces esto se revisa, no se
da por definitivo.

**Imágenes de compartición: dos.** Gasolina 95 y diésel. La tarjeta destaca
el más barato, y esa regla se acotó a los dos combustibles comparables de
uso mayoritario.

## Regla que atraviesa todo

**Lo que no está disponible se dice; nunca se sustituye en silencio.**

Hoy, un enlace desde Precios con GLP elegido lleva a Evolución, que no admite
GLP y muestra gasolina 95 sin avisar. El usuario cree que está viendo GLP.
Eso no puede ocurrir: o el destino explica que ese combustible no está
disponible ahí y por qué, o el enlace no se ofrece.

## Consecuencias

Buenas: la diferencia entre secciones deja de parecer un descuido y pasa a
ser una decisión con motivo escrito. Cada pantalla sabe a qué atenerse sin
inventárselo.

Malas, y aceptadas:

- Un usuario que elige GLP en Precios no puede ver su evolución. Se le dice
  por qué.
- Hay que revisar este ADR cuando el histórico contenga los combustibles
  nuevos.

## Alternativas descartadas

- **Los seis en todas las comparaciones.** Imposible en Evolución: no hay
  datos. Y en las comparaciones entre combustibles y las editoriales el GLP
  falsearía los titulares.
- **Los cuatro de siempre en todas partes.** Renuncia a lo que V2-12 venía a
  hacer.
- **Dejarlo sin declarar, como está.** Es lo que produjo cuatro
  comportamientos distintos y una caída silenciosa a gasolina 95.
