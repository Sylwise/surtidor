# ADR-0020 · Los enlaces de portada viven en paneles dentro de la aplicación

**Fecha:** 2026-08-09 · **Estado:** aceptado

## Contexto

ADR-0017 exige que la portada sirva enlaces HTML reales a las 52 provincias y
las 19 comunidades autónomas. ADR-0019 añade la misma exigencia para las seis
páginas editoriales. La primera implementación reunió los 77 enlaces en un
bloque visible después de `.app`.

Ese bloque contradice la forma del producto. La aplicación ocupa `100dvh`: en
escritorio el mapa y el rail terminan en el borde de la pantalla y, en móvil,
la hoja es la única superficie que se desplaza. Colgar un directorio debajo
crea un segundo final de página que solo se descubre al desplazarse por
accidente y convierte una necesidad de enlazado interno en contenido visible
sin relación con la tarea «dónde reposto».

El selector de zona tampoco encaja en un desplegable convencional. Contiene 71
destinos, búsqueda, dos agrupaciones y recuentos. La implementación aceptada en
ADR-0017 conservó sus filas como botones creados en el cliente y duplicó los
destinos como enlaces al final de la portada porque entonces era la alternativa
más simple.

## Decisión

**Nada cuelga debajo de `.app`, tampoco en la portada.** Los enlaces
territoriales y editoriales se sirven dentro de la cabecera de la aplicación en
dos superficies distintas.

El selector territorial pasa a ser un panel de selección amplio. Sus 71 filas
son enlaces `<a href>` presentes en el HTML del build. Con JavaScript, la
navegación se mejora para conservar el cambio de zona sin recarga de RF-88; sin
JavaScript, el enlace navega normalmente. En escritorio el panel se presenta
centrado sobre el mapa con fondo atenuado. En móvil ocupa el ancho disponible
bajo la cabecera. Tiene título, buscador, cierre explícito, cierre con `Escape`
y marca visible para la zona activa.

Las seis editoriales viven en un acceso independiente llamado «Hoy», presente
en la cabecera de todas las páginas de aplicación. Es un panel compacto en
escritorio y de ancho completo bajo la cabecera en móvil. Sus seis destinos son
enlaces HTML reales. No se mezclan análisis editoriales y territorios en una
misma lista.

## Motivos

El selector es el padre natural de las páginas de zona: convierte el control
que la persona ya utiliza en la misma jerarquía de enlaces que necesita el
rastreador. La mejora progresiva permite mantener RF-88 sin duplicar 71
destinos en otra parte del documento.

«Hoy» separa la intención de leer análisis de la intención operativa de elegir
una zona. Al estar en todas las páginas de aplicación sigue siendo accesible
aunque la raíz redirija a la última zona recordada.

Los paneles superpuestos conservan el contrato visual de una sola pantalla. El
documento no crece y no aparece un sitemap visual después del mapa.

## Consecuencias

ADR-0017 sigue mandando sobre la jerarquía portada → zona → municipio, pero
queda superada su alternativa descartada «convertir el selector de zona en
enlaces». La nueva implementación sí sirve el selector en el HTML y lo mejora
en el cliente, por lo que ya no exige elegir entre enlaces y cambio sin recarga.

La cabecera y los paneles pasan a ser estructura compartida por la portada y
las páginas de zona y municipio. Solo puede haber un panel de navegación
abierto a la vez. Al abrir uno se cierra el otro y el foco vuelve a su control
al cerrarlo.

Los 77 enlaces permanecen en el HTML servido y cuentan para RNF-12, aunque ya
no alargan visualmente el documento. El buscador filtra en el cliente, pero no
crea ni elimina destinos.

## Alternativas descartadas

- **Mantener los enlaces debajo del mapa.** Cumple el enlazado interno, pero
  rompe la aplicación de una pantalla y presenta un directorio que no forma
  parte de la tarea principal.
- **Ocultar el bloque inferior solo con CSS.** Conserva la duplicación y crea
  contenido deliberadamente invisible en vez de una navegación útil.
- **Un único menú para zonas y editoriales.** Mezcla 71 destinos operativos con
  seis documentos de lectura y dificulta encontrar ambos.
- **Confiar solo en el sitemap.** Reabre el problema resuelto por ADR-0017: las
  páginas se descubren, pero quedan sin jerarquía de enlaces internos.
