# ADR-0007 · Páginas por municipio como activo de captación

**Fecha:** 2026-08-05 · **Estado:** aceptado · **Amplía:** ADR-0004

## Contexto

El proyecto no tiene presupuesto de publicidad y no va a tenerlo. La única vía de
crecimiento es la búsqueda orgánica.

El ADR-0004 justificaba Astro en parte por poder generar una página estática por
provincia. Al mirar cómo busca la gente de verdad, esa granularidad es la
equivocada.

**Las consultas cabecera son inalcanzables.** "Gasolina barata" o "gasolineras
baratas" a nivel nacional están copadas por Repsol, medios generalistas con
equipos de SEO dedicados, y aplicaciones con años de antigüedad de dominio. Un
dominio nuevo no compite ahí, y perseguirlo es tirar el tiempo.

El nombre de marca tampoco sirve de puerta de entrada: nadie busca "surtidor"
queriendo ver precios.

## Decisión

El activo es la **cola larga municipal**: "gasolineras baratas en
Vitoria-Gasteiz", "gasolina 95 barata Llodio", "gasoil barato Amurrio".

Se genera una página estática por municipio con volumen de búsqueda plausible.
No los ~8.000 de España: los 500-800 con población suficiente. Se mantienen
además las de provincia y comunidad, que sirven de nodos de enlazado.

Cada página lleva:

- **Precios en el HTML servido**, no inyectados por JavaScript.
- **Título y descripción generados con el dato real y fresco**, incluyendo el
  precio mínimo y la hora de actualización.
- **JSON-LD** con `ItemList` de `GasStation` y su `Offer`.
- **`sitemap.xml` con `lastmod`**, regenerado en cada despliegue.
- **Enlazado interno** hacia municipios vecinos y hacia la provincia.

## Motivos

Poca competencia por consulta, muchísimas consultas, e intención de compra
inequívoca: quien busca eso va a repostar hoy.

Es además lo único que este proyecto puede hacer mejor que una aplicación
nativa. Una app no tiene páginas indexables; nosotros generamos ochocientas sin
coste marginal, porque los datos ya están ahí.

El fragmento con precio y hora en el resultado de búsqueda se clica bastante más
que uno genérico, y esa tasa de clic realimenta la posición.

Sobre el JSON-LD, sin ilusiones: `GasStation` **no es un tipo que produzca
resultados enriquecidos en Google**, así que no habrá cambio visual en los
resultados. Se pone porque hace los datos legibles por asistentes y buscadores
con IA, que es una porción creciente del tráfico. Regla de Google que aquí es
fácil de cumplir y grave de incumplir: **todo lo declarado en el JSON-LD debe
coincidir con lo visible en la página**.

## Consecuencias

Buenas: crecimiento sin presupuesto, con contenido que se actualiza solo cada dos
horas. Y quien llega desde una búsqueda **aterriza ya en su municipio**, lo que
elimina el problema de detectar dónde está (ADR-0008).

Malas: 800 páginas más en cada despliegue. Hay que vigilar el límite de 20.000
ficheros de Cloudflare Pages —queda muy lejos— y el tiempo de build. Y hay riesgo
de contenido delgado si una página municipal tiene dos estaciones: por debajo de
un mínimo, no se genera página propia y se redirige a la comarcal.

**Expectativa realista: de tres a seis meses** para ver resultados. El SEO de un
dominio nuevo no es rápido y no hay atajo. Darse de alta en Search Console el día
uno, o se avanza a ciegas.

## Alternativas descartadas

- **Perseguir las consultas cabecera.** Inalcanzables con este presupuesto.
- **Solo páginas de provincia.** Es la granularidad a la que la gente no busca.
- **Blog de contenidos.** Exige escribir de forma sostenida. Las páginas
  editoriales automáticas de la v2 dan algo parecido sin trabajo recurrente.
