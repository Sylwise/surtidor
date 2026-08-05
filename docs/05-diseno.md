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

  /* El tótem encendido: la más barata */
  --signal: #7ED957;

  --mono: ui-monospace,"SF Mono",SFMono-Regular,"Roboto Mono",Menlo,Consolas,monospace;
  --sans: system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",sans-serif;
}
```

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

**Móvil** (ver [ADR-0006](adr/0006-hoja-inferior-movil.md))

```
┌────────────────────────────────────┐
│ Surtidor · ÁLAVA          Depósito │  ← cabecera fina y fija
├────────────────────────────────────┤
│                                     │
│           MAPA (positron)          │  ← capa de fondo, fixed,
│         tótems con el precio       │    todo el alto disponible
│                                     │
│  ╭───────────────────────────────╮ │
│  │        ▔▔▔▔▔ (asa)            │ │  ← hoja: arrastrable,
│  │ [95][Diésel][98][Premium]     │ │    3 estados
│  │ ◯ Solo abiertas ahora         │ │
│  │ ───────────────────────────── │ │
│  │ MÁS BARATAS                   │ │
│  │ 1 Ballenoil          1,409    │ │
│  │ 2 Plenoil            1,419    │ │
│  ╰───────────────────────────────╯ │
└────────────────────────────────────┘
```

El mapa deja de repartir espacio con nadie: es una capa de fondo a pantalla
completa por debajo de la cabecera. Encima flota la **hoja inferior**, con
tres estados que el usuario cambia arrastrando la asa (o con el teclado,
RNF-20):

- **Colapsada** (~96 px): solo la asa y los controles de más uso —
  combustible y filtro, que son los que se tocan en cada consulta (RF-30,
  RF-31) y por eso viven en la cabecera de la propia hoja, no en la
  superior. El mapa se ve casi entero.
- **Media** (~50 % de la pantalla, estado por defecto): la lista, varias
  filas visibles de un vistazo.
- **Completa** (~88 % de la pantalla): lista larga, o la ficha de una
  estación sin recortarse.

Al tocar una estación estando la hoja colapsada, sube sola a "media": la
ficha nunca se queda escondida detrás de un gesto extra. El botón de zona y
el campo de depósito, que se tocan una vez por sesión, se quedan en la
cabecera superior fina y fija; no reclaman sitio de la hoja.

El estado de la hoja es solo de interfaz — no se guarda en `localStorage` ni
en el estado de la aplicación, se reinicia a "media" en cada visita.

La leyenda se oculta en móvil: no hay sitio y el precio va escrito.

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
- **más barata** — fondo `--signal`, texto oscuro, un punto más grande, con halo
- **cerrada** — opacidad 42 %, nunca oculta
- **seleccionada** — contorno de 2,5 px en `--petrol`

### Lista

Número de orden en mono a la izquierda, rótulo y municipio en el centro, precio
en píldora de color a la derecha. La píldora usa la misma banda que el marcador,
para que lista y mapa hablen el mismo idioma cromático.

### Selector de combustible

Pestañas, nunca desplegable. Cuatro opciones caben. Un toque, no dos.

### Campo de depósito

Nunca el `<input type="number">` a pelo con las flechas nativas del
navegador — se ven ajenas al resto de la interfaz. Un estepador propio:
botones `−`/`+` a los lados (40×40 px, área táctil de sobra para RNF-24),
el número en el centro con la misma monoespaciada tabular que los precios
(`.precio`), sufijo "L" en micro-etiqueta. Pasos de 5 en 5: nadie ajusta el
depósito litro a litro.

### Interruptor "solo abiertas ahora"

Nunca el checkbox del sistema operativo. Una pastilla deslizante: apagada,
fondo `--paper` con borde `--hair`; encendida, fondo `--signal` con el pomo
en `--petrol` — el mismo lenguaje de "esto está encendido" que ya usa el
tótem de la más barata. El `<input>` real sigue ahí, oculto mas no
inaccesible (nunca `display:none`), para que el teclado y los lectores de
pantalla lo sigan viendo como lo que es.

### Barra de scroll de la lista

Fina y del color de la paleta (`--muted` diluido), nunca la barra por
defecto del sistema. `scrollbar-width: thin` / `scrollbar-color` en
Firefox, `::-webkit-scrollbar` en Chrome y Safari.

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
