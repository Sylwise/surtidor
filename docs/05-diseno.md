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
Debajo, la cabecera de la lista: `MÁS BARATAS · 72 · [Abiertas]`. Luego las filas.

**El filtro de abiertas no tiene fila propia.** Es una píldora en la cabecera de
la lista, junto al contador que modifica. Una fila entera para un interruptor son
44 px tirados, y además estaba lejos del número al que afecta.

**Estado de ficha.** Las pestañas de combustible **desaparecen**. No porque el
combustible deje de importar —cambia el puesto y cambia el ahorro— sino porque
**la ficha ya lista los cuatro precios**: el mismo control estaría dos veces en
pantalla, y una de ellas con más información que la otra.

En su lugar, **las cuatro filas de combustible de la ficha son pulsables**. Tocar
"Gasolina 98 · 1,769" lo convierte en el combustible activo. Objetivo de
pulsación grande, el precio por delante, y cero controles duplicados. La fila
activa se marca en `--signal`, como ya hace.

Entre las dos cosas se recuperan unos 100 px de 730. Una séptima parte de la
pantalla.

### Cerrar la ficha

Con la ficha abierta queda una franja de mapa visible arriba en la que no se
puede pulsar. Eso no es espacio sobrante: **es el sitio al que todo el mundo va a
ir para cerrar.**

Tres salidas, y las tres valen:

1. **Tocar el mapa** cierra la ficha y vuelve al estado de lista.
2. **Arrastrar la hoja hacia abajo** hasta la posición asomada.
3. **Una X** en la esquina de la ficha, para quien no descubra las otras dos.

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
blanco. "no vende" en gris al 28 % y un cuerpo menor, porque es ausencia de dato
y no debe competir.

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

### Lista

Número de orden en mono a la izquierda, rótulo y municipio en el centro, precio
en píldora de color a la derecha. La píldora usa la misma banda que el marcador,
para que lista y mapa hablen el mismo idioma cromático.

### Selector de combustible

Pestañas, nunca desplegable. Cuatro opciones caben. Un toque, no dos.

### La lista es el contenido

No hay pie de página. La lista de estaciones que ya se ve —en el rail en
escritorio, en la hoja en móvil— **es** el contenido servido que indexa
Google. No hay una segunda tabla debajo del mapa repitiendo lo mismo.

La versión anterior sí la tenía, y estaba mal por dos motivos. Duplicaba
información: el rail decía "MÁS BARATAS · 853" y treinta píxeles más abajo
una tabla repetía las mismas estaciones con más columnas. Y colgaba de un
mapa que ocupa toda la pantalla, así que el usuario no tenía forma de saber
que existía salvo desplazándose por accidente.

**La página mide una pantalla.** Nada cuelga por debajo del mapa. En
escritorio no hay desplazamiento de documento; en móvil, la hoja es la única
superficie que se desplaza.

**Las cuatro listas se generan en el build.** El HTML servido contiene las
estaciones ordenadas por cada uno de los cuatro combustibles. Las pastillas
de combustible eligen cuál se muestra; las otras tres siguen en el documento.
Son cuatro números por estación, datos que ya están en el JSON de provincia.

Con esto hay más texto indexable por página que con la tabla anterior, no
menos: cuatro precios por estación en vez de uno.

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
| Provincia sin ese combustible | "Ninguna estación de {provincia} vende {combustible}." Y se sugiere cambiar. |
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

## Suelo de calidad

Sin anunciarlo, pero sin excepciones: responsive hasta 360 px, foco de teclado
visible en todos los controles, contraste AA en texto incluidos los precios
sobre su píldora de color, y toda la información disponible sin depender del
color.

## Nomenclatura

Un producto tiene **un solo nombre** en toda la interfaz. Ahora mismo hay tres
vocabularios conviviendo: las pestañas dicen "Diésel" y "Premium", las filas de
la ficha dicen "Diésel" y "Diésel premium", y estos documentos decían "Gasóleo A"
y "Gasóleo Premium".

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

**Esta regla no afecta a los nombres de territorio.** RF-76 obliga a mostrar
provincias y comunidades tal como las nombra el catálogo del ministerio, sin
traducir ni acortar. Los combustibles son producto, no territorio.

### Mayúsculas

El ministerio devuelve rótulos y direcciones en mayúsculas.

- **El rótulo se muestra verbatim**: `GM OIL`, `REPSOL`. Es el cartel de la
  gasolinera y se comporta como tal.
- **La dirección y el municipio se pasan a caja de título**: `Avenida de los
  Huetos, 64, Vitoria-Gasteiz`. Es prosa, no un rótulo, y en mayúsculas se lee
  peor. Las partículas —de, la, del, y— quedan en minúscula.
- **La provincia, verbatim** (RF-76): `ARABA/ALAVA`.

Hoy conviven en la misma línea la dirección en mayúsculas y el municipio en caja
de título. Eso es lo que hay que unificar.

### Palabras concretas

- **"Margen derecho"** no se entiende sin contexto. Se dice **"A la derecha de la
  vía"** y **"A la izquierda de la vía"**. Si el campo es `N`, no se muestra nada:
  una etiqueta que dice "sin margen" es ruido.
- **"Litros a repostar"**, nunca "depósito".
- **"no vende"** en minúscula y en gris: es ausencia de dato, no compite.

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

**Revelación progresiva.** Las preferencias que se configuran una vez —litros
habituales, y más adelante el consumo del vehículo— **no viven en la pantalla
principal**. Viven donde se usan: en la ficha, junto al cálculo que alimentan.

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
estación delante: litros a repostar, coste total, ahorro, cómo llegar, lado de la
carretera, horario.

**Estrato 3 — ajustes.** Lo que se configura una vez y luego se olvida: mostrar u
ocultar las de venta restringida y, cuando lleguen, el perfil de vehículo y los
favoritos. Se llega desde un único acceso
discreto en la barra superior.

El error que ya cometimos: el selector de litros estaba en el estrato 1 comiendo
95 px permanentes cuando pertenece al 2.

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
| Tendencia respecto a ayer | 2, junto al precio |
| "¿Lleno hoy o el martes?" | Página de zona, fuera de la aplicación de mapa |
| Perfil de vehículo | 3 |
| Coste del desvío | 2, dentro del bloque de ahorro |
| Filtro por carretera | 1, **sustituyendo** al filtro de abiertas en un menú de filtros |
| Precio congelado | 2, como distintivo en la ficha |
| Favoritos | 2 para marcar, lista para ver |
