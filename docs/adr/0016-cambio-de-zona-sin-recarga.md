# ADR-0016 · Cambiar de zona no recarga la página

**Fecha:** 2026-08-07 · **Estado:** aceptado

## Contexto

Hoy, elegir otra zona en el selector navega con `location.href` y recarga el
documento entero. Es deliberado: hay un comentario en
`src/componentes/AppInteractiva.astro` que lo justifica, porque el `<title>`
y la `<meta description>` de la página servida llevan el nombre de la zona y
su precio mínimo, y refrescar solo el contenido dejaría esas etiquetas
describiendo otra zona.

El coste es alto. La recarga destruye la instancia de MapLibre y la vuelve a
construir: contexto WebGL nuevo, tiles otra vez, marcadores otra vez. Es la
operación más cara de la aplicación, y se paga entera por un cambio que el
mapa podría resolver desplazándose.

## Decisión

Estando en una página de zona, elegir otra zona **no recarga el documento**.
Se cargan los datos de la zona nueva, el mapa vuela hasta ella sin
reconstruirse, y la dirección cambia con `history.pushState` a la página real
de esa zona.

**Solo aplica entre páginas de zona.** Desde una página de municipio, elegir
zona sigue siendo una navegación completa: es otro tipo de página, con su
`<h1>` y su JSON-LD propios. Con esa frontera, este cambio no toca ninguna
de las dos piezas.

Se actualizan en cliente, obligatoriamente y a la vez:

- La tabla de precios servida en el HTML. Hoy no tiene ningún gancho —ni
  `id` ni `data-*`— y ningún script la referencia. Se le añade uno y se
  regenera. Que el JavaScript la refresque después no contradice ADR-0007:
  el HTML servido sigue saliendo estático y completo para los rastreadores.
- El `<title>` y la `<meta description>`.

## Motivos

El razonamiento que sostenía la recarga ya no se sostiene, y el motivo es
que **quien lee esas etiquetas nunca está en la pestaña del usuario**.
Googlebot pide `/madrid/` al servidor y recibe el HTML estático correcto. El
rastreador de WhatsApp, al pegarse el enlace, hace lo mismo y recibe la
`og:image` de Madrid. Ninguno de los dos ve el DOM del navegador. Mientras
la dirección escrita con `pushState` corresponda a una página que existe de
verdad, todo lo externo cuadra sin tocar nada.

Lo único que quedaba desactualizado dentro de la pestaña era el título, y el
título se puede cambiar.

## Consecuencias

Buenas: cambiar de zona deja de reconstruir el mapa. Nada cambia para quien
llega desde una búsqueda o abre un enlace compartido: sigue recibiendo el
mismo HTML estático de hoy.

Malas, y hay que vigilarlas:

- **El botón de atrás pasa a depender del código.** Hay que atender
  `popstate` y restaurar la zona anterior. Sin eso, atrás saca al usuario de
  la aplicación, que en móvil es un fallo grave.
- **Aparece una forma nueva de romper la regla del precio del cartel.** Con
  recarga completa era imposible enseñar datos que no correspondieran a la
  página. A partir de aquí es posible si una pieza se actualiza y otra no.
  Por eso la tabla y el título se actualizan en la misma operación, o no se
  actualiza ninguno.
- Más JavaScript en el cliente. Hay que medir contra RNF-11 después del
  cambio, no estimarlo.

## Alcance de ADR-0015

ADR-0015 descartó que **la vista del mapa** determinara la zona cargada, y
el motivo era un bucle: la vista decidía lo cargado y lo cargado reencuadraba
la vista. Aquí no existe ese bucle, porque el disparador es una elección
explícita del usuario y ocurre una sola vez. Recalcular la escala de color al
cambiar de zona es además lo que ya sucede hoy con la recarga, no un efecto
que evitar.

## Alternativas descartadas

- **Dejarlo como está.** Es lo que había, y funciona. Se cambia porque el
  coste de reconstruir el mapa es desproporcionado para lo que se consigue.
- **Cambiar la dirección sin actualizar la tabla.** Rompe la regla dura del
  precio del cartel: el usuario vería el mapa de una zona y los precios de
  otra.
- **Quitar la tabla del HTML servido y pintarla siempre con JavaScript.**
  Contradice ADR-0007, que es el activo de captación del proyecto.
