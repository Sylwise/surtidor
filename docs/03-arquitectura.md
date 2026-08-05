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
│   ├── zonas-a-medida.ts      # zonas que cruzan fronteras administrativas
│   ├── datos-mock.ts          # genera datos falsos para desarrollo sin red
│   └── lib/
│       ├── miteco.ts          # cliente de la API y esquemas zod
│       ├── normalizar.ts      # String con coma → number | null
│       └── horario.ts         # intérprete del campo Horario
├── src/
│   ├── pages/
│   │   ├── index.astro                # redirige a la última zona o la elige
│   │   └── [zona]/index.astro         # una página por zona, para SEO
│   ├── componentes/
│   │   ├── Mapa.ts            # isla: MapLibre y marcadores
│   │   ├── Totem.ts           # ficha de la estación seleccionada
│   │   ├── Lista.ts           # lista ordenada
│   │   └── Controles.ts       # combustible, filtro, provincia, depósito
│   ├── logica/
│   │   ├── estado.ts          # estado de la aplicación, sin librería
│   │   ├── zona.ts            # carga en paralelo y fusión de provincias
│   │   ├── escala.ts          # percentil → banda de color
│   │   └── ahorro.ts          # cálculo en euros
│   └── estilos/
│       └── tokens.css         # única fuente de verdad del diseño
└── public/
    └── data/
        ├── indice.json        # provincias, nº de estaciones, marca de tiempo
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

`public/data/indice.json` lleva dos catálogos: el de provincias (identificador,
nombre, número de estaciones, precio mínimo por combustible) y el de **zonas**,
para poder pintar el selector sin descargar nada más.

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
    { "id": "euskadi-plus", "nombre": "Euskadi y alrededores",
      "tipo": "medida", "provincias": ["01","48","20","31","09"] }
  ]
}
```

Las zonas de tipo `provincia` y `ccaa` se generan solas desde los catálogos del
ministerio. Las de tipo `medida` se declaran a mano en
`scripts/zonas-a-medida.ts`, porque son juicios sobre cómo se conduce de verdad
y no salen de ningún dato.

Ver [ADR-0005](adr/0005-provincia-unidad-y-zonas.md) para el porqué de separar
almacenamiento y consulta.

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
