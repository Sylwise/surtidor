# ADR-0009 · Descuentos por marca: descartados

**Fecha:** 2026-08-05 · **Estado:** descartado

Este ADR se escribió proponiendo la función y se anula el mismo día, antes de
implementar nada. Se conserva porque la idea es tentadora y va a volver a
proponerse. Aquí está el motivo por el que no.

## La propuesta

El precio que publica el ministerio es el de mostrador. Con Waylet de Repsol, la
tarjeta de Cepsa, Carrefour Club, Eroski o BP hay descuentos de entre tres y diez
céntimos por litro. La idea era que el usuario los declarase en `localStorage`,
calcular un precio efectivo, y ordenar la lista por él.

El argumento era que sin eso el orden de la lista es incorrecto para quien tiene
esos programas.

## Por qué se descarta

**El argumento no resiste los números reales.** Datos de Álava, gasolina 95:

| | Precio | Con 5 c/L de descuento |
|---|---|---|
| GM OIL (independiente) | 1,549 | sin programa |
| GUGAS (independiente) | 1,553 | sin programa |
| Repsol Portal de Legutiano | 1,809 | 1,759 |
| Shell N-I Betoño | 1,879 | 1,829 |

La diferencia entre la más barata y las de marca ronda los **30 céntimos por
litro**. El descuento son cinco.

Con 20 litros: el descuento ahorra **1,00 €**; elegir bien la gasolinera ahorra
**5,20 €**.

La razón de fondo es estructural y no va a cambiar: **los programas de
fidelización son de las gasolineras caras.** Las que encabezan la lista son
low-cost e independientes, y no tienen programa porque su modelo de negocio es
justamente no tenerlo. Un descuento de marca no mueve la cabeza de la lista;
mueve el medio, que es la zona que nadie mira.

El tope mensual lo remata: Waylet aplica sobre los primeros treinta o cincuenta
litros del mes, así que ni siquiera ese euro es fiable, y la aplicación no puede
saber cuánto lleva repostado el usuario sin cuentas.

## Lo que nos ahorramos

No es solo una función menos. Es todo esto:

- **Un catálogo de marcas canónicas** (`marcas.ts`) para normalizar los rótulos
  sucios del ministerio: `REPSOL`, `E.S. REPSOL`, `ESTACION DE SERVICIO REPSOL`.
  Mantenimiento manual eterno, y si falla el usuario no se entera de que su
  descuento no se está aplicando.
- **Una pantalla de ajustes** más, con su fricción de configuración inicial.
- **La regla del precio tachado** en lista, ficha y mapa, para que el número
  cuadre con el cartel de la calle.
- **Casos que no se pueden modelar**: topes mensuales, cashback diferido —con
  Waylet no pagas menos en el surtidor, recuperas saldo después—, descuentos
  condicionados al día o al medio de pago.
- **Valores sugeridos por programa**, que habrían obligado a mantener un catálogo
  de promociones vigentes: exactamente lo que este mismo ADR descartaba en su
  versión original.

## Si vuelve a proponerse

El listón para reabrirlo: **demostrar con datos reales de una provincia que los
descuentos cambian quién es la más barata**, no que cambian el orden de las
posiciones sexta a duodécima.

Mientras la brecha entre low-cost y marca siga en treinta céntimos, no lo hará.
