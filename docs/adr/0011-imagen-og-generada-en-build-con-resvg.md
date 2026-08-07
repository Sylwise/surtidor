# ADR-0011 · La imagen de compartición se genera en el build con `resvg`, con fuentes propias embebidas

**Fecha:** 2026-08-07 · **Estado:** aceptado

## Contexto

RF-66 (H11) pide una imagen `og:image` de 1200×630 por página de zona y de
municipio, con el precio mínimo del día, para que compartir un enlace en
WhatsApp o Telegram muestre una tarjeta con datos en vez de un rectángulo
gris. Regla dura 1 de CLAUDE.md: nada de servicios externos ni de generación
en tiempo de petición — tiene que salir del build, igual que todo lo demás.

Dibujar y rasterizar texto a PNG sin ninguna librería no son "treinta líneas
propias" (docs/03-arquitectura.md exige esa comprobación antes de añadir una
dependencia): un rasterizador de glifos de verdad es un proyecto en sí
mismo. Hacía falta elegir cómo generar 1161 imágenes por build sin arrastrar
nada pesado ni no determinista.

## Decisión

1. **`@resvg/resvg-js`** (binding nativo de Rust, sin motor de layout HTML)
   convierte a PNG un SVG que `scripts/generar-imagenes-compartir.ts`
   construye a mano por interpolación de cadenas — solo `<rect>` y `<text>`,
   con los colores de `tokens.css` copiados literalmente. Corre en Node
   durante `npm run build`, nunca en el navegador: no cuenta para el
   presupuesto de JS de RNF-11 y no es una dependencia del bundle, solo de
   `scripts/`.
2. **Dos fuentes embebidas en `scripts/lib/fuentes/`** (Inter y JetBrains
   Mono, licencia OFL, con su `OFL-*.txt` al lado): el script corre tanto en
   el portátil de quien desarrolla como en el runner de GitHub Actions, y
   cada sistema operativo trae un catálogo de fuentes distinto. Dejar que
   `resvg` cargara fuentes del sistema (`loadSystemFonts: true`) habría hecho
   que el mismo build produjera imágenes distintas según dónde se ejecuta —
   justo lo que una tubería de datos reproducible no puede permitirse. Con
   `loadSystemFonts: false` y `fontFiles` explícito, el resultado es idéntico
   en cualquier máquina y no depende de red en build (las fuentes se
   descargaron una vez, se comprobaron y se comitearon; no se vuelven a
   pedir).
3. **El precio no se pinta en `--mejor` como color de texto directo sobre
   `--petrol`.** El encargo original decía "precios en `--mejor`", pero esa
   pareja da ~2:1 de contraste, muy por debajo del 4,5:1 de RNF-22 — se vio
   al medir el primer render, no a ojo. `docs/05-diseno.md` ya había resuelto
   este mismo problema para "la más barata" en el resto de la interfaz:
   "fondo `--mejor`, texto blanco, a más de 7:1". Aquí se repite exactamente
   ese patrón (una píldora rellena de `--mejor` con el número en `--paper`
   encima) en vez de inventar una regla de color nueva solo para esta
   imagen. El precio sigue "yendo en `--mejor`" — es la identidad visual de
   la píldora — pero los glifos que hay que leer son blancos.

Medido con los 1160 zonas+municipios reales (no una extrapolación desde una
muestra menor: el render es tan rápido que generar todas costó menos que
escribir la extrapolación): **~10,2 s añadidos al build** (antes 2,3 s solo
de `astro build`), **~35 MB / 1160 ficheros nuevos en `dist/`** (el límite de
Cloudflare Pages es 20.000 ficheros; el sitio pasa de 1228 a ~2388). Ninguno
de los dos números aprieta.

Verificado sirviendo el `dist/` real con `wrangler pages dev`: las tres
etiquetas `og:image` (municipio, provincia, comunidad) son URLs absolutas,
las tres imágenes responden 200 con `content-type: image/png`, y el texto
dibujado coincide con el JSON-LD y la tabla de la misma página. El camino de
"no vende" (ninguna estación de la zona vende ese combustible) no lo dispara
ningún dato real de España hoy — las 1160 zonas y municipios con página
venden gasolina 95 y diésel en todas partes — así que se probó de forma
sintética, con una tarjeta fabricada a mano; sigue sin verificar contra un
caso real, igual que RF-56.

## Alternativas descartadas

- **Puppeteer/Playwright renderizando una página HTML.** Exige un Chromium
  entero para pintar tres líneas de texto, multiplicado por 1161 páginas: el
  coste de arranque por sí solo habría dominado el build. Además añade una
  dependencia mucho más pesada que un rasterizador SVG.
- **`sharp` + una plantilla rasterizada aparte.** `sharp` composita
  imágenes; seguiría haciendo falta algo que dibuje el texto primero. No
  resuelve el problema, solo lo mueve.
- **Fuentes del sistema en vez de embebidas.** Determinista dentro de una
  sola máquina, no entre el portátil de desarrollo (Fedora) y el runner de
  GitHub Actions (Ubuntu). Se descartó por la razón de fondo de este
  proyecto: un build reproducible no puede depender de qué haya instalado el
  sistema operativo de turno.
- **Satori (JSX → SVG con layout flexbox).** Pensado para maquetar tarjetas
  complejas con múltiples cajas; aquí el layout es fijo y con tres líneas de
  texto, así que construir el SVG a mano es más simple y con una capa menos
  que depurar.

## Consecuencias

Buenas: la tarjeta sale del build, sin red ni proceso en tiempo de petición
(RNF-02 intacto), con un coste de tiempo y espacio que no aprieta ningún
límite gratuito. El resultado es pixel-idéntico en cualquier máquina que
ejecute el build.

Malas: segunda dependencia de verdad del proyecto (tras `wrangler`, que ya
era de despliegue) y primeros ficheros binarios grandes en el repositorio
(~1 MB de fuentes). Ninguno de los dos se despliega — `scripts/lib/fuentes/`
está fuera de `public/`, igual que `datos-build/` — pero sí pesan en el
histórico de git. Si algún día hace falta reducirlo, la vía es sustituir las
fuentes variables completas por subconjuntos con solo los glifos que usan
los catálogos del ministerio (latín + acentos españoles).
