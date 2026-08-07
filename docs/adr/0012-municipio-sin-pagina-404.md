# ADR-0012 · El municipio sin página propia devuelve 404, no redirección

**Fecha:** 2026-08-07 · **Estado:** aceptado · **Supera a:** [ADR-0010](0010-redireccion-municipio-con-pages-function.md)

## Contexto

RF-60 exige que un municipio por debajo de `MINIMO_ESTACIONES_MUNICIPIO` (3)
no tenga página propia. Lo que faltaba decidir era qué le pasa a quien llega
a esa URL. Con los datos de hoy: 3.267 municipios con alguna estación,
1.089 con página propia, **2.178 sin ella** — y de esos 2.178, 1.578 tienen
1 estación y 600 tienen 2 (ninguno tiene 0: el catálogo de
`datos-build/municipios.json` se construye agrupando estaciones reales, así
que un municipio sin ninguna gasolinera nunca entra en él — ver
`scripts/lib/municipios.ts`).

Esta es la tercera vez que se decide esto. Las tres veces se verificó
ejecutando y mirando la respuesta real, no leyendo documentación — es el
método que importa tanto como la decisión final, porque las dos primeras
veces la documentación (o la suposición razonable) no bastaba.

### Intento 1: comodín en `_redirects`

`/{provincia}/*  /p-{id}/  301`. Parecía razonable: 52 líneas, muy por
debajo de cualquier límite. Verificado con `wrangler pages dev` contra un
build real: **roto**. Cloudflare Pages aplica los redirects antes de
comprobar si existe un asset estático en esa misma ruta — los redirects
ganan siempre, no al revés — así que el comodín se comía también las
1.089 páginas de municipio reales (`/araba-alava/vitoria-gasteiz/`, con 39
estaciones, devolvía un 301 a `/p-01/` en vez de servir el HTML). Detalle
completo en ADR-0010.

### Intento 2: Cloudflare Pages Function

`functions/[provincia]/[municipio].js`: por petición, intenta servir el
asset estático de verdad con `env.ASSETS.fetch()` y solo redirige si no
existe. Resolvía el problema del intento 1 — verificado con 10 URLs al
azar, cinco páginas reales y cinco redirecciones, todas correctas — y así
quedó documentado en ADR-0010, con una frase optimista sin comprobar: "el
plan gratuito de Pages Functions permite muchas más peticiones al día de
las que este sitio va a recibir".

Esa frase asumía que la función solo se invocaba para redirigir. **Falso**,
verificado después con una cabecera de depuración en `onRequest` y
`curl -D -` contra `wrangler pages dev`: la función se ejecuta en **todas**
las peticiones que casan su patrón de ruta, también en las páginas de
municipio reales que sí existen como asset estático — es la función, por
dentro, la que decide servir el asset o redirigir; Cloudflare no comprueba
nada antes de invocarla. El diseño quedaba invertido: protegía 2.178 URLs
que nadie enlaza (no hay página del sitio que enlace un municipio por
debajo del mínimo) a costa de gastar cuota de Workers en las 1.089 páginas
que traen todo el tráfico real. Si el sitio crece, el fallo caería sobre el
camino caliente para proteger el frío.

### Intento 3: `_redirects` con una regla exacta por municipio

Sin comodín, sin la función: una línea literal por cada uno de los 2.178
municipios sin página (`/{provincia}/{municipio}/  /p-{id}/  301`), rutas
exactas que no pueden tragarse una página real porque no hay ambigüedad de
patrón. Se generó el fichero real y se sirvió con `wrangler pages dev`:
**2.178 supera el límite de Cloudflare, que son 2.000 reglas estáticas**
(`MAX_STATIC_REDIRECT_RULES = 2000`, verificado en el código de `wrangler`,
no en su documentación). Y el fallo no es ruidoso: wrangler descarta las
últimas 178 reglas **en silencio** (`Maximum number of static rules
supported is 2000. Skipping line.`), confirmado pidiendo la regla #2000
(redirige) y la #2001 (404, como si la regla no existiera).

Quedaba la opción de recortar a 2.000: las 1.578 de una estación caben
holgadas, y habría que elegir 422 de los 600 municipios de dos estaciones
para completar el cupo. No hay ningún criterio defendible para esa
elección — es la misma clase de juicio editorial que el proyecto ya evita
en zonas y agrupaciones territoriales (ver la corrección al final de
[ADR-0005](0005-provincia-unidad-y-zonas.md)) — así que se descartó sin
más.

## Decisión

Ningún municipio por debajo del mínimo redirige. Todos devuelven el 404 de
`src/pages/404.astro`, con los tokens de marca y un enlace de vuelta al
selector de zona. No hace falta ninguna Pages Function ni ningún
`_redirects`: se borran `functions/[provincia]/[municipio].js` y el código
que solo existía para alimentarla (`datos-build/provincias-slugs.json`, el
tipo `ProvinciaSlug`).

Verificado con `wrangler pages dev` contra un build real, con las mismas
10 URLs de siempre (5 páginas reales de municipio, 5 municipios por debajo
del mínimo, provincias distintas): las cinco primeras sirven su HTML con
200, las cinco segundas dan el 404 real, no un soft-404 de SPA.

## Motivos

**Esas URLs no las enlaza nada.** Ni la tabla de zona ni el resumen de
municipio enlazan por debajo del mínimo (RF-60 lo impide desde el propio
`getStaticPaths`), así que el tráfico real a esas rutas es un enlace
externo viejo o un typo — exactamente el caso para el que existe un 404.
Redirigir a la provincia tampoco era gratis para quien llegaba: un
municipio de 1-2 estaciones está por debajo del mínimo precisamente porque
tiene poco que ofrecer, y mandar a una página provincial con cientos de
gasolineras lejanas no es más útil que decir "esto no existe" con un
camino claro de vuelta.

**Vuelve a ser 100% estático**, como decía [ADR-0001](0001-sin-backend.md)
desde el principio: sin Pages Function, no hay ninguna pieza que corra por
petición, ninguna cuota que vigilar, ningún límite de peticiones diarias.

## Consecuencias

Buenas: cero superficie nueva que mantener, cero cuota de Workers, el 404
ya estaba bien resuelto (tokens de marca, enlace de vuelta) porque hacía
falta para otra cosa. El sitio vuelve a ser exactamente lo que promete
`docs/03-arquitectura.md`: HTML y JSON estáticos servidos desde un CDN, sin
excepciones.

Malas: se pierden 2.178 redirecciones 301 que sí tenían destino razonable
(su provincia). Es una pérdida real pero pequeña — nadie las enlaza hoy — y
reversible: si algún día un enlace externo concreto demuestra tráfico real
a un municipio sin página, se puede añadir esa única regla a mano sin
revivir ni la función ni el problema de las 2.000.

## Alternativas descartadas

Las tres de "Contexto" (comodín en `_redirects`, Pages Function, reglas
exactas completas) y, dentro de la tercera, el recorte a 2.000 con un
criterio de selección — descartado por no tener ningún criterio defendible
para elegir qué 422 municipios de dos estaciones se quedan fuera.
