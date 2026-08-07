# ADR-0010 · La redirección de municipio sin página usa una Pages Function, no `_redirects`

**Fecha:** 2026-08-07 · **Estado:** aceptado · **Amplía:** ADR-0007

## Contexto

RF-60 exige que un municipio por debajo del mínimo de estaciones (3) no tenga
página propia y redirija a la de su provincia. De los ~3.267 municipios con
alguna estación, solo 1.089 llegan al mínimo: quedan 2.178 que necesitan
redirección.

La primera versión de esto era `public/_redirects` con una línea comodín por
provincia: `/{provincia}/*  /p-{id}/  301`. Parecía razonable —52 líneas, muy
por debajo de cualquier límite— y así se documentó, con una nota explícita de
que no se había podido verificar contra un despliegue real.

Verificado ahora con `wrangler pages dev` contra un build real: **falso**.
Pedir `/araba-alava/vitoria-gasteiz/` (una página real, con 39 estaciones)
devolvía un 301 a `/p-01/` en vez de servir el HTML. La documentación de
Cloudflare Pages es explícita al respecto: *"Redirects are always followed,
regardless of whether or not an asset matches the incoming request."* Los
redirects no ceden ante un asset estático con la misma ruta: ganan siempre.
El comodín se comía las 1.089 páginas reales de golpe.

La alternativa obvia —una línea literal por municipio sin página, sin
comodín— tampoco cabe: `_redirects` limita a 2.000 reglas estáticas (más 100
con comodín), y hacen falta 2.178.

## Decisión

Una Pages Function, `functions/[provincia]/[municipio].js`, con la misma
forma de ruta que las páginas de municipio (dos segmentos). Por cada
petición:

1. Intenta servir el asset estático de verdad con `env.ASSETS.fetch()`
   (no pasa por `_redirects` ni vuelve a invocar la función).
2. Si el asset existe (200), lo devuelve tal cual.
3. Si no existe (404), busca el slug de provincia en
   `datos-build/provincias-slugs.json` (generado por
   `scripts/descargar-datos.ts` en el mismo paso que todo lo demás) y
   redirige con 301 a `/p-{id}/`.

Para que el paso 2 distinga un 404 de verdad de un "no encontrado" hace falta
un `404.html` en la raíz del despliegue: sin él, Cloudflare Pages asume una
SPA y sirve `index.html` con 200 para cualquier ruta sin coincidencia, y
`env.ASSETS.fetch()` nunca ve un 404 real. `src/pages/404.astro` (nuevo,
H10) cubre esto — y de paso corrige un hueco real: el sitio no tenía página
de error propia, así que cualquier enlace roto caía en ese mismo "soft 404"
silencioso.

Verificado con `wrangler pages dev` contra el build real, con 10 URLs
elegidas al azar (5 páginas reales de provincias distintas, 5 municipios por
debajo del mínimo): las cinco primeras dan 200 con el HTML correcto, las
cinco segundas dan 301 a la provincia correcta. `public/_redirects` y
`scripts/lib/redirecciones.ts` se retiran.

## Motivos

Es la vía que la propia documentación de Cloudflare recomienda para "¿existe
este asset o no?" en un sitio estático: `env.ASSETS.fetch()` existe
exactamente para esto. No inventa nada nuevo del lado del cliente ni cambia
el modelo del proyecto: la Function corre en el borde, por petición, nunca
como proceso continuo (RNF-02 sigue intacto: no hay nada "encendido" entre
peticiones, igual que el resto de Cloudflare Pages). El plan gratuito de
Pages Functions permite muchas más peticiones al día de las que este sitio
va a recibir (RNF-01).

## Consecuencias

Buenas: la redirección funciona para los 2.178 municipios sin página, sin
tocar ningún límite de reglas, y sin arriesgar servir un 301 en vez de una
página real. El sitio gana un `404.html` de verdad, que le faltaba.

Malas: aparece una primera pieza de código que no es HTML+JSON estático puro
—una función que corre por petición—, algo que el proyecto no tenía hasta
ahora. Sigue sin backend, sin base de datos y sin nada que corra 24/7
(ADR-0001 no se toca), pero es una superficie nueva que vigilar: si
`datos-build/provincias-slugs.json` no existe o está corrupto en el momento
del despliegue, la función no puede resolver ningún redirect y esos 2.178
municipios devolverían el 404 de la provincia en vez de redirigir — un fallo
silencioso a medias, no uno ruidoso. Aceptable porque `scripts/descargar-datos.ts`
escribe ese fichero en el mismo paso atómico que todo lo demás (RF-05): si
falla la descarga, no se escribe nada, ni ese fichero ni el resto.

## Alternativas descartadas

- **Comodín por provincia en `_redirects`.** Se probó primero. Se comía las
  páginas reales: ver el contexto de arriba.
- **Una línea literal por municipio en `_redirects`.** No cabe: 2.178 reglas
  contra un límite de 2.000 estáticas.
- **Bajar el mínimo de RF-60 para que quepan menos redirecciones.** Cambiaría
  un requisito para acomodar un límite de infraestructura, al revés de cómo
  deben tomarse estas decisiones. Descartado sin más.
- **No redirigir, servir 404 sin más para los municipios pequeños.**
  Incumple RF-60 literalmente. Además esas URLs no las enlaza ninguna página
  del sitio (ni la tabla de zona ni el resumen del municipio enlazan por
  debajo del mínimo), así que el tráfico real a esas rutas es bajo, pero un
  enlace externo o un typo con esa forma exacta merece acabar en la
  provincia, no en un callejón sin salida.
