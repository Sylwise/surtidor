# ADR-0018 · Las URLs de zona llevan el nombre, no el identificador

**Fecha:** 2026-08-08 · **Estado:** aceptado

## Contexto

Las páginas de zona se sirven en `/p-08/` y `/ccaa-09/`, mientras que las de
municipio ya usan el nombre: `/barcelona/badalona/`. El motivo del
identificador es que ocho nombres coinciden entre provincia y comunidad
autónoma, verificado contra el catálogo del ministerio con la propia función
`generarSlug`: Asturias, Cantabria, Ceuta, Madrid, Melilla, Murcia, Navarra
y Rioja (La). Baleares no colisiona: la provincia es "BALEARS (ILLES)" y la
comunidad "Baleares", que dan slugs distintos.

Un identificador no significa nada para nadie. Las 71 páginas de zona son
las que compiten por las búsquedas de mayor volumen del sitio, y llegan a
ellas con un código en la ruta.

## Decisión

**Las provincias usan el slug de su nombre**: `/barcelona/`, `/madrid/`.

**Las comunidades autónomas usan el slug de su nombre, salvo cuando colisiona
con el de una provincia**, en cuyo caso van bajo `/comunidad/{slug}/`.

La provincia se queda el nombre limpio en las ocho colisiones porque es la
que recibe casi todas las búsquedas: se busca "gasolineras Madrid", no
"gasolineras Comunidad de Madrid".

**Las 71 URLs antiguas responden con 301** mediante reglas exactas en
`public/_redirects`, una por zona. Nunca un comodín.

## Motivos

Comprobado con `wrangler pages dev` antes de tomar la decisión, no supuesto:
wrangler informa de 71 reglas válidas cargadas, sin descartar ninguna y sin
acercarse al límite de 2.000. `/p-08/` devuelve 301, `/barcelona/badalona/`
sigue sirviendo su página sin que ninguna regla la capture, y una zona
inventada da 404 sin engancharse a nada.

Esto no contradice ADR-0010 ni ADR-0012. Allí el problema eran 2.178 reglas
de municipio, que superaban el límite y wrangler descartaba en silencio, y
un comodín `/{provincia}/*` que se comía las páginas de municipio reales.
Aquí son 71 reglas exactas: otra escala y otro mecanismo.

## Consecuencias

Buenas: las URLs describen su contenido y son coherentes con las de
municipio. La jerarquía se lee sola: `/barcelona/` es el padre de
`/barcelona/badalona/`.

Malas, y hay que atenderlas en el mismo hito:

- Las 52 imágenes de compartición de provincia se renombran, y las 19 de
  comunidad según su esquema. Las de municipio no cambian.
- `zonaDeReserva` en `src/logica/zona.ts` construye `p-${id}` por dentro y
  busca esa cadena en el índice. No es routing, es una invariante escondida:
  si no se actualiza a la vez, un usuario con `p-08` guardado no recibe una
  zona de repuesto sino un error lanzado.
- `hrefProvincia` en la plantilla de municipio arma `/p-${id}/` a mano, sin
  pasar por ningún cálculo compartido. Es el único sitio que se saltó la
  abstracción y por eso es el que se olvidaría.
- `zonaIdDeDireccion` en `AppInteractiva.astro` deduce la zona del primer
  tramo de la URL. Sigue valiendo, pero el valor deja de ser un
  identificador.
- El fichero `public/_redirects` pasa a existir y hay que mantenerlo
  generado, no escrito a mano.

## Alternativas descartadas

- **Dejarlo como está.** Válido: el nombre en la ruta es una señal menor. Se
  cambia ahora porque ninguna de las 71 ha posicionado todavía ni la enlaza
  nadie desde fuera, así que el 301 no diluye nada. Más adelante sí lo
  haría.
- **Todo con prefijo**: `/provincia/barcelona/` y `/comunidad/cataluna/`.
  Más simétrico, y le quita a la provincia el nombre limpio, que es lo que
  vale.
