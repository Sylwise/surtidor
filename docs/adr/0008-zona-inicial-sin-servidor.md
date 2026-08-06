# ADR-0008 · La zona inicial se resuelve sin servidor

**Fecha:** 2026-08-05 · **Estado:** aceptado

## Contexto

Al abrir la web, el usuario debería ver su zona sin tener que elegirla. Pero
`CLAUDE.md` prohíbe pedir geolocalización al cargar, y con razón: un permiso
nada más entrar es la forma más rápida de que alguien cierre la pestaña.

Se evaluó una función de Cloudflare Pages que leyera la región de la petición y
redirigiera. Funciona, es gratis y no pide permisos. **Se descarta igualmente**:
introduce código que se ejecuta por petición, y la restricción del proyecto es
que no haya nada del lado del servidor. Una excepción "pequeña" es como empiezan
todas.

## Decisión

Cascada de tres pasos, todos en el navegador o en HTML estático:

1. **Zona guardada** en `localStorage`, si el usuario ha estado antes.
2. **La propia página de aterrizaje**, si llega desde una búsqueda. Quien busca
   "gasolineras baratas en Llodio" cae en `/llodio/`, que ya es su zona.
3. **Selector**, si es una visita directa a la raíz sin historial. Un solo toque,
   con las zonas más pobladas arriba y un campo de búsqueda.

El botón de "mi ubicación" se mantiene aparte, para centrar el mapa con
precisión, y **solo pide permiso cuando se pulsa**.

## Motivos

El problema es mucho más pequeño de lo que parecía. Por ADR-0007, **la mayoría
del tráfico va a entrar por una página municipal, no por la raíz**. Para ese
usuario la zona ya está resuelta sin detectar nada.

De los que entran por la raíz, los recurrentes se resuelven con `localStorage`.
Queda solo la primera visita directa, que es una fracción pequeña y para la que
un selector de un toque es una experiencia perfectamente digna: es honesto y
tarda menos que una ventana de permisos.

## Consecuencias

Buenas: cero servidor, cero permisos al cargar, cero cookies, cero servicios de
geolocalización por IP de terceros. La ubicación del usuario no sale nunca del
dispositivo (RNF-31).

Malas: la primera visita directa a la raíz requiere un toque. Se acepta.

**El selector no es un mal menor y no debe tratarse como tal.** Es la primera
pantalla que ve mucha gente. Zonas frecuentes arriba, búsqueda por nombre, y
áreas de pulsación grandes.

## Alternativas descartadas

- **Función de Cloudflare con la región de la petición.** Descartada por la
  restricción de no tener nada del lado del servidor.
- **API de geolocalización por IP de un tercero.** Añade una dependencia externa,
  una petición bloqueante y un tercero que ve la IP del usuario.
- **Pedir geolocalización al cargar.** Prohibido en `CLAUDE.md`. Es la manera
  más rápida de perder a alguien.
