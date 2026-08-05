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

## Voz

Español, tuteo, frases cortas. Nombra las cosas como las llama el conductor:
"gasolina 95", no "producto 1". "Mi depósito", no "capacidad del tanque".

Una etiqueta etiqueta y ya. Nada hace dos trabajos a la vez.
