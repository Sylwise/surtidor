# ADR-0001 · Sitio estático sin backend

**Fecha:** 2026-08-05 · **Estado:** aceptado

## Contexto

El requisito de partida es coste 0 € al mes (RNF-01). La experiencia previa con
otro proyecto propio en Railway mostró que un backend en la JVM más una base de
datos, encendidos 24/7 y sin un solo usuario, se comen el crédito incluido del
plan igualmente.

Conviene notar una diferencia con esos proyectos: esta aplicación **no tiene
usuarios que escriban nada**. Los datos son públicos, idénticos para todo el
mundo y de solo lectura. No hay cuentas, ni sesiones, ni escrituras.

## Decisión

No hay backend. Un proceso programado descarga y normaliza los datos, y publica
ficheros JSON estáticos junto al sitio. El navegador solo lee ficheros de un CDN.

El trabajo pesado se hace en **GitHub Actions**, no en un Cloudflare Worker.

## Motivos

El plan gratuito de Workers da **10 ms de CPU por invocación**. Parsear y
normalizar las 11.500 estaciones de España supera eso con holgura: el tiempo de
espera de red no cuenta, pero `JSON.parse` y el recorrido de los datos sí.
Trocear el trabajo chocaría además con el límite de 50 subpeticiones por
invocación del plan gratuito.

GitHub Actions no tiene ese problema, y en repositorios públicos los minutos son
ilimitados. El trabajo pesado va donde la CPU es gratis.

## Consecuencias

Buenas: coste real de 0 €. Sin arranques en frío. Latencia de CDN. Nada que
mantener encendido, parchear ni vigilar. Un fallo de la fuente no tumba el sitio.

Malas: los datos tienen hasta dos horas de antigüedad, límite aceptado en RF-43 y
señalado en la interfaz. Nada de personalización por servidor. Cualquier función
futura que necesite escrituras (alertas, cuentas) obligaría a revisar este ADR.

Vigilar: **Cloudflare Pages permite 500 despliegues al mes en el plan gratuito.**
Cada dos horas son unos 360, que dejan margen para unos 140 despliegues de
código. Si hiciera falta refrescar más a menudo, hay que mover los JSON a R2 o KV
y dejar Pages solo para el código.

## Alternativas descartadas

- **Spring Boot en Railway.** Coherente con lo que el autor está aprendiendo,
  pero 300-500 MB de RAM en reposo por una aplicación de solo lectura, y con
  coste. No aporta nada aquí.
- **Worker con Cron Trigger y KV.** Elegante, pero muere en los 10 ms de CPU.
- **Llamar a la API desde el navegador.** Imposible: no hay CORS.
