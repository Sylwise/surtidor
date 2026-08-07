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
| Cloudflare Pages | 500 despliegues/mes, 20.000 ficheros | 12/día ≈ 360/mes, ~60 ficheros | ajustado, vigilar |
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

Dependencias permitidas: `astro`, `maplibre-gl`, `zod`, `typescript`. Cualquier
otra cosa necesita justificación en el pull request.

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
│   └── lib/
│       ├── miteco.ts          # cliente de la API y esquemas zod
│       ├── normalizar.ts      # String con coma → number | null
│       ├── horario.ts         # intérprete del campo Horario
│       ├── municipios.ts      # cruza estaciones reales con Listados/Municipios
│       ├── slug.ts            # nombre del catálogo → tramo de URL, sin colisiones
│       └── redirecciones.ts   # public/_redirects: municipio sin página → su provincia
├── src/
│   ├── pages/
│   │   ├── index.astro                        # redirige a la última zona o la elige
│   │   ├── [zona]/index.astro                 # una página por zona, para SEO
│   │   ├── [provincia]/[municipio]/index.astro # una página por municipio (H10)
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
└── public/
    ├── _redirects              # generado en cada npm run data:fetch (H10)
    └── data/
        ├── indice.json         # provincias, zonas, municipios, marca de tiempo
        └── provincias/
            └── 01.json … 52.json
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

`public/data/indice.json` lleva tres catálogos: el de provincias (identificador,
nombre, número de estaciones, precio mínimo por combustible), el de **zonas**,
para poder pintar el selector sin descargar nada más, y el de **municipios**
(H10, para las páginas de `src/pages/[provincia]/[municipio]/`).

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
  ],
  "municipios": [
    { "nombre": "Vitoria-Gasteiz", "provinciaId": "01", "estaciones": 39 }
  ]
}
```

**Los dos primeros catálogos se generan solos**, desde los catálogos del
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

### Municipios (H10) y el precio de llevarlos en `indice.json`

El catálogo de `municipios` sale de cruzar `Listados/Municipios` del
ministerio con las estaciones reales de cada provincia
(`scripts/lib/municipios.ts`): lleva **todos** los municipios con al menos
una estación visible, no solo los que tienen página propia. Quien decide si
un municipio se genera es cada consumidor —`getStaticPaths` de
`src/pages/[provincia]/[municipio]/index.astro`, `src/pages/sitemap.xml.ts`—
comparando `estaciones` contra `MINIMO_ESTACIONES_MUNICIPIO` (RF-60,
`scripts/lib/tipos.ts`), no el propio catálogo.

Los slugs de URL (`/{provincia}/{municipio}/`) no se guardan aquí: se
calculan siempre con `scripts/lib/slug.ts` a partir de `nombre`, en el mismo
sitio donde hacen falta. `scripts/descargar-datos.ts` comprueba antes de
escribir nada que dos provincias, o dos municipios de la misma provincia, no
generen el mismo slug (`comprobarSlugsUnicos`): una colisión aborta la
generación entera, igual que un fallo de red (RF-05).

**Coste a vigilar:** los ~3.000 municipios con al menos una estación añaden
del orden de 25-30 KB comprimidos a `indice.json`, que el navegador descarga
en **todas** las páginas para pintar el selector de zona (RF-32), aunque el
selector no use el catálogo de municipios para nada. Es una lectura
deliberada de la instrucción que pidió este catálogo "en indice.json": si
esa cifra se convierte en un problema real (medir con datos de producción,
no aquí), la salida es partirlo a un fichero aparte que solo lean los
`getStaticPaths` en el build, nunca el navegador.

### `public/_redirects` (RF-60)

Un municipio por debajo de `MINIMO_ESTACIONES_MUNICIPIO` no tiene página
propia. `scripts/lib/redirecciones.ts` escribe una línea comodín por
provincia —no una por municipio, que serían miles y superarían el límite de
reglas de Cloudflare Pages—: `/{provincia}/*  /p-{id}/  301`. Funciona
porque Cloudflare Pages sirve un fichero estático real antes de mirar
`_redirects` cuando los dos coinciden en la misma ruta: las páginas de
municipio que sí existen nunca llegan a esta regla. **Sin verificar contra
un despliegue real** — es lo primero que comprobar después del primer
`wrangler pages deploy`.

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
