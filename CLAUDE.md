# CLAUDE.md

Instrucciones para Claude Code en este repositorio.

## Contexto

Surtidor es un mapa de precios de carburantes de España. Sitio estático, sin
backend, sin base de datos, sin autenticación. Lee `README.md` y luego
`docs/01-especificacion.md` y `docs/03-arquitectura.md` antes de escribir nada.

El propietario del repo **no va a revisar el código línea a línea**. Prioriza
código legible, simple y con pocas dependencias sobre código listo. Si dudas
entre dos enfoques, elige el que sea más fácil de borrar.

## Reglas duras

Estas salen de errores ya cometidos. No las reinterpretes.

### 1. Nada de red puede bloquear el renderizado

Prohibido `<script src>` o `<link rel=stylesheet>` bloqueante hacia un CDN en el
`<head>`. Si el CDN se queda pendiente en lugar de fallar, el parser de HTML se
detiene ahí y el JavaScript de la página no llega a ejecutarse nunca. El
síntoma es una pantalla de carga eterna sin ningún error en consola.

- MapLibre se importa como dependencia npm y entra en el bundle. No por CDN.
- Toda petición de red lleva `AbortController` con timeout explícito.
- La interfaz se pinta en el primer frame, aunque esté vacía. Nunca hay un
  overlay opaco que dependa de una respuesta de red para desaparecer.
- Todo estado de carga tiene un temporizador de rescate que lo resuelve pase lo
  que pase.

### 2. El mapa es un extra, no el cimiento

La lista de estaciones, el panel de detalle y los filtros deben funcionar
completos aunque MapLibre no cargue. Si el mapa falla, se sustituye por un
mensaje que diga qué ha fallado, y el resto sigue vivo.

### 3. Los datos nunca se piden al MITECO desde el navegador

La API del ministerio no envía cabeceras CORS. El navegador siempre lee ficheros
JSON estáticos propios generados en el build. Ver `docs/04-fuente-datos.md`.

### 4. Nada de almacenamiento del navegador para datos de usuario

No hay cuentas ni sincronización. Las preferencias (combustible elegido, tamaño
del depósito) van en `localStorage` y en ningún sitio más. No se manda telemetría.

### 5. Sin dependencias que no ganen su sitio

Antes de añadir un paquete, comprueba si son treinta líneas de código propio.
Nada de librerías de utilidades genéricas, nada de frameworks de componentes,
nada de gestores de estado. La lista permitida está en `docs/03-arquitectura.md`.

## Cómo trabajar

- **Un hito por rama cuando hay dependencia entre ellos.** Los hitos están en
  `docs/06-roadmap.md`, en orden. Los hitos sin dependencia real entre sí (ver
  mapa de dependencias al principio de `06-roadmap.md`) pueden trabajarse en
  paralelo, cada uno en su propia rama/worktree, y converger antes del hito
  que los necesita a todos. Fuera de esos puntos de paralelismo explícitos, el
  orden sigue siendo estricto.
- **Verifica antes de decir que funciona.** `npm run build` tiene que pasar y
  tienes que haber cargado la página. "Debería funcionar" no vale.
- **Comprueba los casos de fallo a mano:** sin red, JSON corrupto, provincia sin
  estaciones, estación sin ese combustible, tiles bloqueados.
- **Los ADR son vinculantes.** Si crees que un ADR está equivocado, escribe uno
  nuevo que lo supersede y explica por qué. No lo contradigas en silencio.
- **Español** en comentarios, nombres de dominio (`estacion`, `precio`,
  `provincia`) y mensajes de interfaz. Inglés solo donde lo impone el lenguaje.

## Comandos

```bash
npm run dev          # desarrollo
npm run build        # build de producción
npm run preview      # servir el build
npm run data:fetch   # regenerar public/data/ desde la API del MITECO
npm run check        # tipos + lint
```

`npm run data:fetch` necesita salida a internet hacia
`sedeaplicaciones.minetur.gob.es`. Si estás en un entorno con la red
restringida, usa `npm run data:mock`, que genera datos falsos con la misma forma
y los marca con `"mock": true` para que la interfaz lo enseñe.

## Qué NO hacer

- No añadas anuncios, analítica, píxeles de seguimiento ni banners de cookies.
- No introduzcas un backend, una base de datos ni un servidor que corra 24/7.
- No cambies el diseño visual sin leer `docs/05-diseno.md`. La dirección está
  decidida.
- No pidas geolocalización al cargar. Solo cuando el usuario pulse el botón.
- No inventes precios. Si no hay dato, la interfaz dice que no hay dato.
- No borres la atribución de OpenStreetMap ni la del MITECO.
