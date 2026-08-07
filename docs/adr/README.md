# Decisiones de arquitectura (ADR)

Un ADR registra una decisión y, sobre todo, **por qué** se tomó. El valor está
en el porqué: dentro de seis meses nadie recuerda qué alternativas se
descartaron ni con qué argumento.

Los ADR aceptados son vinculantes. Si crees que uno está equivocado, escribe uno
nuevo que lo supersede y explica el cambio. No lo contradigas en silencio.

| # | Decisión | Estado |
|---|---|---|
| [0001](0001-sin-backend.md) | Sitio estático sin backend | aceptado |
| [0002](0002-maplibre-openfreemap.md) | MapLibre GL JS con tiles de OpenFreeMap | aceptado |
| [0003](0003-escala-color-relativa.md) | Escala de color relativa a la provincia | aceptado |
| [0004](0004-astro.md) | Astro como framework | aceptado |
| [0005](0005-provincia-unidad-y-zonas.md) | La provincia almacena, la zona consulta | aceptado |
| [0006](0006-marcadores-dom-con-colisiones.md) | Marcadores del DOM con agrupación y colisiones propias | aceptado |
| [0007](0007-paginas-por-municipio.md) | Páginas por municipio como activo de captación | aceptado |
| [0008](0008-zona-inicial-sin-servidor.md) | La zona inicial se resuelve sin servidor | aceptado |
| [0009](0009-descuentos-en-el-dispositivo.md) | Descuentos por marca | **descartado** |
| [0010](0010-redireccion-municipio-con-pages-function.md) | Redirección de municipio sin página con una Pages Function | **superado por 0012** |
| [0011](0011-imagen-og-generada-en-build-con-resvg.md) | Imagen `og:image` generada en el build con `resvg` y fuentes propias | aceptado |
| [0012](0012-municipio-sin-pagina-404.md) | El municipio sin página propia devuelve 404, no redirección | aceptado |
| [0013](0013-pwa-sin-conexion-descartada.md) | PWA con funcionamiento sin conexión | **descartado** |
| [0014](0014-el-mapa-manda.md) | El mapa manda: la vista decide la zona mostrada | aceptado |

## Plantilla

```markdown
# ADR-NNNN · Título

**Fecha:** AAAA-MM-DD · **Estado:** propuesto | aceptado | superado por ADR-NNNN

## Contexto
Qué problema hay y qué restricciones aplican.

## Decisión
Qué se decide, en presente y sin rodeos.

## Motivos
Por qué esta y no otra.

## Consecuencias
Lo bueno, lo malo y lo que hay que vigilar.

## Alternativas descartadas
Qué más se miró y por qué no.
```
