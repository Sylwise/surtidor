# ADR-0013 · La PWA con funcionamiento sin conexión queda descartada

**Fecha:** 2026-08-07 · **Estado:** aceptado

## Contexto

V2-14 pedía una PWA con la última zona en caché para uso sin conexión. El
manifiesto, los iconos y `display:standalone` ya están desde la v1; lo que
faltaba era el service worker.

## Decisión

No habrá service worker. V2-14 queda descartado, no aplazado. El manifiesto,
los iconos y `display:standalone` se conservan: el sitio sigue pudiendo
añadirse a la pantalla de inicio.

## Motivos

El motivo principal no es el riesgo, es la incompatibilidad. La regla dura del
proyecto dice que el precio de pantalla es el precio del cartel de la
gasolinera. Sin conexión no existe precio fresco, así que el modo sin conexión
entregaría precisamente lo que el proyecto se niega a entregar: una cifra que
el usuario no puede usar para decidir dónde repostar.

El segundo motivo es de reversibilidad. Un service worker es el único
componente del proyecto que no se corrige desplegando: el navegador sustituye
el antiguo cuando este se lo permite, no cuando el proyecto lo publica. Con un
despliegue cada dos horas, un error de estrategia de caché puede dejar
usuarios clavados en una versión antigua durante semanas, sin ninguna vía de
alcance desde el repositorio.

El beneficio que se pierde es menor de lo que parecía. La aplicación ya
funciona entera sin mapa, así que sin conexión solo se perderían los tiles; y
el caso de uso de mala cobertura lo cubre RNF-12, que mantiene cada provincia
por debajo de 100 KB comprimidos.

## Consecuencias

Buenas: desaparece la única clase de fallo del proyecto que no se arregla con
un despliegue. Se elimina toda posibilidad de servir un precio viejo sin que
el usuario lo sepa.

Malas: el navegador no ofrecerá la instalación automática, porque exige
service worker. Añadir a la pantalla de inicio sigue disponible a mano. Quien
pierda la cobertura dentro de la aplicación verá los estados de error de
siempre en lugar de datos en caché.

## Alternativas descartadas

- **Red primero con caché solo de respaldo.** Reduce la probabilidad de servir
  precios viejos, pero no la elimina, y no toca en absoluto el problema de la
  irreversibilidad: un service worker de red primero mal desplegado se queda
  igual de atascado.
- **Cachear solo el esqueleto y ningún dato.** Elimina el riesgo de precio
  viejo y conserva el de versión clavada. A cambio, sin datos la pantalla no
  sirve para nada, así que el beneficio queda en cero.
