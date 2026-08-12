# Estado de implementación del rediseño

Fecha de cierre de esta iteración: 12 de agosto de 2026.

La implementación descrita aquí está terminada y validada en el árbol de trabajo de `refactor-redisenio`. No se ha creado ningún commit final.

## 1. Archivos modificados

Cabecera y navegación compartidas:

- `src/componentes/CabeceraGlobal.astro`
- `src/componentes/MenuHoy.astro`
- `src/componentes/AppInteractiva.astro`
- `src/componentes/Controles.ts`
- `src/pages/hoy/evolucion/[provincia].astro`
- `src/estilos/navegacion-global.css`
- `src/estilos/interfaz.css`

Análisis y cálculos:

- `scripts/lib/agregados.ts` y `scripts/lib/agregados.test.ts`
- `scripts/lib/rotulos.ts` y `scripts/lib/rotulos.test.ts`
- `src/componentes/SelectorCombustibleEditorial.astro` (nuevo)
- `src/componentes/TablaCapitalesEditorial.astro`
- `src/componentes/TablaMinimosEditorial.astro`
- `src/componentes/TablaRotulosEditorial.astro`
- `src/pages/hoy/provincias-mas-baratas.astro`
- `src/pages/hoy/marcas-mas-baratas.astro`
- `src/pages/hoy/capitales-de-provincia.astro`
- `src/pages/hoy/la-mas-barata-de-espana.astro`
- `src/estilos/editorial.css`

Arquitectura de información:

- `src/layouts/DocumentoEditorial.astro`
- `src/pages/como-calculamos-los-datos.astro` (nuevo)
- `src/pages/sitemap.xml.ts`

Auditoría y validación:

- `scripts/capturar-estados-principal.mjs`
- `scripts/comprobar-cabeceras.mjs`
- `scripts/capturar-estado-editorial.mjs` (nuevo)
- `scripts/comprobar-editoriales.mjs` (nuevo)
- `scripts/comprobar-enlaces-build.mjs` (nuevo)
- `scripts/comprobar-fallos-runtime.mjs` (nuevo)
- `artifacts/redesign-audit-2026/` (capturas nuevas)

`design-reference/CODEX.md` y `design-reference/extract-design.py` ya estaban modificados antes de esta iteración y se han preservado sin revertirlos. `design-reference/IMPLEMENTATION-PROMPT.md` también era un fichero no versionado de entrada.

## 2. Rutas terminadas

- `/` y todas las vistas de zona: cabecera petróleo integrada, Precios activo y panel Hoy superpuesto sin reducir el mapa.
- `/hoy/evolucion/` y `/hoy/evolucion/[provincia]/`: cabecera compartida y catálogo Hoy contextual.
- `/hoy/provincias-mas-baratas/`: selector de cuatro combustibles, top 6 móvil/top 8 desktop, ranking completo, muestra y mercado fiscal separado.
- `/hoy/marcas-mas-baratas/`: umbral de 100 estaciones, cobertura, exclusiones y desglose fiscal inline en desktop/bottom sheet en móvil.
- `/hoy/capitales-de-provincia/`: 52 términos municipales validados, enlaces municipales reales y capitales fiscales aparte.
- `/hoy/la-mas-barata-de-espana/`: mínimo nacional real, empates, resumen por combustible y ranking por comunidad.
- `/como-calculamos-los-datos/`: fuente, reglas, fiscalidad y limitaciones en una página sustantiva.
- `/sitemap.xml`: incluye la nueva página metodológica.

El footer editorial compartido queda reducido a `Precios`, `Análisis de hoy` y `Cómo calculamos los datos`, sin columnas artificiales ni enlace principal de privacidad.

## 3. Cálculos y pruebas añadidos

- Todos los agregados editoriales filtran estaciones con `tipoVenta === 'P'`.
- El mercado general excluye los ids de provincia `35`, `38`, `51` y `52`.
- Provincias calcula medias simples solo con estaciones que publican el combustible; el ranking general contiene 48 provincias.
- Marcas agrupa por rótulo visible literal, aplica el umbral de 100 en el mercado general y de nuevo, independientemente, en Canarias, Ceuta y Melilla.
- Capitales usa una lista fija de 52 nombres, exige su coincidencia en el catálogo y filtra por término municipal exacto.
- Mínimos conserva todos los orígenes empatados y utiliza destino municipal o provincial según la navegación existente.
- Se añadieron casos unitarios para excluir venta restringida y para la selección fiscal de rótulos.

Resultado final de `npm test`: **31 ficheros de prueba, 31 aprobados, 0 fallos**.

## 4. Estados verificados

- Gasolina 95 activa al entrar y cambio funcional a los otros combustibles.
- Ranking resumido cerrado, apertura de la clasificación completa y nuevo cierre.
- Estado sin datos real: Gasolina 98 en Melilla.
- Bloque fiscal móvil de provincias, capitales y mínimos: cerrado, abierto con datos y cerrado de nuevo.
- Marcas fiscal desktop: cerrado y desplegado en línea.
- Marcas fiscal móvil: bottom sheet ajustado al contenido, fondo bloqueado, botón de cierre, Escape y retorno de foco.
- Menú Hoy: apertura, primer foco, Escape, clic exterior, botón explícito y retorno de foco en aplicación, Evolución y editorial.
- Selector de zona y explorador móvil de Evolución: apertura, Escape y retorno de foco.
- Panel Hoy desktop: el ancho del mapa antes y después es idéntico.
- Fallo inducido de WebGL/MapLibre: aparece el fallback y permanecen operativas 225 filas de lista.
- Fallo total inducido de los JSON locales: aviso, estado de error de lista y botón Reintentar.
- Sin JavaScript: el selector se oculta y el HTML ya renderizado permite mostrar consecutivamente los combustibles mediante fallback `noscript`.
- Anchos 390 y 360: sin overflow horizontal de documento.

Las editoriales son páginas estáticas calculadas en build: no hacen una carga de datos en el navegador. Por tanto, su estado inicial ya es contenido estable y un error de datos invalida el build en vez de publicar una pantalla rota. Los estados de carga y error de red se verifican en la aplicación, que es el contexto donde sí existe fetch en cliente; en los artículos se mantienen los estados vacíos/combustible sin datos.

## 5. Viewports capturados

Se inspeccionaron mediante `get_screenshot` y `execute/Get` los frames `tHmiP`, `H6Hff`, `qvNsS`, `rBOk6`, `PEvnN`, `sqQ5d`, `Y7RxG`, `ZN4E1`, `mflc5`, `HfY4I`, `KZy8w`, `i2enp` y las referencias complementarias indicadas en el prompt.

Capturas de rutas reales guardadas en `artifacts/redesign-audit-2026/`:

- Principal: 1440×1024, 390×844 y 360×800; selección, zona y Hoy abierto en desktop/móvil.
- Provincias: 1440×1024, 390×844, 390×1204 y 360×800.
- Marcas: 1440×1024 cerrado, 1440×1824 abierto, 390×844 cerrado y 390×1204 cerrado/abierto.
- Capitales: 1440×1024, 390×844, 390×1204 y 360×800.
- La más barata: 1440×1024, 390×844, 390×1204 y 360×800.
- Metodología: 1440×1024 y 390×1204.

## 6. Diferencias deliberadas frente al diseño

- Todos los importes, fechas, nombres y recuentos proceden del dataset actual; los números ilustrativos del canvas no se copiaron.
- El ranking general no reproduce la aparición ilustrativa de Tenerife en algún mock móvil: se aplica la regla funcional vinculante que lo excluye junto con Las Palmas, Ceuta y Melilla.
- En móvil, los datos fiscales de provincias, capitales y mínimos se mantienen inicialmente plegados para conservar la densidad del frame, pero tienen un `details` accesible en vez de quedar inaccesibles.
- El footer se muestra en documentos editoriales. No se fuerza dentro de la aplicación de mapa porque su interfaz ocupa exactamente el viewport, usa scroll interno y los frames `tHmiP`/`H6Hff` no contienen pie; los mismos tres destinos siguen accesibles mediante Precios/Hoy y la página metodológica.
- Los controles táctiles mantienen un mínimo de 44 px aunque algunos sean ligeramente mayores que el dibujo.
- Cartografía y posición exacta dependen de las teselas cargadas durante cada captura.

## 7. Problemas pendientes por severidad

### Alta

- Ninguno conocido.

### Media

- El build conserva el aviso preexistente de un chunk JavaScript superior a 500 kB, ligado principalmente a MapLibre. No afecta al resultado ni justifica introducir una dependencia o un refactor de carga fuera de alcance.

### Baja

- `npm run check` conserva dos hints preexistentes por interfaces `Props` no usadas en `src/pages/[...zona]/index.astro` y `src/pages/[provincia]/[municipio]/index.astro`; hay 0 errores y 0 warnings.
- La lista desktop usa elipsis intencionada para rótulos/direcciones largas dentro de su rail de 380 px. No produce overflow del documento.
- Los scripts BiDi requieren un Firefox headless ya iniciado en el puerto indicado.

## 8. Comandos ejecutados y resultado

```sh
npm run check
# 0 errores, 0 warnings, 2 hints preexistentes

npm test
# 31/31 aprobados

npm run build
# datos reales comprobados, 1159 imágenes de ruta + 6 editoriales + 1 genérica,
# 1221 páginas estáticas generadas; aviso no bloqueante de chunk >500 kB

node scripts/comprobar-enlaces-build.mjs dist
# 139321 referencias internas válidas en 1221 páginas HTML

node scripts/comprobar-cabeceras.mjs http://127.0.0.1:4173 9225
# menús, foco, Escape, exterior, cierre explícito y mapa sin encoger: correctos

node scripts/comprobar-editoriales.mjs http://127.0.0.1:4173 9225
# selectores, rankings, fiscal desktop/móvil y anchos 390/360: correctos

node scripts/comprobar-fallos-runtime.mjs http://127.0.0.1:4173 9225
# fallback de mapa, fallo de datos y combustible sin datos: correctos
```

No se ha hecho commit final.
