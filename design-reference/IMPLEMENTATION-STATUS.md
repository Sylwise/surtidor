# Estado de implementación del rediseño

Fecha de cierre de esta iteración: 12 de agosto de 2026.

Este documento describe el estado real del trabajo en curso. No implica que el
rediseño esté aprobado ni terminado. No se ha creado el commit final.

## Archivos modificados

Implementación y estilos:

- `src/componentes/AppInteractiva.astro`
- `src/componentes/CabeceraGlobal.astro` (nuevo)
- `src/componentes/Controles.ts`
- `src/componentes/Evolucion.ts`
- `src/componentes/Lista.ts`
- `src/componentes/Marca.astro` (nuevo)
- `src/componentes/MenuHoy.astro` (nuevo)
- `src/componentes/NavegacionApp.astro`
- `src/datos/navegacion.ts` (nuevo)
- `src/estilos/editorial.css`
- `src/estilos/evolucion.css`
- `src/estilos/interfaz.css`
- `src/estilos/navegacion-global.css` (nuevo)
- `src/layouts/DocumentoEditorial.astro`
- `src/pages/hoy/cuanto-te-juegas.astro`
- `src/pages/hoy/evolucion/[provincia].astro`
- `src/pages/hoy/evolucion/index.astro`
- `src/pages/index.astro`

Documentación y utilidades presentes en el árbol de trabajo:

- `docs/08-evolucion.md`
- `scripts/capturar-estados-evolucion.mjs` (nuevo)
- `scripts/capturar-estados-principal.mjs` (nuevo)
- `scripts/capturar-viewport.mjs` (nuevo)
- `scripts/comprobar-cabeceras.mjs` (nuevo)
- `scripts/comprobar-teclado.mjs` (nuevo)
- `scripts/medir-explicaciones.ts` (nuevo)
- `artifacts/redesign-audit/*.png` (diez capturas nuevas)
- `design-reference/IMPLEMENTATION-STATUS.md` (este archivo)

`design-reference/` figura completo como no versionado en el estado actual de
Git. Contiene las referencias facilitadas para el trabajo; no debe asumirse que
todo el directorio fue generado por esta implementación.

## Arquitectura resultante

La navegación global comparte semántica y comportamiento sin imponer la misma
composición visual en todos los contextos:

- `CabeceraGlobal.astro` admite los modos explícitos `principal`, `evolucion` y
  `editorial`, además de las variantes clara y petróleo.
- `Marca.astro` centraliza la marca y enlaza siempre a `/`.
- `MenuHoy.astro` centraliza el catálogo, estados activos, apertura, cierre,
  Escape y devolución de foco. Puede funcionar de forma autónoma o controlada
  por la aplicación principal.
- `src/datos/navegacion.ts` es la fuente compartida del catálogo Hoy y de la
  resolución de rutas activas.
- La Principal conserva zona y Hoy como controles propios de la aplicación.
- Evolución desktop conserva las migas como contexto y Hoy como acción global.
- Evolución móvil sustituye la navegación editorial por zona compacta y
  “Explorar estaciones”.
- El artículo conserva la variante petróleo; desktop muestra Precios,
  Provincias y Hoy, mientras móvil muestra Hoy como acción única.

No se han introducido React, Tailwind, librerías de iconos, fuentes externas ni
dependencias nuevas.

## Pantallas implementadas

- Principal desktop, referencia `d0yaSA`.
- Principal móvil, referencia `coEwt`.
- Selector de zona desktop, referencia `JYmYz`.
- Selector de zona móvil, referencia `sHq6P`.
- Panel Hoy móvil, usando el identificador existente en el manifiesto.
- Evolución desktop, referencia `bi8Au`.
- Evolución móvil, referencia `lLXW9`.
- Artículo “Cuánto te juegas” desktop, referencia `wC99O`.
- Artículo “Cuánto te juegas” móvil, referencia `Iqts8`.
- Parte de los estados interactivos descritos por `SQ2EH`.

El resto de artículos hereda la cabecera, navegación, tokens, ancho editorial y
footer comunes, pero no se ha comparado visualmente cada artículo individual
contra un frame específico.

## Rutas y viewports comprobados

| Ruta | Viewports |
| --- | --- |
| `/asturias/` | 1440×1024, 390×844, 360×800 |
| `/hoy/evolucion/33/` | 1440×1024, 390×844, 360×800 |
| `/hoy/cuanto-te-juegas/` | 1440×1024, 390×844, 360×800, 390×1204 |

Las capturas están guardadas en `artifacts/redesign-audit/`:

- `principal-1440x1024.png`
- `principal-390x844.png`
- `principal-360x800.png`
- `evolucion-1440x1024.png`
- `evolucion-390x844.png`
- `evolucion-360x800.png`
- `articulo-1440x1024.png`
- `articulo-390x844.png`
- `articulo-360x800.png`
- `articulo-390x1204.png`

Son capturas de la implementación real, no composiciones lado a lado con los
PNG de referencia. La comparación se realizó inspeccionándolas contra los
frames y las imágenes de `../surtidor-pics/`.

## Problemas corregidos

- Tres cabeceras independientes sustituidas por componentes y datos comunes.
- Estados activos de Hoy calculados a partir de la ruta actual.
- Significado de Hoy mantenido entre Principal, Evolución y artículos.
- Evolución móvil liberada de la navegación Precios/Provincias/Hoy comprimida.
- Marca completa y controles específicos preservados en cada composición.
- Rail de Principal desktop ajustado a 380 px y rail de Evolución a 330 px.
- Iconos de Media provincial, Más barata y Cobertura restaurados.
- Ranking de Evolución corregido para que nombres y direcciones largas no
  ensanchen ni recorten el grid lateral.
- Unidad `€/L` duplicada eliminada en móvil.
- Tooltip del gráfico estabilizado, sin saltos y con textos que no se parten en
  múltiples líneas innecesarias.
- Gráfico contenido y alineado; etiquetas y líneas ya no se pisan.
- Estados de subida, bajada y comparación económica diferenciados por datos.
- Artículo reducido a una sección de combustible desarrollada y una progresión
  accesible hacia el resto, manteniendo acceso a todos los datos.
- Resumen, metodología, tabla, territorios especiales, transición y footer
  reordenados según la composición editorial.
- Selector de zona y panel Hoy corregidos en tamaño, capas, padding y cierre.
- Ficha de estación móvil corregida; cambiar de estación con la ficha abierta
  muestra la nueva selección y restablece el scroll interno a cero.
- Anchuras táctiles internas corregidas sin perder los 44 px mínimos.
- Documento y elementos visibles sin overflow horizontal a 360 px.

## Estados interactivos reproducidos

Evolución:

- Sin bajadas.
- Sin histórico.
- Combustible no disponible.
- Estación seleccionada.
- Resultado de búsqueda.
- “Ver todas” móvil.
- Tooltip del gráfico.

Principal y navegación:

- Estación seleccionada en desktop y móvil.
- Cambio de estación mientras la ficha está abierta.
- Selector de zona desktop y móvil.
- Panel Hoy móvil.
- Apertura con teclado, Escape y devolución del foco.
- Cierre mediante fondo exterior para los paneles que lo incorporan.
- Progresión entre combustibles del artículo y estado activo asociado.

## Estados no reproducidos

- No se guardó una captura específica del fallback visual con MapLibre fallando
  o deshabilitado. La lista y sus datos no dependen de que el mapa se pinte,
  pero esa degradación no se validó mediante una captura de fallo inducido.
- No se guardó una captura con `prefers-reduced-motion`; las reglas se revisaron
  en la implementación, pero no se capturó ese modo del sistema.
- El cierre por clic en el fondo se comprobó funcionalmente, pero no genera una
  diferencia visual persistente que pueda documentarse en una captura.
- No se recorrieron visualmente todas las provincias, municipios ni todos los
  artículos editoriales.
- No se hicieron capturas específicas de foco visible sobre cada control; la
  navegación y el elemento activo sí se comprobaron con automatización real de
  teclado.

## Diferencias deliberadas respecto a los frames

- Precios, fechas, recuentos y estaciones proceden de los datos reales actuales;
  no se sustituyeron por los valores estáticos de los frames.
- La cartografía, etiquetas y posición exacta del mapa dependen de las teselas y
  datos disponibles durante la captura.
- Algunos controles visibles son algo mayores que en el dibujo para respetar el
  objetivo táctil vinculante de 44 px.
- Las direcciones extensas de la lista Principal mantienen el patrón compacto
  del rail. Usan elipsis dentro de un ancho conocido; no provocan overflow del
  documento. Esto debe revisarse si se interpreta la prohibición de truncado
  como aplicable también a este patrón del frame, y no solo a errores de layout.
- A 360×800 no existe un frame independiente para todas las pantallas; se validó
  la adaptación responsive del frame móvil de 390 px.

## Fallos o dudas pendientes

- `astro check` muestra dos hints, sin errores, por interfaces `Props` declaradas
  y no usadas en `src/pages/[...zona]/index.astro` y
  `src/pages/[provincia]/[municipio]/index.astro`.
- El build avisa de chunks JavaScript superiores a 500 kB. No se inició otro
  refactor de partición porque queda fuera del cierre visual solicitado.
- La validación automatizada depende de un Firefox headless escuchando mediante
  WebDriver BiDi en el puerto 9225. Los scripts no levantan el navegador por sí
  solos.
- El comando de Firefox dentro del sandbox terminó con código 139 y solo
  imprimió `*** You are running in headless mode.`. Fuera del sandbox arrancó,
  aunque emitió `[GFX1-]: RenderCompositorSWGL failed mapping default framebuffer, no dt`.
  La conexión BiDi y las capturas sí funcionaron después del arranque externo.
- No hay aprobación visual final del usuario para considerar resueltas las
  diferencias deliberadas anteriores.

## Riesgos conocidos

- La navegación está compartida, pero `MenuHoy` mantiene dos modos de montaje
  —autónomo y controlado—. Comparten marcado y catálogo, aunque los listeners se
  instalan en lugares diferentes. Cambios futuros deben probar ambos caminos.
- La Principal sigue teniendo una composición y ciclo de vida más complejo que
  las páginas estáticas. Cambios en el render de filas pueden invalidar
  referencias DOM antiguas; la prueba de cambio de estación verifica el estado
  resultante, no la identidad del nodo reemplazado.
- El gráfico usa dimensiones calculadas en cliente. Cambios tipográficos o de
  contenido podrían alterar tooltip y etiquetas y requieren nueva captura.
- El artículo conserva todos los combustibles en el DOM, ocultando con `hidden`
  los paneles inactivos. Actualmente no afectan dimensiones ni accesibilidad;
  cualquier eliminación futura de `hidden` reintroduciría la página larga.
- Las capturas contienen datos reales y pueden diferir en una futura generación
  aunque el CSS no cambie.
- `design-reference/` y `artifacts/` están sin versionar. Un commit selectivo mal
  preparado podría omitir el estado de implementación o las capturas.
- `docs/08-evolucion.md` aparece modificado en el árbol. Debe revisarse antes de
  un commit para confirmar que el cambio documental pertenece al alcance y no
  se usa para justificar una desviación visual.

## No considerar terminado hasta validar

- Aprobación visual humana de las diez capturas contra sus frames.
- Fallback con fallo real o inducido del mapa, comprobando que filtros, lista y
  detalle continúan operativos.
- `prefers-reduced-motion` en un navegador configurado con reducción de
  movimiento.
- Navegación manual completa solo con teclado, además de la automatizada.
- Contraste AA con una herramienta de contraste sobre los estados activos,
  desactivados y de foco.
- Comportamiento con nombres y direcciones extremos procedentes de otras zonas.
- Revisión de todos los cambios no versionados antes de seleccionar archivos
  para commit.
- Confirmación explícita del usuario antes del commit final.

## Comandos ejecutados

Validación de proyecto:

```sh
npm run check
npm test
npm run build
node --test --experimental-strip-types src/logica/evolucion.test.ts
```

Captura y comportamiento:

```sh
node scripts/capturar-viewport.mjs URL ANCHO ALTO SALIDA 9225
node scripts/capturar-estados-principal.mjs
node scripts/capturar-estados-evolucion.mjs
node scripts/comprobar-cabeceras.mjs
node scripts/comprobar-teclado.mjs
```

Arranque usado para la automatización visual:

```sh
MOZ_ENABLE_WAYLAND=0 firefox --headless --remote-debugging-port 9225 --profile /tmp/surtidor-firefox-bidi-2 about:blank
```

## Decisiones provisionales

- Se mantiene MapLibre como mejora opcional y no como requisito para acceder a
  lista, filtros o detalle.
- Se conserva el truncado compacto en la lista Principal hasta una decisión de
  producto que determine si las filas deben crecer verticalmente.
- Se mantienen los controles visibles de 44 px aunque difieran algunos píxeles
  del frame.
- No se aborda en esta iteración la partición de los chunks JavaScript.
- No se realiza ninguna limpieza general ni refactor adicional antes de la
  aprobación visual.
- No se hace el commit final.
