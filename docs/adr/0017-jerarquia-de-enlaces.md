# ADR-0017 · El sitio se recorre por enlaces, no solo por el sitemap

**Fecha:** 2026-08-08 · **Estado:** aceptado

## Contexto

Comprobado sobre el sitio publicado:

- `surtidor.app/` no contiene ningún `<a href>`. Cero.
- `surtidor.app/madrid/` contiene uno: el logo, que vuelve a la portada. Los
  otros tres `href` del documento son los iconos y el manifiesto.
- `surtidor.app/madrid/alcorcon/` contiene 55, hacia municipios vecinos.

Es decir: las páginas de municipio se enlazan entre sí, y no hay ningún
camino desde la portada ni desde las páginas de zona hacia ellas. Las 1.162
páginas se descubren únicamente por el sitemap.

La causa es que el selector de zona es un `<button type="button">` con un
manejador que cambia el estado. Funciona para el usuario y no deja rastro
para un rastreador.

## Decisión

**La portada contiene enlaces reales a las 52 provincias y las 19
comunidades autónomas.** En el HTML servido, como `<a href>`.

**Cada página de zona contiene enlaces reales a todos sus municipios con
página propia.** Es el índice de lo que tiene debajo, y es lo que impide que
ninguna quede huérfana.

La jerarquía queda: portada → zona → municipio → estación.

El selector de zona sigue funcionando como hoy. Esto no lo sustituye: añade
el camino que faltaba.

## Motivos

Un sitemap sirve para descubrir URLs. **No transmite autoridad**: eso solo
viaja por enlaces. Sin jerarquía, la autoridad que gane el dominio se queda
en la portada sin repartirse a ninguna página de zona ni de municipio, que
son las que tienen que posicionar.

Y el descubrimiento por sitemap es más frágil: una URL que solo aparece ahí
y que ningún documento enlaza recibe menos atención de rastreo que una
enlazada desde su padre natural.

## Consecuencias

Buenas: el sitio pasa a ser recorrible. Cada página de municipio tiene un
padre que la enlaza.

Malas: la portada y las páginas de zona crecen. Setenta y un enlaces en la
portada y hasta 130 en una zona grande son kilobytes, no megas, pero cuentan
contra RNF-12 y hay que medirlo.

Este ADR es condición previa para recortar el bloque de municipios que
cierra una página de municipio. Ese recorte solo es seguro si el enlazado
completo vive en la página de zona; hoy no vive en ninguna parte, y hacerlo
antes habría dejado huérfanos a cientos de municipios.

## Alternativas descartadas

- **Confiar en el sitemap.** Es lo que había. Descubre pero no reparte
  autoridad.
- **Convertir el selector de zona en enlaces.** Resolvería la portada, pero
  el selector es un panel que se abre: su contenido no está en el documento
  hasta que el usuario lo pide. Además cambiaría el comportamiento del
  RF-88. Es más simple añadir enlaces servidos que rehacer un control que
  funciona.
