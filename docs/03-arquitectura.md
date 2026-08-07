# 03 · Arquitectura

## La idea de fondo

Esta aplicación no tiene usuarios que escriban nada. Los datos son públicos,
idénticos para todo el mundo y de solo lectura. Eso significa que **no hace
falta un servidor**, y por eso puede salir gratis de verdad.

Todo el trabajo se hace una vez cada dos horas, fuera del camino del usuario. El
navegador solo descarga ficheros ya masticados desde un CDN.

## Flujo de datos

```
        cada 2 horas
             │
             ▼
   ┌───────────────────┐
   │  GitHub Actions   │   1. GET a la API del MITECO (52 provincias)
   │  (runner efímero) │   2. Normaliza: comas a puntos, vacíos a null
   │                   │   3. Valida: si algo huele mal, aborta
   │                   │   4. Escribe public/data/provincias/NN.json
   │                   │   5. Construye el sitio
   │                   │   6. Despliega
   └─────────┬─────────┘
             │
             ▼
   ┌───────────────────┐
   │ Cloudflare Pages  │   HTML + JS + 52 JSON, servidos desde el CDN
   └─────────┬─────────┘
             │
             ▼
   ┌───────────────────┐
   │    Navegador      │   Descarga SOLO los JSON de su zona (~30-80 KB c/u,
   │                   │   en paralelo) y los fusiona en memoria
   │                   │   MapLibre pide tiles a OpenFreeMap
   └───────────────────┘
```

Sin base de datos. Sin API propia. Sin contenedor encendido. La pieza más cara
del sistema es un runner de GitHub que vive noventa segundos y se muere.

## Por qué no un Worker con cron

Era la alternativa obvia y se descartó por un límite concreto: **el plan
gratuito de Cloudflare Workers da 10 ms de CPU por invocación**. Parsear y
normalizar los datos de las 11.500 estaciones de España se come eso muchas veces
antes de terminar. El tiempo de espera de red no cuenta, pero el `JSON.parse` y
el recorrido sí.

GitHub Actions no tiene ese problema: la CPU es del runner y en repositorios
públicos los minutos son ilimitados. El trabajo pesado va donde la CPU es
gratis. Ver [ADR-0001](adr/0001-sin-backend.md).

## Límites gratuitos y márgenes

Verificar estas cifras antes de tocar la cadencia, porque cambian.

| Servicio | Límite gratuito | Uso previsto | Margen |
|---|---|---|---|
| GitHub Actions (repo público) | minutos ilimitados | 12 ejecuciones/día × ~2 min | holgado |
| Cloudflare Pages | 500 despliegues/mes, 20.000 ficheros | 12/día ≈ 360/mes, ~2.400 ficheros (1161 páginas + 1160 `og/*.png`, H11) | despliegues ajustado y a vigilar; ficheros holgado |
| Cloudflare Pages | ancho de banda ilimitado | — | sin problema |
| OpenFreeMap | sin límite de peticiones ni registro | tiles del mapa | sin problema |
| API MITECO | sin límite publicado | 52 peticiones cada 2 h | sin problema |

**El número que aprieta son los 500 despliegues al mes de Pages.** Cada dos
horas son 360, que deja margen para unos 140 despliegues de código al mes. Si
alguna vez hace falta más frecuencia de datos, hay que mover los JSON a R2 o KV
y dejar Pages solo para el código. No antes.

## Stack

| Capa | Elección | Motivo |
|---|---|---|
| Framework | Astro | Genera HTML estático de verdad, con islas de JS solo donde hacen falta. Permite una página por provincia, que es lo que hace que Google encuentre esto. |
| Lenguaje | TypeScript | Los datos del ministerio son un campo de minas de tipos. Merece la pena. |
| Mapa | MapLibre GL JS | Código abierto, sin clave, tiles vectoriales. |
| Tiles | OpenFreeMap, estilo `positron` | Sin registro, sin clave, sin límite. Pálido a propósito. |
| Estilos | CSS plano con custom properties | El diseño es pequeño y específico. Un framework de utilidades sobraría. |
| Datos | Node script + `zod` para validar | Validar en el borde para que un cambio en la API falle ruidosamente. |
| Alojamiento | Cloudflare Pages | Gratis, CDN global, despliegue desde Actions. |
| Programación | GitHub Actions con `schedule` | Gratis en repos públicos. |
| Imagen de compartición | `@resvg/resvg-js`, solo en el build | Rasteriza a PNG un SVG propio (sin motor de layout externo). Corre en Node durante `npm run build`, nunca en el navegador — no cuenta para RNF-11. Ver [ADR-0011](adr/0011-imagen-og-generada-en-build-con-resvg.md). |

Dependencias permitidas: `astro`, `maplibre-gl`, `zod`, `typescript`,
`@resvg/resvg-js` (solo en `scripts/`, nunca en el bundle del navegador).
Cualquier otra cosa necesita justificación en el pull request.

## Estructura del repositorio

```
surtidor/
├── CLAUDE.md
├── README.md
├── astro.config.mjs
├── package.json
├── docs/
│   ├── 01-especificacion.md
│   ├── 02-requisitos.md
│   ├── 03-arquitectura.md
│   ├── 04-fuente-datos.md
│   ├── 05-diseno.md
│   ├── 06-roadmap.md
│   └── adr/
├── .github/workflows/
│   └── datos.yml              # cron cada 2 h: descarga, construye, despliega
├── scripts/
│   ├── descargar-datos.ts     # llama al MITECO, normaliza, escribe JSON
│   ├── datos-mock.ts          # genera datos falsos para desarrollo sin red
│   ├── generar-imagenes-compartir.ts # RF-66 (H11): og:image por zona y municipio (ADR-0011)
│   └── lib/
│       ├── miteco.ts          # cliente de la API y esquemas zod
│       ├── normalizar.ts      # String con coma → number | null
│       ├── horario.ts         # intérprete del campo Horario
│       ├── municipios.ts      # cruza estaciones reales con Listados/Municipios
│       ├── slug.ts            # nombre del catálogo → tramo de URL, sin colisiones
│       └── fuentes/           # Inter y JetBrains Mono (OFL), solo para el build de imágenes
├── src/
│   ├── pages/
│   │   ├── index.astro                        # redirige a la última zona o la elige
│   │   ├── [zona]/index.astro                 # una página por zona, para SEO
│   │   ├── [provincia]/[municipio]/index.astro # una página por municipio (H10)
│   │   ├── 404.astro                          # 404 real; municipio sin página cae aquí (ADR-0012)
│   │   └── sitemap.xml.ts                     # RF-64, regenerado en cada build
│   ├── componentes/
│   │   ├── AppInteractiva.astro # cascarón interactivo, compartido por zona y municipio
│   │   ├── Mapa.ts             # isla: MapLibre y marcadores
│   │   ├── Totem.ts            # ficha de la estación seleccionada
│   │   ├── Lista.ts            # lista ordenada
│   │   └── Controles.ts        # combustible, filtro, provincia, depósito
│   ├── logica/
│   │   ├── estado.ts          # estado de la aplicación, sin librería
│   │   ├── zona.ts            # carga en paralelo y fusión de provincias
│   │   ├── escala.ts          # percentil → banda de color
│   │   └── ahorro.ts          # cálculo en euros
│   └── estilos/
│       └── tokens.css         # única fuente de verdad del diseño
├── datos-build/
│   └── municipios.json         # catálogo de municipios (H10). NO se despliega, ver más abajo
└── public/
    ├── data/
    │   ├── indice.json         # provincias, zonas, marca de tiempo — lo pide el navegador
    │   └── provincias/
    │       └── 01.json … 52.json
    └── og/                     # RF-66 (H11): un PNG 1200×630 por zona y por municipio
        ├── p-01.png … ccaa-19.png
        └── {provincia}/{municipio}.png
```

## Contrato de los ficheros de datos

`public/data/provincias/NN.json`:

```json
{
  "provincia": { "id": "01", "nombre": "ARABA/ALAVA" },
  "actualizado": "2026-08-05T09:00:00Z",
  "fechaMiteco": "05/08/2026 11:00:00",
  "estaciones": [
    {
      "id": "1234",
      "rotulo": "BALLENOIL",
      "direccion": "PORTAL DE GAMARRA 42",
      "municipio": "VITORIA-GASTEIZ",
      "cp": "01013",
      "lat": 42.8695,
      "lon": -2.6716,
      "horario": "L-D: 24H",
      "precios": {
        "gasolina95e5": 1.409,
        "gasoleoA": 1.489,
        "gasolina98e5": null,
        "gasoleoPremium": null
      }
    }
  ]
}
```

Reglas del contrato, y son estrictas:

- `null` significa "no vende este producto". **Nunca `0`, nunca `""`.**
- `lat` y `lon` son números con punto decimal, en WGS84.
- Las claves de `precios` son camelCase estable, **no** los nombres de campo del
  ministerio. El acoplamiento a la API se queda encerrado en `scripts/lib/`.
- Si una estación no tiene coordenadas válidas, se descarta y se cuenta en el log.

`public/data/indice.json` lleva dos catálogos: el de provincias (identificador,
nombre, número de estaciones, precio mínimo por combustible) y el de **zonas**,
para poder pintar el selector sin descargar nada más. Es el único fichero de
`public/data/` que pide el navegador en **todas** las páginas, así que no
lleva nada que el selector no use — ver el catálogo de municipios más abajo,
que deliberadamente no está aquí.

```json
{
  "actualizado": "2026-08-05T09:00:00Z",
  "provincias": [
    { "id": "01", "nombre": "ARABA/ALAVA", "estaciones": 91,
      "minimos": { "gasolina95e5": 1.409 } }
  ],
  "zonas": [
    { "id": "p-01", "nombre": "Álava",
      "tipo": "provincia", "provincias": ["01"] },
    { "id": "ccaa-16", "nombre": "Euskadi",
      "tipo": "ccaa", "provincias": ["01","48","20"] },
    { "id": "ccaa-01", "nombre": "ANDALUCIA",
      "tipo": "ccaa", "provincias": ["04","11","14","18","21","23","29","41"] }
  ]
}
```

**Los dos catálogos se generan solos**, desde los catálogos del
ministerio: 52 provincias y 19 comunidades, 71 zonas en total.

No hay zonas definidas a mano ni agrupaciones calculadas, y no las va a haber: cualquier lista de
agrupaciones escogidas es una sucesión de juicios editoriales que hay que
defender uno a uno. Ver la corrección al final de
[ADR-0005](adr/0005-provincia-unidad-y-zonas.md).

**Los nombres se toman del catálogo del ministerio, verbatim.** Si dice
`ARABA/ALAVA`, eso se muestra. El proyecto no traduce, no acorta y no elige entre
denominaciones.

Ver [ADR-0005](adr/0005-provincia-unidad-y-zonas.md) para el porqué de separar
almacenamiento y consulta.

### Municipios (H10): `datos-build/municipios.json`, fuera de `public/`

El catálogo de municipios sale de cruzar `Listados/Municipios` del ministerio
con las estaciones reales de cada provincia (`scripts/lib/municipios.ts`):
lleva **todos** los municipios con al menos una estación visible, no solo los
que tienen página propia. Quien decide si un municipio se genera es cada
consumidor —`getStaticPaths` de `src/pages/[provincia]/[municipio]/index.astro`,
`src/pages/sitemap.xml.ts`— comparando `estaciones` contra
`MINIMO_ESTACIONES_MUNICIPIO` (RF-60, `scripts/lib/tipos.ts`), no el propio
catálogo.

```json
{
  "actualizado": "2026-08-06T22:24:29.513Z",
  "municipios": [
    { "nombre": "Vitoria-Gasteiz", "provinciaId": "01", "estaciones": 39 }
  ]
}
```

Vive en `datos-build/municipios.json`, **no** en `public/data/`: es el único
catálogo de todo H10 que ningún código de navegador pide jamás, solo lo leen
`getStaticPaths` y `sitemap.xml.ts` en el build (los dos vía `process.cwd()`,
no `import.meta.dirname` — ver el comentario en esos ficheros). Estar fuera de
`public/` no es un detalle: significa que Astro nunca lo copia a `dist/`, así
que no hay manera de que un `fetch` desde el cliente llegue a pedirlo, ni por
error ni por URL adivinada.

La primera versión de H10 lo guardaba dentro de `indice.json`, siguiendo al
pie de la letra un encargo que decía "guarda en indice.json el municipio, su
provincia y su número de estaciones". Medido con datos reales: añadía **28 KB
comprimidos** a un fichero que antes pesaba 3,4 KB comprimidos — casi 10
veces más — y que el navegador descarga en las 1161 páginas del sitio para
pintar un selector de zona que no usa el catálogo de municipios para nada.
Se corrigió sacándolo de `indice.json` en cuanto se midió el coste real; no
es una salida pendiente, es lo que hay hoy.

Los slugs de URL (`/{provincia}/{municipio}/`) no se guardan en ningún
fichero: se calculan siempre con `scripts/lib/slug.ts` a partir de `nombre`,
en el mismo sitio donde hacen falta. `scripts/descargar-datos.ts` comprueba
antes de escribir nada que dos provincias, o dos municipios de la misma
provincia, no generen el mismo slug (`comprobarSlugsUnicos`): una colisión
aborta la generación entera, igual que un fallo de red (RF-05).

### Municipio sin página (RF-60): 404, no redirección

Un municipio por debajo de `MINIMO_ESTACIONES_MUNICIPIO` no tiene página
propia. Esa URL no la enlaza ninguna página del sitio (ni la tabla de zona
ni el resumen de municipio enlazan por debajo del mínimo), así que quien
llega ahí lo hace por un enlace externo o un typo: **da un 404 real**
(`src/pages/404.astro`), con los tokens de marca y un enlace de vuelta al
selector de zona.

No siempre fue así. Se probaron, por este orden, un comodín en
`_redirects`, una Cloudflare Pages Function, y unas reglas estáticas en
`_redirects` — los tres verificados y descartados con datos reales, no
por lectura de documentación. La cadena completa, con lo que falló de cada
uno y por qué, está en [ADR-0012](adr/0012-municipio-sin-pagina-404.md)
(supera a [ADR-0010](adr/0010-redireccion-municipio-con-pages-function.md)).
Resumen: el comodín se comía las páginas reales porque Cloudflare aplica
los redirects antes de mirar si existe el asset; la Pages Function lo
arreglaba pero se invocaba en **todas** las peticiones que casan su ruta,
también en las 1.089 páginas de municipio reales que traen el tráfico —
gastaba cuota de Workers en el camino caliente para proteger un camino frío
que nadie visita; y las 2.178 reglas estáticas que habría hecho falta para
redirigir cada municipio sin página superan el límite de Cloudflare
(2.000), que descarta las últimas en silencio en vez de fallar. Sin ninguna
salida limpia, la respuesta que queda es la más simple: 404.

## Despliegue

Un único workflow, `datos.yml`, con dos disparadores: `schedule` cada dos horas
y `push` a `main`. Pasos:

1. `npm ci`
2. `npm run data:fetch` — si falla, **el workflow se detiene aquí**. No se
   despliega nada y el sitio anterior sigue en pie (RF-05).
3. `npm run build`
4. `wrangler pages deploy dist/`

El token de Cloudflare va en los secretos del repositorio. No hay más secretos:
la API del ministerio es abierta.

## Lo que hay que decidir cuando toque

- **Agrupación de marcadores.** A partir de unas 300 estaciones en pantalla
  (Madrid, Barcelona) hace falta. No se implementa hasta que se vea el problema
  con datos reales.
- **Histórico.** El endpoint `EstacionesTerrestresHist/{fecha}` existe. Guardar
  un resumen diario por provincia es barato en espacio, pero es v2.
- **Dominio.** `surtidor.es` o similar. No bloquea nada.
