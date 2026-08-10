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
| Cloudflare Pages | 500 despliegues/mes, 20.000 ficheros | 12/día ≈ 360/mes; páginas e imágenes se regeneran con los datos | despliegues ajustado y a vigilar; ficheros holgado |
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

Dependencias de ejecución y build actuales: `astro`, `maplibre-gl`, `zod` y
`@resvg/resvg-js` (esta última solo en `scripts/`, nunca en el bundle del
navegador). Herramientas de desarrollo y despliegue: `typescript`,
`@astrojs/check`, `@types/node` y `wrangler`. `package.json` es la fuente de
verdad de versiones y comandos. Cualquier paquete nuevo necesita justificación
en el pull request.

## Estructura del repositorio

```
surtidor/
├── README.md · CLAUDE.md · package.json · astro.config.mjs
├── docs/
│   ├── 01-especificacion.md … 09-investigacion-historico-miteco.md
│   └── adr/
├── .github/workflows/datos.yml # descarga, build y despliegue cada 2 h o al hacer push
├── scripts/
│   ├── descargar-datos.ts      # descarga, normaliza y escribe artefactos
│   ├── datos-mock.ts           # datos falsos para desarrollo sin red
│   ├── comprobar-datos-reales.ts # impide construir o desplegar datos mock
│   ├── generar-imagenes-compartir.ts # imágenes de zona, municipio y editorial
│   ├── probar-miteco.ts        # diagnóstico manual de la fuente
│   └── lib/                    # cliente, normalización, agregados, slugs y contratos
├── src/
│   ├── pages/
│   │   ├── index.astro
│   │   ├── [...zona]/index.astro
│   │   ├── [provincia]/[municipio]/index.astro
│   │   ├── hoy/*.astro         # seis documentos editoriales
│   │   ├── 404.astro
│   │   └── sitemap.xml.ts
│   ├── componentes/            # aplicación, mapa, hoja, navegación y tablas editoriales
│   ├── layouts/DocumentoEditorial.astro
│   ├── logica/                 # estado, zonas, racimos, cercanía y vista nacional
│   ├── estilos/                # tokens, interfaz, mapa y documentos editoriales
│   └── assets/marca.svg
├── datos-build/                # catálogos consumidos solo durante el build
│   ├── municipios.json
│   └── provincias-slugs.json   # residuo de ADR-0010; el código actual no lo consume
├── marca/                      # maestros SVG; no se despliegan directamente
└── public/
    ├── _redirects              # 71 redirecciones exactas de URL antigua
    ├── data/
    │   ├── indice.json
    │   ├── resumen-nacional.json
    │   └── provincias/01.json … 52.json
    ├── og/                     # PNG generados de zona, municipio y editorial
    └── favicon, iconos, manifiesto y robots.txt
```

El árbol enumera las piezas estructurales, no cada prueba ni cada artefacto
generado. Los nombres exactos y la lista completa se consultan en el repositorio;
`public/data/` y `public/og/` cambian al regenerar datos e imágenes.

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
      "tipoVenta": "P",
      "margen": "D",
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
    { "id": "araba-alava", "nombre": "ARABA/ALAVA",
      "tipo": "provincia", "provincias": ["01"] },
    { "id": "pais-vasco", "nombre": "País Vasco",
      "tipo": "ccaa", "provincias": ["01","48","20"] },
    { "id": "andalucia", "nombre": "Andalucía",
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
2. `npm run preparar:historico` — recupera el estado estático anterior, valida
   su manifiesto y SHA-256 e incorpora los días que falten, hasta ayer. La
   reconstrucción de 90 días solo se activa manualmente.
3. `npm run materializar:historico` — publica el estado comprimido y 52
   artefactos provinciales; no crea otro despliegue.
4. `npm run data:fetch` — si falla, **el workflow se detiene aquí**. No se
   despliega nada y el sitio anterior sigue en pie (RF-05).
5. `npm run build`
6. `npm run comprobar:datos` — segunda guarda explícita contra datos mock.
7. `npx wrangler pages deploy dist/ --project-name=surtidor --branch=main`

El workflow serializa todos los disparadores mediante el grupo de concurrencia
`produccion-surtidor`. Un `push` y el cron no pueden publicar en orden inverso.

El token de Cloudflare va en los secretos del repositorio. No hay más secretos:
la API del ministerio es abierta.

## Límites y trabajo pendiente

La agrupación de marcadores ya está implementada: racimos por debajo de zoom 11,
colisiones por encima e identidad estable al desplazar. Ver
[ADR-0006](adr/0006-marcadores-dom-con-colisiones.md) y
[ADR-0021](adr/0021-racimos-estables-al-desplazar-el-mapa.md).

El sitio usa `surtidor.app`; las URL canónicas se construyen con ese dominio en
la configuración de Astro.

El histórico diario está implementado como una ventana cerrada de 90 días. El
estado nacional conserva presencia, territorio diario y los cuatro precios; el
navegador recibe únicamente el artefacto de la provincia consultada. Cada serie
provincial lleva `IDEESS`, municipio actual, presencia y precios. Los nombres y
direcciones se cruzan por `IDEESS` con el contrato actual y no se duplican.

Los artefactos incluyen agregados diarios de municipio y provincia como
`[sumaMilesimas, observaciones, minimoMilesimas]`. La suma se conserva hasta el
cliente para no acumular redondeos. La experiencia está decidida en
[ADR-0023](adr/0023-evolucion-contextual-sin-perfil.md), la persistencia en
[ADR-0024](adr/0024-ventana-historica-en-despliegue.md) y el producto en
[08 · Evolución](08-evolucion.md).
públicos y rotación entre ejecuciones sin introducir un servidor. La retención
de producto ya está fijada en una ventana móvil de 90 días cerrados. No se
añadirá el histórico sin esa decisión: el endpoint disponible no resuelve por
sí solo identidad, almacenamiento ni presupuesto de descarga.

La primera medición confirma instantáneas diarias al menos desde 2007,
`IDEESS` único y unos 0,7 MB comprimidos por respuesta reciente. También muestra
que reconstruir una ventana entera en cada uno de los doce builds diarios sería
trabajo repetido. Ver
[09 · Investigación del histórico](09-investigacion-historico-miteco.md).
