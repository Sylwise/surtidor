# ADR-0006 · Hoja inferior arrastrable en móvil, mapa como capa de fondo

**Fecha:** 2026-08-05 · **Estado:** aceptado

## Contexto

El diseño móvil original (`docs/05-diseno.md`, sección "Distribución") apilaba
cuatro bloques en una columna con `flex-direction: column-reverse`: cabecera
con todos los controles, avisos, lista+tótem (`.rail`, tope `max-height: 47vh`)
y mapa (`min-height: 30vh`). Probado en un móvil real, no funciona: son
presupuestos fijos en `vh`/`px` que no se coordinan entre sí.

- A 360 px de ancho (el mínimo que exige RNF-24) la cabecera con
  zona+combustible+filtro+depósito necesita más líneas de las que caben en el
  hueco que le queda, y como `body` tiene `overflow: hidden` sin válvula de
  escape, algo se recorta en silencio.
- El tótem reserva su cromo completo (fondo `--petrol`, borde de 3 px, padding)
  incluso vacío, y ese espacio nunca vuelve a la lista.
- Cuando sí hay una estación seleccionada, el tótem completo puede consumir
  él solo todo el presupuesto de `.rail`, dejando la lista fuera de la vista.
  Rompe CU-2 ("toca otra, compara"): comparar exige ver lista y ficha a la vez.
- El mapa se lleva un tercio de la pantalla por defecto, pese a que la regla
  dura 2 de `CLAUDE.md` dice que es "un extra, no el cimiento". No hay ninguna
  razón funcional para que reciba presupuesto vertical garantizado antes de
  que el usuario lo pida.

## Decisión

En viewports de hasta 760 px:

1. **El mapa pasa a ser una capa de fondo** (`position: fixed`, todo el alto
   disponible bajo la cabecera), en vez de un participante del `flex` que
   compite por espacio. Deja de tener ningún presupuesto que repartir.
2. **La lista, el tótem y los controles de más uso (combustible, filtro)
   viven en una hoja inferior arrastrable con tres estados:**
   - *Colapsada* (~96 px): solo la manija y los controles rápidos, el mapa
     se ve casi entero.
   - *Media* (~50 % de la pantalla, estado por defecto): la lista, varias
     filas visibles.
   - *Completa* (~88 % de la pantalla): lista larga o ficha sin recortes.
3. El estado de la hoja es **puramente de interfaz**: no entra en
   `src/logica/estado.ts` ni en `localStorage` (regla dura 4 de `CLAUDE.md`).
   Se autoexpande a "media" cuando se selecciona una estación estando
   colapsada, para que la ficha se vea sin gesto adicional.
4. El botón de zona y el campo de depósito (se tocan poco: una vez por
   sesión) se quedan en la cabecera superior, fina y fija. El selector de
   combustible y el filtro "solo abiertas" (se tocan mucho, RF-30/RF-31) se
   mueven a la cabecera de la propia hoja, siempre visibles en los tres
   estados — también en escritorio, donde quedan como una barra fija encima
   de la lista en vez de en la cabecera superior.

En escritorio (más de 760 px) el cambio es solo el punto 4: la hoja se
comporta exactamente como el antiguo `.rail` de ancho fijo, sin arrastre ni
estados.

## Motivos

Es el patrón que usan Google Maps, Citymapper o Airbnb en su vista de mapa:
el mapa nunca compite por espacio con la lista, y el usuario decide cuánto
sitio le da a cada uno con un gesto que ya conoce. Encaja con la propia
descripción de `docs/05-diseno.md` ("el mapa ocupa arriba y el rail pasa a
hoja inferior") — no es un enfoque nuevo, es la misma idea llevada a un
mecanismo que sí reparte el espacio en función de lo que hace falta ver en
cada momento, no de un porcentaje fijo decidido de antemano.

Sin librerías nuevas: el arrastre se implementa con `pointer events` nativos
(`src/componentes/Hoja.ts`), coherente con la regla dura 5 de `CLAUDE.md` y
la lista de dependencias permitidas de `docs/03-arquitectura.md`.

## Consecuencias

Buenas: el mapa aprovecha toda la pantalla quieta cuando no hace falta la
lista, la lista aprovecha toda la pantalla cuando el mapa no aporta nada
nuevo, y el usuario decide el reparto con un gesto en vez de sufrir uno fijo
que nunca le viene bien. El tótem vacío deja de robar espacio permanente
(`.totem--vacio` colapsa su propio padding).

Malas: hay que mantener JS de gestos (arrastre + teclado + snapping a
estado) donde antes bastaba con CSS. El mapa en `position: fixed` necesita
que la cabecera le comunique su alto real (variable CSS actualizada por
`ResizeObserver`, no un valor fijo adivinado) para no dejar un hueco o tapar
contenido si la cabecera cambia de alto por wrap de texto.

Vigilar: la manija tiene que seguir siendo operable por teclado (RNF-20) y
no solo por gesto; y el cuerpo scrollable de la lista necesita
`touch-action: pan-y` y `overscroll-behavior: contain` para que el scroll de
la lista y el arrastre de la hoja no se disputen el mismo gesto táctil.

## Alternativas descartadas

- **Pestañas "Mapa" / "Lista" a pantalla completa.** Más simple de
  implementar (sin gestos), pero obliga a un toque extra para ver el mapa
  aunque no se necesite casi nunca, y no resuelve por sí solo dónde vive la
  ficha de detalle sin taparla ni sin un tercer estado.
- **Ficha como overlay/modal puro, sin hoja arrastrable.** Resuelve que la
  ficha no tape la lista, pero no resuelve el reparto de espacio entre mapa
  y lista, que es el problema de fondo.
- **Ajustar los porcentajes `vh` actuales en vez de un mecanismo nuevo.** Ya
  se intentó en la práctica (47vh/30vh) y no sobrevive a 360 px de ancho ni
  a una ficha de estación completa; el problema no es la cifra, es que sea
  fija.

Supersede parcialmente la sección "Distribución > Móvil" de
`docs/05-diseno.md`, que se reescribe tras aceptar este ADR.
