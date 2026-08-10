# 09 · Investigación del histórico del MITECO

**Fecha de la medición:** 2026-08-10

Este documento registra observaciones reproducibles sobre
`EstacionesTerrestresHist/{fecha}`. No decide todavía la arquitectura de V2-01;
reduce las incógnitas que deberá resolver su ADR técnico.

## Resultado principal

El histórico oficial es suficiente para iniciar Evolución sin esperar meses a
construir una base propia. El servicio devuelve una instantánea nacional por día
al menos desde el 1 de enero de 2007, con `IDEESS` único en todas las muestras y
una continuidad alta entre fechas.

No conviene, sin embargo, consultar una ventana completa en cada build. Cada
respuesta reciente ronda 12,4 MB sin comprimir y 0,7 MB con gzip. Reconstruir 30,
90 o 365 días doce veces al día malgasta red, CPU y peticiones a la fuente. La
arquitectura debe hacer una carga inicial de 90 días y mantener después una
ventana móvil con una sola observación nueva al día.

## Cómo se midió

Petición:

```text
GET https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/
    PreciosCarburantes/EstacionesTerrestresHist/DD-MM-AAAA
Accept: application/json
```

Se guardó cada respuesta fuera del repositorio, se contó
`ListaEESSPrecio`, se comprobó la unicidad de `IDEESS` y se compararon conjuntos
de identificadores. Las cifras describen esas respuestas concretas; no son una
garantía contractual del Ministerio.

## Cobertura y volumen observados

| Fecha solicitada | Resultado | Estaciones | Tamaño JSON |
|---|---:|---:|---:|
| 09-08-2026 | OK | 11.523 | 12.405.977 B |
| 03-08-2026 | OK | 11.532 | 12.415.816 B |
| 10-07-2026 | OK | 11.524 | 12.406.630 B |
| 10-05-2026 | OK | 11.408 | 12.282.034 B |
| 10-08-2025 | OK | 11.194 | 12.050.364 B |
| 10-08-2020 | OK | 10.421 | 11.215.358 B |
| 01-01-2015 | OK | 9.238 | 9.949.712 B |
| 01-01-2010 | OK | 8.100 | 8.703.206 B |
| 01-01-2007 | OK | 7.202 | 7.728.978 B |

La respuesta del 9 de agosto ocupa 725.116 B al comprimirla con `gzip -9`. Las
de 2026 medidas quedan alrededor de 0,7 MB comprimidas.

El 1 de enero de 2000 y una fecha futura devolvieron HTTP 400. Una fecha
bisiesta válida, 29-02-2024, devolvió `OK` y 11.139 estaciones. Esto demuestra
que la ruta valida fechas, pero no fija todavía la primera fecha disponible ni
garantiza que no existan huecos intermedios.

## Identidad entre días

En cada muestra `IDEESS` fue único: el número de identificadores distintos
coincidió con el de filas.

Comparando el 9 de agosto de 2026 con otras fechas:

| Comparación | ID comunes | Solo 09-08-2026 | Solo fecha comparada |
|---|---:|---:|---:|
| 03-08-2026 | 11.497 | 26 | 35 |
| 10-07-2026 | 11.448 | 75 | 76 |
| 10-08-2025 | 11.006 | 517 | 188 |
| 10-08-2020 | 9.801 | 1.722 | 620 |
| 01-01-2015 | 8.355 | 3.168 | 883 |

Entre el 3 y el 9 de agosto, ninguna de las 11.497 estaciones comunes cambió de
rótulo, dirección, municipio o coordenadas.
Esto hace de `IDEESS` una clave inicial muy prometedora, aunque falta investigar
reutilización de identificadores, traslados, duplicados `P`/`R` y correcciones
históricas antes de convertirla en garantía del contrato propio.

## Variación útil para el producto

Entre el 3 y el 9 de agosto de 2026:

| Combustible | Estaciones comparables | Precio distinto |
|---|---:|---:|
| Gasolina 95 E5 | 10.931 | 8.390 |
| Gasóleo A | 11.277 | 8.884 |

Hay señal suficiente para que una comparación semanal resulte informativa. La
primera visualización no dependerá de esperar a reunir datos nuevos.

## Contrato observado

La respuesta contiene `Fecha`, `ListaEESSPrecio`, `Nota` y
`ResultadoConsulta`. En las fechas inspeccionadas, las estaciones usan nombres
de campo legibles como `Precio Gasoleo A` y `Longitud (WGS84)`, no las secuencias
`_x0020_` documentadas en una observación anterior.

El normalizador histórico debe aceptar ambas formas. La fuente ya ha demostrado
que su representación puede variar y no se debe suavizar ese cambio en silencio.

`Tipo Venta` tampoco es completamente uniforme a lo largo del tiempo:

- 09-08-2026: 11.522 `P` y 1 `A`;
- 10-08-2025: 11.112 `P` y 82 `A`;
- 10-08-2020: 10.347 `P`, 69 `A` y 5 `p` minúsculas;
- 01-01-2015: 9.185 `P`, 37 `A` y 16 `p` minúsculas.

El histórico necesita una política explícita para códigos antiguos y
minúsculas. No puede reutilizar sin más una validación construida únicamente con
la muestra actual.

## Alternativas de persistencia coste cero para prototipar

### 1. Ventana normalizada dentro del repositorio

Una carga inicial obtiene 90 días. Después, una tarea diaria añade la
instantánea compacta de ayer y retira de la ventana activa el día 91 bajo un
directorio solo de build; esos ficheros no se despliegan directamente. El build
materializa artefactos pequeños por estación y territorio.

Ventajas: funcionamiento determinista, recuperación mediante Git y ninguna
cuenta o servicio adicional. Inconvenientes: Git conserva los ficheros retirados
en su historia aunque la ventana de trabajo sea fija. Debe medirse ese crecimiento
y usarse un fichero por día o bloques que no obliguen a reescribir un binario
grande entero.

### 2. Almacenamiento de objetos con capa gratuita

Guardar instantáneas o bloques compactos fuera del repositorio reduce su
crecimiento. Antes de elegirlo hay que verificar límites vigentes, riesgo de
facturación, política ante exceso de cuota y recuperación. «Tiene capa gratuita»
no basta para cumplir RNF-01: el diseño debe impedir coste accidental, no solo
esperar que el tráfico permanezca bajo un umbral.

### 3. Reconstruir desde el Ministerio en cada build

Solo es razonable para unas pocas fechas de comparación. No sirve para gráficas
de 30 o 365 días: multiplica las mismas descargas en cada despliegue y hace que
una caída temporal del histórico impida reconstruir toda la experiencia.

### 4. Empezar a acumular desde hoy

Es el plan de contingencia si el histórico oficial resulta inestable. Mantiene
coste y contrato bajo control, pero pospone durante meses las lecturas más
potentes. Las muestras actuales no justifican aceptar ese retraso como primera
opción.

## Hipótesis recomendada para el prototipo

Probar una carga inicial de 90 días y normalizarla a instantáneas diarias, solo
de build, dentro del repositorio. Después, un workflow diario descarga ayer de
forma idempotente y rota el día 91. Medir:

- bytes comprimidos por día después de conservar solo identidad y cuatro
  precios;
- crecimiento anual del historial de Git aunque la ventana activa sea fija;
- tiempo de descarga inicial y de build;
- tamaño de artefactos por estación, municipio y provincia;
- estaciones que cambian de metadatos, desaparecen o reaparecen;
- huecos de fechas y comportamiento del endpoint en días sin dato.

Con esas cifras se escribe el ADR de persistencia. Si el repositorio crece de
forma inaceptable, se compara entonces con almacenamiento de objetos. No se
introduce una base de datos ni un servicio encendido por anticipado.

La retención de producto ya está decidida: 90 días cerrados, sin archivo anual.
El histórico oficial permite reconstruir la ventana si el material derivado se
pierde. Conservar más datos propios no aporta valor al uso contextual de
Evolución y no debe convertirse en alcance accidental.

## Primera medición del prototipo compacto

El 10 de agosto de 2026 se implementó el contrato mínimo por día: versión,
fecha y, para cada estación pública, `IDEESS`, provincia, municipio y cuatro
precios expresados como milésimas de euro. No conserva rótulo, dirección,
coordenadas, horario ni campos de combustibles que Evolución no usa.

| Fecha | Estaciones públicas | JSON de trabajo | `gzip -9` |
|---|---:|---:|---:|
| 08-08-2026 | 11.525 | 1.154.225 B | 117.929 B |
| 09-08-2026 | 11.522 | 1.153.923 B | 117.751 B |

La proyección lineal de 90 días es unos 104 MB de JSON de trabajo y 10,6 MB
comprimidos. Todavía no es el formato que recibirá el navegador: falta medir la
ventana completa agrupada por estación y territorio, donde identificadores y
series repetidas deberían comprimir mejor.

La segunda ejecución sobre las mismas fechas realizó cero peticiones y reutilizó
los dos ficheros. La descarga es idempotente por fecha y solo rota ficheros fuera
de la ventana después de completar sin errores todas las descargas solicitadas.

## Medición de la ventana completa

La carga inicial del 12 de mayo al 9 de agosto de 2026 terminó los 90 días sin
huecos, duplicados ni cambios de contrato:

| Medición | Resultado |
|---|---:|
| Días | 90 |
| Estaciones distintas | 11.647 |
| Cambios de provincia o municipio para un mismo `IDEESS` | 0 |
| Suma de instantáneas JSON | 103.406.862 B |
| Suma de instantáneas con gzip independiente | 10.679.206 B |
| Ventana agrupada por estación, JSON mínimo | 21.305.250 B |
| Ventana agrupada por estación, `gzip -9` | **2.030.185 B** |

Agrupar por estación reduce el estado comprimido un 81 % frente a conservar 90
respuestas compactas independientes. El fichero nacional agrupado es material de
build y recuperación; no implica que un navegador deba descargarlo. Separado por
provincia, cada visita puede recibir solo las series de su contexto territorial.

## Nueva hipótesis de persistencia

Los 2 MB permiten usar el propio despliegue estático como estado recuperable:

1. el build descarga la ventana compacta del despliegue anterior;
2. el proceso histórico diario solicita únicamente ayer al Ministerio;
3. desplaza las series, añade la nueva observación y retira el día 91;
4. vuelve a publicar el estado nacional de build y los artefactos de consumo por
   provincia;
5. los demás builds del día reutilizan la misma ventana sin consultar 90 fechas.

No aparece un servidor ni almacenamiento facturable: es un fichero estático en
Cloudflare Pages. Si el estado publicado no existe o está corrupto, se
reconstruye desde las 90 fechas oficiales. Una caída de esa reconstrucción debe
abortar el despliegue y conservar el sitio anterior.

Esta vía evita el crecimiento anual del historial de Git. El prototipo posterior
validó actualización incremental, recuperación con SHA-256, partición por
provincia y rematerialización determinista; quedó aceptada en
[ADR-0024](adr/0024-ventana-historica-en-despliegue.md).

## Medición de los artefactos definitivos de datos

El estado canónico añade presencia y cambios territoriales para distinguir una
estación ausente de un combustible no vendido. La materialización final produjo:

| Artefacto | Medición |
|---|---:|
| Estado nacional comprimido | 2.040.733 B |
| Provincias | 52 ficheros |
| Suma provincial con gzip | 3.832.088 B |
| Provincia mediana | 63.322 B |
| Percentil 95 provincial | 153.624 B |
| Provincia máxima, Barcelona | 274.725 B |

El estado recuperado desde una simulación del despliegue anterior volvió a
generar exactamente el mismo SHA-256 y manifiesto. Un build completo con los 54
ficheros históricos terminó correctamente; `dist/` contiene 2.457 ficheros en
total, frente al límite gratuito de 20.000 de Cloudflare Pages.
