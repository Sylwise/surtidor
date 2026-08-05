# ADR-0002 · MapLibre GL JS con tiles de OpenFreeMap

**Fecha:** 2026-08-05 · **Estado:** aceptado

## Contexto

Hace falta un mapa interactivo con estilo propio y sin coste. Google Maps y
Mapbox cobran por carga de mapa a partir de un umbral y exigen clave de API con
tarjeta asociada, lo que rompe RNF-01 y además crea un riesgo de factura
sorpresa si algo se comparte y se difunde.

## Decisión

**MapLibre GL JS** como biblioteca y **OpenFreeMap** como servidor de tiles, con
el estilo `positron`.

## Motivos

MapLibre es la bifurcación libre de Mapbox GL JS anterior al cambio de licencia.
Tiles vectoriales, estilo definido en JSON y por tanto modificable, rotación e
inclinación incluidas.

OpenFreeMap no tiene registro, ni clave, ni límite de peticiones publicado. Se
sostiene con donaciones. La atribución es obligatoria y MapLibre la añade sola.

`positron` es el estilo gris casi sin saturación, que es justo lo que pide la
dirección de diseño: el mapa calla para que hablen los precios.

## Consecuencias

Buenas: sin clave, sin tarjeta, sin techo de peticiones. El estilo es un JSON
que podemos forkear y ajustar.

Malas: dependemos de un servicio comunitario sin acuerdo de nivel de servicio.
Si se cae o desaparece, el mapa deja de verse.

Mitigación, y es la que de verdad importa: **el mapa es un extra**. La lista, el
tótem y los filtros funcionan al completo sin él. Si OpenFreeMap desaparece, la
aplicación sigue siendo útil y se cambia de proveedor de tiles con una línea.

**MapLibre entra como dependencia npm y va en el bundle.** Nunca por CDN: un
`<script src>` bloqueante que se quede pendiente detiene el parser de HTML y deja
la página congelada sin ningún error en consola. Ya ocurrió en el prototipo.

## Alternativas descartadas

- **Google Maps / Mapbox.** Coste, clave, tarjeta.
- **Leaflet con tiles raster de OSM.** Más simple, pero los tiles del servidor
  público de OSM no admiten uso en producción y no se puede aplicar estilo propio.
- **Protomaps auto-alojado en R2.** Control total, pero hay que generar y
  mantener los ficheros. Es la vía de escape si OpenFreeMap falla, no la de salida.
