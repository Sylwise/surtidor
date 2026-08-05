# 06 · Roadmap

Hitos en orden estricto. Cada uno se hace en su rama y se cierra antes de
empezar el siguiente. Cada hito es convertible en un issue tal cual.

El orden no es negociable: **los datos van primero y el mapa va el último**,
justo al revés de como apetece hacerlo. El motivo es que el mapa es la pieza que
más falla y la que menos aporta al principio. Si el proyecto se abandona a mitad,
que sea con algo que funcione.

---

## H1 · Andamiaje

Proyecto Astro con TypeScript. `npm run dev`, `build`, `check` funcionando.
`tokens.css` con todos los tokens de `docs/05-diseno.md`. Nada de contenido
todavía.

**Terminado cuando:** `npm run build` genera un `dist/` con una página en blanco
bien tipada.

---

## H2 · Cliente de la API del MITECO

`scripts/lib/miteco.ts`. Cliente para `FiltroProvincia/{id}`, con cabecera
`Accept: application/json`, timeout de 30 s, 3 reintentos con espera creciente y
comprobación de `ResultadoConsulta === "OK"`.

Esquemas `zod` que validen la forma de la respuesta. **Si la API cambia los
nombres de campo, esto tiene que reventar de forma ruidosa** (RNF-41).

**Terminado cuando:** un script suelto descarga Álava (`01`) y escupe por
consola el número de estaciones.

---

## H3 · Normalizador

`scripts/lib/normalizar.ts`. De la respuesta cruda al contrato definido en
`docs/03-arquitectura.md`.

Casos que hay que cubrir, con pruebas:
- `"1,479"` → `1.479`
- `""` → `null` (**jamás `0`**)
- `"-2,671600"` → `-2.6716`
- claves escapadas `_x0020_` del histórico
- estación sin coordenadas → descartada y contada

**Terminado cuando:** las pruebas del normalizador pasan y ninguna estación de
Álava sale con un precio de `0`.

---

## H4 · Intérprete de horarios

`scripts/lib/horario.ts`. Función `estaAbierta(horario, fecha)`.

Casos con prueba: `L-D: 24H`, `L-V: 06:00-22:00; S: 08:00-14:00`, cierre pasada
medianoche, rango de días que da la vuelta a la semana (`V-L`), campo vacío
(devuelve abierta), campo ininteligible (devuelve abierta).

**Terminado cuando:** las pruebas pasan, incluidos los casos raros.

---

## H5 · Generación de datos

`scripts/descargar-datos.ts`. Recorre las 52 provincias, normaliza y escribe
`public/data/provincias/NN.json` más `public/data/indice.json`, este último con
el catálogo de provincias y el de zonas.

Los identificadores de comunidad autónoma se leen de
`Listados/ComunidadesAutonomas`, nunca se escriben a mano. Las zonas a medida
salen de `scripts/zonas-a-medida.ts`.

Escritura atómica: a fichero temporal y luego renombrar, para que un fallo a
media escritura no deje un JSON roto. Si falla cualquier provincia, sale con
código distinto de cero y no toca nada.

También `scripts/datos-mock.ts` para desarrollar sin salida a internet.

**Terminado cuando:** `npm run data:fetch` genera 52 ficheros válidos y el mayor
pesa menos de 100 KB comprimido (RNF-12).

---

## H6 · Lista, tótem y controles

Toda la interfaz **menos el mapa**. Lista ordenada por precio, tótem con los
cuatro combustibles, selector de combustible, selector de zona, filtro de
abiertas, campo de depósito, cálculo de ahorro, persistencia en `localStorage`.

`src/logica/zona.ts`: carga en paralelo de las provincias de la zona, fusión, y
fallo parcial que muestra lo llegado y avisa de lo que falta (RF-36). Prueba
obligatoria con Euskadi, que son tres provincias.

Escala de color relativa **a la zona completa**, aplicada a las píldoras.

**Terminado cuando:** la aplicación es útil de verdad sin que exista ni una
línea de código de mapa. Este es el hito importante.

---

## H7 · Estados de error y vacío

Los cinco casos de la tabla de `docs/05-diseno.md`. Provocarlos a mano: corta la
red, corrompe un JSON, filtra hasta dejarlo vacío.

**Terminado cuando:** ningún camino de fallo deja la pantalla en blanco ni un
indicador de carga que no se resuelva.

---

## H8 · El mapa

MapLibre como dependencia npm, **nunca por CDN**. Tiles de OpenFreeMap, estilo
`positron`. Marcadores tipo tótem con sus cuatro estados. Sincronía con la lista.
Botón de ubicación, que solo pide permiso al pulsarlo.

Degradación: si MapLibre o los tiles no cargan, el hueco explica el fallo y todo
lo demás sigue vivo.

**Terminado cuando:** funciona con mapa, y sigue funcionando entero con el mapa
bloqueado en las herramientas de desarrollo.

---

## H9 · Despliegue

`.github/workflows/datos.yml` con `schedule` cada dos horas y `push` a `main`.
Descarga, build y `wrangler pages deploy`. Si la descarga falla, el workflow para
antes de desplegar.

**Terminado cuando:** el sitio está en línea, los datos se refrescan solos, y una
caída simulada del ministerio no tumba lo publicado.

---

## H10 · Páginas por zona

`src/pages/[zona]/index.astro`. Una URL por zona, con título y descripción
propios. Es lo que hace que esto aparezca en Google cuando alguien
busca gasolineras baratas en su ciudad, y es la única vía de captación que tiene
un proyecto sin presupuesto.

**Terminado cuando:** las páginas de las 52 provincias, las 19 comunidades y las
zonas a medida se generan estáticas y comparten los mismos datos sin duplicarlos.

---

## Después de la v1

Sin fecha ni compromiso, por orden de valor aparente:

1. Agrupación de marcadores, en cuanto Madrid o Barcelona lo pidan a gritos.
2. Ordenar por distancia con geolocalización concedida.
3. Flecha de tendencia respecto a ayer, usando el endpoint histórico.
4. Enlace de "cómo llegar" a la app de mapas del móvil.
5. PWA con los datos de la última provincia en caché.
6. Puntos de recarga eléctrica, que están en la misma familia de servicios.
