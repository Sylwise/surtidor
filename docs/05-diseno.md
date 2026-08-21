# 05 · Diseño

La dirección visual está decidida. Este documento es vinculante: no la cambies
sin escribir un ADR.

## La idea

El mundo del que sale este producto es el de la carretera: el cartel iluminado
en la entrada de la gasolinera, los dígitos de segmentos del surtidor, la señal
que lees a ochenta por hora.

De ahí salen las dos decisiones que sostienen todo lo demás:

**El mapa es pálido y el color vive en los precios.** El estilo `positron` es
gris casi sin saturación. Lo único cromático de la pantalla es el dato que has
venido a ver. Si algo tiene color y no es un precio, sobra.

**Los marcadores son tótems en miniatura.** No son chinchetas: son el cartel de
precio con su postecito hasta el punto exacto de la estación, igual que el
letrero de la entrada. Resuelve además el problema de anclaje, porque el poste
señala a qué punto del mapa corresponde el precio.

### Esquema de color del navegador

Surtidor ofrece una única paleta clara y el navegador no debe reinterpretarla.
Todos los documentos declaran `<meta name="color-scheme" content="only light">`
y `tokens.css` reafirma `color-scheme: only light` en `:root`. Es una
restricción del sistema visual: algunos navegadores móviles aplican un modo
oscuro forzado a las páginas que no anuncian su esquema y pueden transformar
por separado fondos, controles y lienzos.

Todo color visible debe salir de los tokens o estar declarado expresamente por
un componente. Esto incluye estados nativos como `::placeholder`; no se delegan
color ni opacidad en la hoja de estilos del navegador. El contenedor y el
`canvas` de MapLibre reafirman el esquema claro porque el mapa es una superficie
renderizada independiente y no debe recibir una transformación distinta.

## Tokens

Fuente única de verdad: `src/estilos/tokens.css`. Ningún color literal fuera de
ahí.

```css
:root{
  /* Chrome: gasóleo */
  --petrol:      #16323B;
  --paper:       #EDEFEF;
  --hair:        rgba(22,50,59,.14);
  --hair-dark:   rgba(255,255,255,.13);
  --muted:       #6B7B82;
  --muted-light: rgba(255,255,255,.58);

  /* Escala de precio: barata → cara */
  --p1: #00786F;
  --p2: #4E8C86;
  --p3: #78838C;
  --p4: #C06A2E;
  --p5: #A6371F;

  /* La más barata: verde profundo, extremo del lado barato */
  --mejor:      #046A38;
  --mejor-aro:  #FFFFFF;
  --mejor-texto: #3FD69A;

  /* Acento de chrome: selección y foco. NUNCA en el mapa ni en la lista. */
  --signal: #F5B921;

  --mono: ui-monospace,"SF Mono",SFMono-Regular,"Roboto Mono",Menlo,Consolas,monospace;
  --sans: system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",sans-serif;
}
```

**El ámbar `--signal` no marca nunca un precio.** Se usó al principio para la
estación más barata y era un error: el ámbar cae en la misma familia de tono que
`--p4` y `--p5`, que son el extremo caro. El marcador más importante de la
pantalla acababa vestido del color del que hay que huir.

La más barata va en `--mejor`, un verde profundo, que es el extremo natural del
lado barato. `--signal` se queda solo para el chrome: borde del tótem, fila de
combustible seleccionado, foco de los campos. Ahí el fondo es `--petrol` oscuro,
el contexto es otro y no compite con ninguna escala.

**`--mejor` rellena, `--mejor-texto` escribe. Nunca al revés.** `--mejor` es un
color de relleno: está pensado para llevar texto blanco encima, a más de 7:1 de
contraste (píldora del marcador, fila de la ficha). Usado directamente como
color de *texto* sobre `--petrol` —otro tono oscuro— el contraste cae a ~2:1,
muy por debajo del 4,5:1 de RNF-22: fue el error de la primera versión de la
imagen de compartición (RF-66), que además "solucionaba" el problema con un
verde inventado sobre la marcha en vez de un token. `--mejor-texto` es ese
segundo verde, ya resuelto: más claro, pensado para escribir directamente sobre
fondos oscuros (7,3:1 sobre `--petrol`). Se usa donde el precio tiene que ser el
color del propio texto, no el relleno de una píldora.

**Distinguir la más barata no puede depender del tono.** El tono ya lo ocupa la
escala, y `--mejor` es vecino de `--p1` y `--p2`. El destaque viene de tres
canales que la escala no usa:

- **contorno** de 2 px en `--mejor-aro` alrededor de la píldora
- **tamaño**: un punto más de cuerpo y algo más de relleno
- **contraste**: `--mejor` es más oscuro y saturado que cualquier banda, con
  texto blanco a más de 7:1

**La banda central es gris a propósito.** No es un color sin decidir: es la
afirmación de que la mayoría de las estaciones no tienen nada de particular y no
deben gritar. Solo destaca lo que merece que te desvíes.

Nada de rojo-verde puro, por dos motivos: es el cliché de todos los
comparadores, y con deuteranopia se pierde. Teal contra terracota mantiene
diferencia de luminosidad además de tono.

## Tipografía

Sin fuentes web. Ni una. Cargar tipografías desde un CDN contradice la regla de
que nada de red bloquee el renderizado, y añade peso a la carga inicial. La
personalidad se consigue con el ajuste, no con el fichero.

- **Precios: monoespaciada, con `font-variant-numeric: tabular-nums`.** No es un
  apaño por no tener fuente propia: los displays de surtidor y los carteles de
  carretera siempre han sido dígitos de ancho fijo. Además hace que los precios
  se alineen en columna y se puedan comparar de un vistazo.
- **Interfaz: pila del sistema.** Rápida, familiar, cero bytes.
- **Micro-etiquetas:** mayúsculas, 10 px, peso 650, `letter-spacing: .16em`.
  Marcan estructura sin ocupar sitio.
- **Interlineado** de 1,45 a 1,6 en texto corrido. Nunca por debajo de 1,4.

Escala: 10 · 11 · 12,5 · 14,5 · 17 · 19 px. Manténla. Si necesitas un tamaño que
no está, probablemente el problema es de jerarquía, no de tamaño.

## Distribución

**Escritorio**

```
┌────────────────────────────────────────────────┐
│ Surtidor · ÁLAVA   [95][Diésel][98][Premium]   │
│                             □ Solo abiertas    │
├──────────────┬─────────────────────────────────┤
│ TÓTEM        │                                 │
│ (estación    │        MAPA (positron)          │
│  elegida)    │     tótems con el precio        │
│              │                                 │
├──────────────┤                                 │
│ MÁS BARATAS  │                                 │
│ 1 Ballenoil  │  [leyenda]          [sello] │
│ 2 Plenoil    │                                 │
└──────────────┴─────────────────────────────────┘
```

Rail de 326 px fijo. El tótem arriba porque es la respuesta; la lista debajo
porque es la alternativa.

**Móvil**

El móvil **no** es el escritorio con el rail abajo. La primera versión de este
documento lo describía así —`column-reverse` y `max-height: 47vh`— y salió mal:
tres franjas horizontales, ninguna con sitio, el mapa aplastado en una banda de
280 px y los controles cortándose por abajo. Se corrige aquí.

**El mapa es el sustrato y ocupa toda la pantalla. Lo demás flota encima.**

```
┌──────────────────────────────┐
│ Surtidor      ARABA/ÁLAVA  ▾ │  48 px máx.
├──────────────────────────────┤
│                              │
│                              │
│         MAPA                 │  todo el resto,
│      (a pantalla             │  por debajo de
│       completa)              │  la hoja
│                              │
│                              │
├──────────────────────────────┤
│ ──────                       │  asa
│ [95][Diésel][98][Premium]    │  cabecera fija
│ ○ Solo abiertas ahora        │  de la hoja
├──────────────────────────────┤
│ 1  GM OIL          1,549     │  contenido
│ 2  GUGAS           1,553     │  desplazable
└──────────────────────────────┘
```

Reglas:

- **Barra superior de 48 px como máximo**: logotipo y selector de zona. Nada más.
- **El selector de depósito sale de la cabecera.** Es una preferencia que se
  configura una vez en la vida y estaba ocupando 95 px de la mejor zona de la
  pantalla, de forma permanente. Se muda dentro de la ficha de estación, junto al
  cálculo de ahorro, que es el único sitio donde significa algo.
- **Hoja inferior con tres posiciones**, arrastrable con puntos de anclaje:
  asomada (~110 px: solo el asa, los controles y la estación más barata), media
  (55 % de la altura) y completa (90 %).
- **La posición inicial es asomada.** Conserva visible el centro del mapa y la
  respuesta cartográfica; combustible, filtro y estación más barata siguen a un
  toque. Pulsar el asa abre la posición media y seleccionar una estación abre la
  completa. La posición es transitoria y no se guarda entre visitas.
- **El selector de combustible y el filtro viven en la cabecera de la hoja**, y
  son visibles en las tres posiciones. Nunca se cortan. Son lo que más se toca.
- **La ficha de estación se apila encima de la lista**, dentro de la hoja, no la
  sustituye. Se sigue pudiendo desplazar hasta la lista para comparar, que es
  justo lo que quieres hacer cuando acabas de elegir una.
- **Al abrir, `fitBounds` sobre las estaciones de la zona** con un 8 % de margen.
  Nunca un centro y un zoom fijos: con centro fijo, media pantalla acaba siendo
  campo vacío.
- La leyenda se oculta: no hay sitio y el precio va escrito.

Todo control interactivo tiene un área de pulsación de 44 px como mínimo, aunque
su parte visible sea menor.

### Los dos estados de la hoja

La hoja no muestra siempre lo mismo. Tiene **estado de lista** y **estado de
ficha**, y arrastrar los controles de uno al otro es lo que hace que en 730 px de
alto no quepa nada.

**Estado de lista.** Cabecera de la hoja con las pestañas de combustible.
Debajo, la cabecera de la lista: `MÁS BARATAS · 72 · [Abiertas]`. Tras conceder
ubicación, el propio título se convierte en selector:
`BARATAS / CERCANAS`. La opción activa usa `--petrol` y mayor peso; la
otra queda en `--muted`. No añade cajas, subrayados ni una segunda fila de
controles. Luego las filas.

**El filtro de abiertas no tiene fila propia.** Es una píldora en la cabecera de
la lista, junto al contador que modifica. Una fila entera para un interruptor son
44 px tirados, y además estaba lejos del número al que afecta.

**Estado de ficha.** El selector de combustible permanece accesible en la
cabecera y la ficha lista los seis precios. **Las seis filas de combustible que
la estación vende son pulsables**. Tocar
"Gasolina 98 · 1,769" lo convierte en el combustible activo. Objetivo de
pulsación grande y el precio por delante. La fila activa se marca en `--signal`.

### Cerrar la ficha

Con la ficha abierta queda una franja de mapa visible arriba en la que no se
puede pulsar. Eso no es espacio sobrante: **es el sitio al que todo el mundo va a
ir para cerrar.**

Tres salidas, y las tres valen:

1. **Tocar el mapa** cierra la ficha y vuelve al estado de lista.
2. **Arrastrar la hoja hacia abajo** hasta la posición asomada.
3. **Una X** en la esquina de la ficha, para quien no descubra las otras dos.

**Todo cierre de superficie usa el mismo botón.** Área de pulsación de 44 × 44
px, símbolo `✕`, fondo transparente y sin círculo ni borde permanente. Solo
aparece un fondo tenue al pasar el puntero, enfocar o pulsar. En reposo tiene
contraste suficiente para reconocerse sin buscarlo: sobre superficies claras
se acerca a `--petrol`; sobre el tótem oscuro, a `--paper`. La
ficha, el selector territorial y el panel «Hoy» no inventan variantes propias.

### Cabecera en móvil

La palabra "Surtidor" **no se muestra en móvil**, solo el icono. El nombre no
aporta nada a quien ya está dentro, y ese ancho lo necesita el selector de zona.
En escritorio se mantiene.

**El aspecto no se sacrifica por el rendimiento.** Los marcadores siguen siendo
elementos del DOM con CSS completo —píldora redondeada, sombra, poste, contorno
de la más barata, transiciones— precisamente para que retocar el aspecto siga
costando una línea. Ver [ADR-0006](adr/0006-marcadores-dom-con-colisiones.md).

## Componentes

### Tótem (ficha de estación)

Fondo `--petrol`, borde inferior de 3 px en `--signal`. Réplica del cartel:
rótulo arriba, filas de combustible con el precio en monoespaciada grande a la
derecha. El combustible seleccionado se pinta en `--signal`; los demás en
blanco. "no vende" en gris al 28 % y un cuerpo menor, porque la estación no
vende ese combustible y el estado no debe competir con los precios.

Debajo, el bloque de ahorro: el número en euros es lo más grande del bloque.

### Marcador

```
┌────────┐
│ 1,409  │   ← cartel: mono, tabular, borde blanco de 1,5 px
└────────┘
    │        ← poste: 1,5 px, 9 px de alto
    ●        ← punto real de la estación (anchor: bottom)
```

Estados:
- **normal** — fondo según la banda de precio
- **más barata** — fondo `--mejor`, texto blanco, contorno de 2 px en
  `--mejor-aro`, un punto más grande. Nunca ámbar.
- **cerrada** — opacidad 42 %, nunca oculta
- **seleccionada** — contorno de 2,5 px en `--petrol`

### Pastilla provincial · vista nacional

Por debajo de zoom 8 el mapa sustituye estaciones y racimos por el resumen
nacional. Al alcanzar zoom 8,5 vuelven los racimos o estaciones de la zona que ya
estaba cargada. Entre ambos valores se conserva el modo anterior: esa histéresis
evita que un `fitBounds` o un gesto pequeño haga alternar las dos vistas. Los
umbrales son constantes de producto ajustables después de probarlos en 360 px y
escritorio.

La pastilla provincial es neutra: no usa `--p1` a `--p5`, `--mejor` ni
`--signal`. Una escala nacional contradiría el ámbito de comparación de
ADR-0003 y mezclaría realidades fiscales que no deben codificarse con el mismo
color. El precio sigue siendo el dato principal por tamaño y tipografía, no por
tono.

```
┌────────────────────┐
│ ARABA/ALAVA        │  ← nombre oficial verbatim
│ 1,547 €/L          │  ← mono, tabular, cifra principal
│ 84 estaciones      │  ← origen visible de la media
└────────────────────┘
         │              ← puede alargarse si la colisión desplaza el cartel
```

La media es simple por estación pública. Solo cuentan las que venden el
combustible; `null` nunca es cero. El filtro de abiertas no modifica ni la media
ni su `n`. Si `n` es cero, la segunda y tercera líneas se sustituyen por «Aquí
no hay {combustible} · 0 estaciones»: no se usa un guion que parezca una carga
pendiente ni un color de precio.

El ancla es la media de las coordenadas de todas las estaciones públicas de la
provincia, no solo de las que venden el combustible. Por eso no se mueve al
cambiar de producto. En provincias insulares puede caer en el mar o entre
islas: representa al conjunto provincial y no finge ser una estación, una
capital ni el centro de una geometría administrativa. Canarias, Ceuta y Melilla
se muestran en su posición geográfica real, sin inset.

Pulsar selecciona esa provincia como zona mediante el mismo flujo explícito que
el selector territorial: actualiza URL, lista y ficha, carga solo su JSON y
encuadra sus estaciones. Alejar, acercar o desplazar sin pulsar no cambia nunca
la zona cargada. El selector sigue mostrando esa zona mientras el mapa enseña
el resumen nacional.

Las 52 pastillas no caben simultáneamente en 360 px. La detección de colisiones
puede ocultarlas con un orden determinista: foco primero; después provincias con
dato, de menor a mayor media; finalmente provincias sin estaciones vendedoras; los empates por ID
oficial. Una pastilla oculta sale también del recorrido de teclado. Cuando baste
un desplazamiento visual corto para resolver una colisión, el poste conserva el
ancla en el centroide.

Cada pastilla visible es un botón de al menos 44 × 44 px. Su etiqueta accesible
dice, por ejemplo, «ARABA/ALAVA. Precio medio de gasolina 95: 1,547 euros por
litro, calculado sobre 84 estaciones. Pulsar para abrir la provincia». Con cero
estaciones vendedoras anuncia «Aquí no hay {combustible}». El orden de tabulación
es estable por catálogo, no por precio.

Cada provincia se identifica por su ID oficial y conserva el mismo nodo del DOM
al desplazar el mapa o cambiar de combustible. Entrar y salir del modo oculta y
muestra registros; no recicla una pastilla por su índice ni reconstruye las 52.
Ver ADR-0021 y ADR-0022.

### Lista

En el orden inicial, número de puesto por precio en mono a la izquierda, rótulo
y dirección en el centro, precio en píldora de color a la derecha. La píldora
usa la misma banda que el marcador, para que lista y mapa hablen el mismo idioma
cromático.

Al pulsar «Mi ubicación», el mapa centra con zoom mínimo 13, la posición de la
izquierda se sustituye por la distancia geográfica aproximada y las filas se
ordenan de menor a mayor distancia. No se presenta como ruta ni tiempo de conducción. La posición del
usuario aparece en el mapa como un punto azul compacto con aro claro, sin pulso,
sombra decorativa, halo de precisión ficticio ni participación en racimos y colisiones. La
posición y el modo de orden viven solo en memoria durante esa carga.

### Selector de combustible

Selector desplegable hermano del selector de zona. En escritorio ambos viven
juntos en el rail; en móvil aparecen en la misma línea. El panel abierto agrupa
los seis combustibles en **habituales** (gasolina 95, diésel, gasolina 98 y
diésel +) y **alternativos** (gasóleo B y GLP).

Cada fila muestra a la derecha el precio mínimo de la zona, en monoespaciada y
sin píldora de color. El selector cerrado es una pastilla oscura sólida: cifra
dominante y nombre pequeño en gasolina, nombre principal en los diéseles. Para
gasóleo B y GLP, el nombre completo es principal y «Alternativo» el descriptor.
No muestra precio y su flecha va sin círculo.

El GLP no es comparable con los demás combustibles: como este panel coloca los
seis precios uno debajo de otro, ninguna fila lleva banda y la nota explica que
su mayor consumo por volumen impide comparar directamente su precio por litro.
Fuera del panel, mapa y lista sí comparan estaciones de GLP entre sí con la
escala territorial común.

El filtro «Abiertas» sigue siendo una píldora redonda independiente porque es
una activación binaria, no otra opción del grupo.

### Selector de zona

Setenta y un destinos, búsqueda, agrupaciones y recuentos no son un
desplegable. El selector es un **panel de selección con entidad propia**. Sus
filas son enlaces HTML servidos en el build; JavaScript mejora la navegación
para cambiar de zona sin recarga, pero no crea el catálogo ni sustituye su
semántica.

**No tapa la lista.** En escritorio se presenta centrado sobre el mapa, con
ancho suficiente para leer y comparar nombres y con un fondo atenuado que lo
separa del resto de la aplicación. El rail permanece visible. En móvil ocupa
el ancho disponible bajo la cabecera y se comporta como una pantalla de primer
nivel, que es lo que exige RF-71.

El panel tiene una cabecera explícita: título «Cambiar zona», botón de cierre y
buscador. Se cierra con ese botón, con `Escape` o al pulsar el fondo. La zona
activa se marca con `--signal` y `aria-current`, no solo con una diferencia
sutil de peso.

**Filas alineadas a la izquierda, con recuento a la derecha.** Los nombres
arrancan todos en la misma vertical, como en el resto de la aplicación. A la
derecha, el número de estaciones de esa zona, en monoespaciada y en
`--muted`. Da a la fila su segunda ancla sin competir con el nombre, y no
promete ninguna decisión: solo dice el tamaño de lo que se va a abrir.

Centrar los nombres, que es lo que había, impide que el ojo encuentre un
borde común entre longitudes muy distintas, y hace que la lista se lea como
una nube de palabras en vez de como una lista.

**Nombres en caja de título**, no en las mayúsculas crudas del catálogo. Las
mayúsculas están reservadas a las microetiquetas de 10 px; en filas de
contenido se leen más despacio y estiran las líneas largas.

**El buscador es cabecera fija**, separado de la lista con un filete y una
sombra corta, para que no se lea como el primer elemento de la lista.

**El final de la lista se indica con un degradado**, no confiando en la
barra de desplazamiento del sistema, que es un elemento ajeno al diseño
dentro de un panel que tiene su propio lenguaje.

**Colocación en escritorio: centrado en el espacio del mapa.** No se ancla a
una coordenada fija ni intenta fingir que nace del botón. Lleva borde, sombra y
un fondo de bloqueo translúcido. Su altura se acota al viewport; solo la lista
interior se desplaza.

**Encuadre inicial, sin zona elegida: España entera es visible** — península,
Baleares y Canarias, en su posición geográfica real, sin inset (mismo criterio
que la pastilla provincial de la vista nacional). Antes se abría con un centro
y zoom fijos pensados para escritorio (`CENTRO_INICIAL`/`ZOOM_INICIAL` en
`Mapa.ts`) que en aspectos de pantalla muy anchos o muy estrechos dejaban fuera
Canarias o mostraban de más países lejanos (Luxemburgo, Suiza, Marruecos,
Túnez) sin necesidad: un zoom fijo no se adapta a la proporción real del
contenedor. El encuadre se calcula con los límites geográficos reales del
territorio (`fitBounds`, igual que `encuadrarTodas` al cargar una zona), no con
un centro y zoom adivinados, así que se ajusta solo a cualquier proporción de
pantalla. `ZOOM_ENTRADA_NACIONAL` (el umbral que decide si el mapa muestra
pastillas provinciales o estaciones sueltas) es un concepto distinto y no
cambia: el encuadre inicial queda muy por debajo de ese umbral, así que la
vista nacional sigue siendo la que se ve al entrar.

**El modal no tapa el centro del encuadre.** El centro geométrico de España
entera —con Canarias tirando del cómputo hacia el suroeste— cae en el
Atlántico, no sobre la península: el panel, centrado en el espacio del mapa,
queda así sobre mar abierto en vez de sobre el territorio con más estaciones y
más peso visual. No hace falta descentrar el panel para lograrlo; es
consecuencia directa de encuadrar el territorio real en vez de un punto
central artificial.

**Sin precio.** Se valoró añadir el precio mínimo de cada zona y se
descartó: nadie decide dónde repostar mirando la media de otra provincia, y
un número que no informa ninguna decisión solo ocupa sitio.

El buscador por nombre y el orden del catálogo se conservan tal cual: son
RF-32 y RF-71 y no se tocan.

### Acceso «Hoy»

Las editoriales no forman parte del selector territorial. La cabecera de cada
página de aplicación contiene un control «Hoy» con un panel independiente de
seis enlaces. En escritorio es compacto y se alinea al borde derecho de la
cabecera; en móvil ocupa el ancho disponible bajo ella. Nunca empuja el mapa ni
crea una segunda pantalla por debajo.

Solo un panel de navegación puede estar abierto a la vez. Abrir «Hoy» cierra el
selector territorial y viceversa. Los controles conservan un área de pulsación
de 44 px y anuncian su estado con `aria-expanded` y `aria-controls`.

El panel abierto es una capa modal visual, no una prolongación de la página.
Un velo oscuro semitransparente cubre el contenido que queda detrás tanto sobre
el fondo claro de los documentos editoriales como sobre el mapa de la
aplicación; pulsarlo cierra el panel. El panel se separa además del velo con una
sombra de elevación real, no únicamente con un borde.

En móvil la hoja entra desde el borde inferior con un desplazamiento breve, de
entre 150 y 200 ms, mientras el velo aparece mediante opacidad. La apertura no
debe producir saltos de posición. Con `prefers-reduced-motion: reduce` se elimina
el desplazamiento del panel, pero se conserva el velo porque su función es
separar y dar contraste, no decorar la transición. En escritorio se mantiene el
popover anclado a «Hoy» y el velo conserva la misma función de separación.

RNF-20 sigue rigiendo el comportamiento de teclado: al abrir, el foco entra en
el panel; Escape lo cierra y devuelve el foco a «Hoy». La implementación actual
mantiene esta gestión en el controlador compartido del panel; el velo, la
transición y la elevación son exclusivamente presentacionales.

### La lista es el contenido

No hay pie de página. La lista de estaciones que ya se ve —en el rail en
escritorio, en la hoja en móvil— **es** el contenido servido que indexa
Google. No hay una segunda tabla debajo del mapa repitiendo lo mismo.

La versión anterior sí la tenía, y estaba mal por dos motivos. Duplicaba
información: el rail decía "MÁS BARATAS · 853" y treinta píxeles más abajo
una tabla repetía las mismas estaciones con más columnas. Y colgaba de un
mapa que ocupa toda la pantalla, así que el usuario no tenía forma de saber
que existía salvo desplazándose por accidente.

**La página de aplicación mide una pantalla.** Nada cuelga por debajo del mapa
en la portada ni en las páginas de zona o municipio. En escritorio no hay
desplazamiento de documento; en móvil, la hoja es la única superficie que se
desplaza. Los 71 enlaces territoriales viven dentro del selector de zona y los
seis enlaces editoriales dentro del acceso «Hoy», ambos como paneles
superpuestos de la cabecera; nunca forman un directorio después de `.app`. Los
documentos editoriales viven fuera de la aplicación y se desplazan por
definición; ver [ADR-0019](adr/0019-paginas-editoriales-sin-aplicacion.md) y
[ADR-0020](adr/0020-navegacion-en-paneles-dentro-de-la-aplicacion.md).

El «no hay pie de página» se limita también a la aplicación. Los documentos
editoriales terminan en un pie compartido, compacto y claramente separado del
contenido. Identifica el proyecto y la fuente de datos y ofrece navegación a la
portada y a las demás editoriales publicadas; no repite rankings ni funciona
como un segundo sitemap. Ver RF-107.

**Las seis listas se generan en el build.** El HTML servido contiene las
estaciones ordenadas por cada uno de los seis combustibles. El selector elige
cuál se muestra; las otras cinco siguen en el documento. Son seis números por
estación, datos que ya están en el JSON de provincia.

Con esto hay más texto indexable por página que con la tabla anterior, no
menos: seis precios por estación en vez de uno.

**Cada fila lleva rótulo, dirección y precio.** La dirección va bajo el
rótulo, en el sitio donde antes iba el municipio. En una página de municipio
el municipio es siempre el mismo y esa línea decía lo obvio.

**Los enlaces a otros municipios cierran la lista.** Van al final del propio
rail o de la hoja, después de la última estación, como pastillas: fondo
claro, filete de `--hair`, texto en `--petrol`, sin subrayado, con el precio
mínimo del municipio al lado en monoespaciada. Nunca en el azul ni en el
morado por defecto del navegador.

**Radio único.** `tokens.css` define hoy colores y tipografía pero ningún
radio, así que cada componente se inventa el suyo: las pastillas de
municipio salen casi ovaladas junto a píldoras de precio mucho menos
redondeadas. Se añade un token de radio y lo usan todos.

## Estados de error y vacío

No son un adorno: son la mitad del trabajo en una aplicación que depende de
terceros.

| Situación | Qué se muestra |
|---|---|
| Datos sin cargar | Mensaje con la causa y botón de reintentar. Nunca un spinner infinito. |
| Mapa sin cargar | El hueco del mapa explica qué falló. Lista y tótem siguen funcionando. |
| Ámbito sin ese combustible | La lista muestra «Aquí no hay {combustible}». El mapa muestra «En {zona} no hay {combustible}» y encuadra la zona con todas sus estaciones; el aviso desaparece al navegar manualmente por el mapa. |
| Filtro sin resultados | "Ninguna abierta ahora" con opción de quitar el filtro. |
| Datos de más de 6 h | Aviso discreto con la hora real del dato. |

Los errores no piden perdón y nunca son vagos sobre qué ha pasado. Dicen qué
falló y qué se puede hacer.

## Movimiento

Poco y con motivo.

- Transiciones de color y fondo: 120-130 ms.
- `flyTo` al seleccionar una estación: 650 ms.
- Nada más. Ni entradas escalonadas, ni parallax, ni marcadores que reboten.
- `prefers-reduced-motion: reduce` desactiva todo, incluido el `flyTo`, que pasa
  a `jumpTo`.
- La vista nacional no anima la entrada de sus 52 pastillas. Cambiar combustible
  actualiza texto en los mismos nodos y nunca mueve sus centroides.

## Suelo de calidad

Sin anunciarlo, pero sin excepciones: responsive hasta 360 px, foco de teclado
visible en todos los controles, contraste AA en texto incluidos los precios
sobre su píldora de color, y toda la información disponible sin depender del
color.

## Nomenclatura

Un producto tiene **un solo nombre** en toda la interfaz. Antes de fijar esta
regla convivían tres vocabularios entre pestañas, ficha y documentación; la
tabla siguiente resolvió esa divergencia y es la referencia vigente.

Tabla canónica. Es la única fuente de verdad y no se improvisa en cada
componente:

| Clave interna | Campo del MITECO | Nombre largo | Pestaña |
|---|---|---|---|
| `gasolina95e5` | `Precio Gasolina 95 E5` | Gasolina 95 | `95` |
| `gasoleoA` | `Precio Gasoleo A` | Diésel | `Diésel` |
| `gasolina98e5` | `Precio Gasolina 98 E5` | Gasolina 98 | `98` |
| `gasoleoPremium` | `Precio Gasoleo Premium` | Diésel premium | `Diésel +` |

Se dice **Diésel** y no "Gasóleo A" porque es como lo llama el conductor, que es
la regla de la sección "Voz". Y la pestaña del premium es `Diésel +` y no
`Premium`: "Premium" a secas es ambiguo, porque la 98 también es una gasolina
premium, y el usuario no puede saber a cuál se refiere.

**Esta regla no afecta a las claves territoriales.** RF-76 conserva verbatim
la cadena del catálogo para emparejamientos, identificadores y slugs, sin
traducir ni elegir entre denominaciones. Solo el nombre visible se deriva de
la tabla fija de comunidades y la regla común de artículo final.

### Mayúsculas

El ministerio devuelve rótulos y direcciones en mayúsculas.

- **El rótulo se muestra verbatim**: `GM OIL`, `REPSOL`. Es el cartel de la
  gasolinera y se comporta como tal.
- **La dirección y el municipio se pasan a caja de título**: `Avenida de los
  Huetos, 64, Vitoria-Gasteiz`. Es prosa, no un rótulo, y en mayúsculas se lee
  peor. Las partículas —de, la, del, y— quedan en minúscula.
- **Provincia y municipio usan el nombre visible de RF-76**: `ARABA/ÁLAVA`
  se pinta `Araba/Álava` sin eliminar ninguna denominación, y `CORUÑA (A)` se
  pinta `A Coruña`.

Esta regla sustituyó la mezcla anterior de dirección en mayúsculas y municipio
en caja de título. Código nuevo y revisiones deben conservarla.

### Palabras concretas

- **"Margen derecho"** no se entiende sin contexto. Se dice **"A la derecha de la
  vía"** y **"A la izquierda de la vía"**. Si el campo es `N`, no se muestra nada:
  una etiqueta que dice "sin margen" es ruido.
- **"Litros a repostar"**, nunca "depósito".
- **"no vende"** en minúscula y en gris: indica que esa estación no vende el combustible; no compite.

## Presupuesto de interfaz

Hay más de veinte funciones en el roadmap. **El modo de fallo de este proyecto no
es quedarse corto: es acabar pareciéndose a lo que quería sustituir.** Las webs
llenas de anuncios no empezaron llenas de anuncios; empezaron añadiendo cosas
razonables una a una.

Estas reglas son tan vinculantes como las de color.

**Una pantalla, una pregunta.** La pregunta es "¿dónde reposto?". Todo lo que no
la responda o no la afine se va a un segundo nivel, o no entra.

**Presupuesto de controles siempre visibles: cinco.** Hoy son zona, combustible y
el asa de la hoja. Quedan dos libres. **Cuando se agoten, meter algo nuevo obliga
a sacar otra cosa**, no a apretar más.

El filtro de abiertas no cuenta porque no es un control global: vive en la
cabecera de la lista, que es lo que modifica.

**Revelación progresiva.** Lo que solo tiene sentido una vez elegida una
estación **no vive en la pantalla principal**: vive donde se usa, junto al
cálculo que alimenta. El ejemplo que motivó esta regla era el estepador de
litros a repostar de la ficha; se retiró después porque el ahorro pasó a
calcularse con 50 L fijos en toda la aplicación, sin preferencia de usuario
(RF-25 en `docs/02-requisitos.md`). La regla se queda para lo próximo que
aparezca en ese estrato.

**Ningún número sin origen visible.** Si se muestra un ahorro, se ve respecto a
qué. Si se muestra un coste, se ve de cuántos litros sale. Si un día se mostrase
un precio distinto al de mostrador, tendría que verse el de mostrador al lado.
Un número que no cuadra con el cartel de la gasolinera y no explica por qué
destruye la confianza en todo lo demás, incluidos los números que sí eran
correctos.

**Nada parpadea, nada interrumpe, nada reaparece.** Sin ventanas modales, sin
banners que vuelvan, sin insistir con permisos, sin "¿te gusta la app?". Una sola
excepción: el aviso de datos con más de 6 horas de antigüedad, porque afecta a la
veracidad de lo que se está mostrando.

**Cada función nueva paga su peso.** Antes de añadir nada, la pregunta es qué
control desaparece o qué se mueve a un segundo nivel. Si la respuesta es "nada,
cabe", es que no se ha mirado en un móvil de 360 px.

## Presupuesto de interfaz · detalle

Esta sección existe porque hay muchas más funciones pensadas que sitio en la
pantalla, y porque la primera versión móvil ya se rompió por acumular controles
sin preguntarse dónde iban. **Es vinculante.**

### La prueba de los cinco segundos

El listón del producto es: de abrir la web a saber dónde repostar, **menos de
cinco segundos y sin tocar más de un control**.

Cualquier función que empeore ese número no entra, por muy buena que sea. Si una
función es valiosa pero estorba, la respuesta correcta no es "la metemos más
pequeña": es ponerla donde solo la encuentre quien la busca.

### Dónde vive cada cosa

Hay tres estratos y no se mezclan.

**Estrato 1 — siempre visible.** Solo lo que se toca en casi todas las visitas:
selector de combustible, filtro de abiertas, selector de zona. **Está lleno. No
cabe nada más.** Meter algo aquí obliga a sacar otra cosa y a justificarlo.

**Estrato 2 — dentro de la ficha de estación.** Lo que solo tiene sentido con una
estación delante: coste total, ahorro, cómo llegar, lado de la carretera,
horario.

**Estrato 3 — ajustes.** Lo que se configura una vez y luego se olvida: mostrar u
ocultar las de venta restringida. Se llega desde un único acceso discreto en la
barra superior. Favoritos no entra: ADR-0023 descarta una colección cuya
persistencia no puede garantizarse entre dispositivos.

El error que ya cometimos: el selector de litros estaba en el estrato 1 comiendo
95 px permanentes cuando pertenecía al 2. El propio selector se retiró después
del estrato 2 también: ver la nota de "Revelación progresiva" más arriba.

### El precio de pantalla es el precio del cartel

La aplicación muestra el precio que publica el ministerio y nada más. Si el
usuario ve 1,549 aquí, en el surtidor pone 1,549.

Esto no es una limitación: **es la propiedad que sostiene la confianza en todo lo
demás.** La primera vez que alguien vea un número en la pantalla y otro distinto
en la calle sin entender por qué, deja de fiarse también de los que sí eran
correctos.

Por eso se descartaron los descuentos por marca
([ADR-0009](adr/0009-descuentos-en-el-dispositivo.md)): además de aportar poco,
habrían roto esta propiedad a cambio de un euro por depósito.

Cualquier función futura que muestre un precio distinto al de mostrador tiene que
enseñar el de mostrador al lado, siempre, sin que haya que pulsar nada.

### Reglas de crecimiento

- **Ningún control nuevo en la cabecera.** Está cerrada.
- **Ninguna función nueva añade un paso** al camino de abrir, ver y decidir.
- **Nada de ventanas modales al cargar.** Ni tutorial, ni aviso, ni petición de
  permisos, ni invitación a instalar.
- **Nada flotante que tape el mapa** salvo la hoja inferior.
- Toda función de la v2 tiene que declarar en qué estrato vive **antes** de
  implementarse. Si no cabe en ninguno, no entra.
- Una etiqueta etiqueta y ya. Nada hace dos trabajos a la vez.

### Cuando llegue la v2

Las funciones de la v2 tienen sitio asignado desde ya, para que nadie improvise:

| Función | Estrato |
|---|---|
| Páginas editoriales automáticas | Fuera de la aplicación |
| Vista nacional por provincias | Mapa, sustituyendo estaciones y racimos por debajo del umbral; no añade controles |
| Indicio de cambio histórico | 2, junto al precio, siempre con magnitud y periodo |
| Evolución completa | Hoy, fuera de la aplicación; la ficha solo muestra un indicio compacto |
| "¿Lleno hoy o el martes?" | Página de zona, fuera de la aplicación de mapa |
| Filtro por carretera | 1, **sustituyendo** al filtro de abiertas en un menú de filtros |
| Tiempo sin variación observada | 2, como dato neutral en la ficha |

### Lenguaje visual de Evolución

Evolución debe sentirse construida con el mismo sistema que la aplicación, no
como un producto de analítica incrustado. Reutiliza tokens, tipografía tabular,
nombres canónicos, radios y reglas de contraste. Su riqueza viene de la
composición y de la precisión de los datos, no de añadir una paleta o una
colección de tarjetas nuevas.

Cada página tiene una conclusión y una visualización principales. Magnitud,
periodo, unidad, ámbito y origen permanecen visibles; el detalle secundario se
revela después. Una gráfica no se presenta sin la frase que responde ni una
frase sin acceso a los valores que la sostienen.

El indicio de ficha ocupa jerarquía secundaria debajo o junto al precio activo:
cambio con signo, magnitud y periodo más «Ver evolución». Puede llevar una
minigráfica si sobrevive a 360 px sin desplazar las acciones de la ficha. El
histórico nunca reemplaza el precio actual ni añade un control a la cabecera.

Las líneas, áreas y comparaciones usan color con moderación. Rojo y verde no
codifican por sí solos subida y bajada; siempre hay signo, cifra o texto. Toda
animación explica una transición, respeta `prefers-reduced-motion` y puede
eliminarse sin perder información. Ver [08 · Evolución](08-evolucion.md).

#### Comparación de una estación en móvil

La ficha de comparación se apila en una sola columna hasta 760 px. El bloque
«Diferencia respecto a la media provincial» queda debajo de la identidad y el
precio de la estación: no se reserva una segunda columna estrecha que obligue a
partir el rótulo y el ahorro en varias líneas. En esta vista los rótulos largos
se escriben en caja normal, sin espaciado de mayúsculas; las micro-etiquetas solo
se conservan cuando de verdad señalan estructura y disponen de ancho.

Las tres barras no forman tres categorías cromáticas equivalentes:

- **Esta estación** toma exactamente la clasificación relativa de la lista y
  del marcador para la zona y el combustible activos (`barata` o `p1`–`p5`).
  La escala se calcula con todas las estaciones públicas actuales de la zona,
  no solo con las que ya tienen histórico.
- **Media provincial** y **Más cara** usan el mismo neutro apagado. Su etiqueta
  ya explica qué representan y no deben adquirir una banda de precio propia.
- `--signal` no aparece en estas barras. Es chrome, no un color de precio.

Auditoría de contraste de los rellenos sobre `--petrol`: `p1` da 2,52:1 y `p5`
2,05:1, por debajo del 3:1 AA para elementos gráficos; `p2`, `p3` y `p4` dan
respectivamente 3,49:1, 3,49:1 y 3,44:1. La escala no se altera aquí. Las barras
se presentan dentro de una pista `--paper`, que es su superficie adyacente
efectiva y sobre la que todas las bandas pasan 3:1 (`p1` 4,90:1; `p2` 3,54:1;
`p3` 3,54:1; `p4` 3,59:1; `p5` 6,02:1). No deben moverse a una pista oscura sin
resolver antes `p1` y `p5` mediante una decisión de sistema.

El resumen compacto no abrevia la posición como «2.ª de 67» sin sujeto: dice
**«Puesto de esta estación en la provincia: 2 de 67»**. El título del
gráfico nombra las dos series visibles (estación y media provincial, o media y
mínimo provincial cuando no hay estación elegida). En «Movimientos destacados»,
la acción se llama «Ver todas las estaciones» porque abre precisamente esa
lista.
