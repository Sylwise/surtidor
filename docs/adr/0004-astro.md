# ADR-0004 · Astro como framework

**Fecha:** 2026-08-05 · **Estado:** aceptado

## Contexto

Hace falta generar un sitio estático con una parte interactiva concreta: mapa,
lista y filtros.

## Decisión

**Astro** con TypeScript. CSS plano con custom properties, sin framework de
utilidades ni de componentes.

## Motivos

Astro genera HTML estático de verdad y manda JavaScript solo donde se declara
una isla. Eso encaja con RNF-11 (menos de 150 KB de JS inicial) y con que el
contenido útil aparezca antes que el mapa.

El punto que decide: **una página estática por provincia** con
`src/pages/[provincia]/index.astro`. Sin presupuesto de captación, que alguien
que busca gasolineras baratas en su ciudad encuentre esto en Google es la única
vía de crecimiento que existe. Una aplicación de una sola página no da eso sin
pelearse con el renderizado en servidor.

El autor ya ha usado Astro antes en otro sitio, así que no hay curva.

## Consecuencias

Buenas: HTML estático, JavaScript mínimo, buen SEO por provincia, despliegue
trivial en Cloudflare Pages.

Malas: la interactividad hay que escribirla en TypeScript sobre el DOM, sin la
comodidad de un framework reactivo. Se asume porque el estado de esta aplicación
es pequeño: provincia, combustible, estación seleccionada, filtro, depósito.

Sin librería de estado. `src/logica/estado.ts` es un objeto plano con
suscriptores. Si eso se queda corto, será señal de que el alcance ha crecido y
toca escribir un ADR nuevo, no de que hiciera falta Redux desde el principio.

## Alternativas descartadas

- **React o Next.** Peso y complejidad que este alcance no justifica. El autor
  está aprendiendo React, pero este proyecto es de entrega, no de aprendizaje.
- **HTML y JavaScript a pelo.** Viable, pero sin plantillas hay que repetir 52
  páginas de provincia a mano.
- **SvelteKit.** Buen encaje técnico, pero añade una tecnología nueva sin ganancia
  clara frente a Astro, que ya se conoce.
