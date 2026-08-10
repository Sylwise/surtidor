# 04 · Fuente de datos: la API del MITECO

Documento de referencia sobre la API pública de precios de carburantes. Léelo
entero antes de escribir el cliente. La API funciona, pero tiene rarezas
suficientes como para que improvisar salga caro.

## Qué es

Servicio REST del Ministerio para la Transición Ecológica y el Reto Demográfico.
Es la misma fuente que alimenta el Geoportal de Hidrocarburos y, por debajo, casi
todas las webs y apps de precios de carburante en España, Waze incluido.

Los datos vienen de las declaraciones obligatorias de las estaciones de servicio,
según la Orden ITC/2308/2007.

Gratis. Sin registro. Sin clave. Sin límite de peticiones publicado.

## Base

```
https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/
```

Existe un espejo en `https://energia.serviciosmin.gob.es/ServiciosRestCarburantes/PreciosCarburantes/`.
Útil como alternativa si el principal está caído.

## Endpoints que usamos

| Endpoint | Devuelve |
|---|---|
| `EstacionesTerrestres/` | Todas las estaciones de España, unas 11.500 |
| `EstacionesTerrestres/FiltroProvincia/{id}` | Estaciones de una provincia |
| `EstacionesTerrestres/FiltroMunicipio/{id}` | Estaciones de un municipio |
| `EstacionesTerrestres/FiltroCCAA/{id}` | Estaciones de una comunidad autónoma |
| `EstacionesTerrestresHist/{fecha}` | Histórico de un día concreto |
| `Listados/Provincias` | Catálogo de provincias |
| `Listados/Municipios` | Catálogo de municipios |
| `Listados/ProductosPetroliferos` | Catálogo de combustibles |

También admiten parámetros combinados, del tipo
`EstacionesTerrestres/?idCCAA=1&idProducto=3`.

Los identificadores de provincia siguen el código INE de dos dígitos: `01` es
Álava, `28` Madrid, `08` Barcelona, `48` Bizkaia, `20` Gipuzkoa.

## Las trampas

Todas están comprobadas. No son teoría.

### 1. No hay CORS

**El navegador no puede llamar a esta API.** No envía cabeceras
`Access-Control-Allow-Origin`. Es la razón por la que existe todo el proceso de
generación de ficheros estáticos, y no una preferencia de arquitectura.

Nunca escribas un `fetch` a `sedeaplicaciones.minetur.gob.es` en código que corra
en el navegador. Ni siquiera para probar.

### 2. Devuelve XML si no pides JSON explícitamente

Desde un navegador, o sin cabecera, la respuesta viene en XML. Para obtener JSON
hay que mandar:

```
Accept: application/json
```

Con eso basta. No hace falta parámetro de query.

### 3. Todos los números son cadenas con coma decimal

Los precios llegan así:

```json
"Precio Gasoleo A": "1,479"
"Latitud": "42,869500"
"Longitud (WGS84)": "-2,671600"
```

Hay que hacer `.replace(",", ".")` antes de `parseFloat`. Sin excepción, también
en las coordenadas.

### 4. Cadena vacía significa "no vende ese producto"

```json
"Precio Gasolina 98 E5": ""
```

Esto **no es cero, no es null, no es un dato que falte por error**: es que esa
estación no vende gasolina 98. Convertirlo en `0` haría que apareciera como la
más barata de la provincia, que es exactamente el fallo que hace inútil un
comparador de precios.

Se normaliza a `null` y la interfaz lo muestra como "no vende".

### 5. Los nombres de campo llevan espacios, acentos y paréntesis

```json
"Rótulo", "Dirección", "C.P.", "Longitud (WGS84)", "Precio Gasoleo A"
```

En TypeScript hay que acceder con corchetes, y en cualquier mapeo a un modelo
propio hay que traducirlos. **Que estos nombres no salgan de `scripts/lib/`.**

### 6. El histórico ha usado más de una forma de nombrar campos

Se observó que `EstacionesTerrestresHist` devolvía claves con secuencias
escapadas:

```json
"Precio_x0020_Gasoleo_x0020_A"
"Longitud_x0020__x0028_WGS84_x0029_"
```

`_x0020_` es un espacio, `_x0028_` y `_x0029_` los paréntesis. Sin embargo, las
muestras reales consultadas el 10 de agosto de 2026, incluidas fechas entre 2007
y 2026, devolvieron nombres normales como `Precio Gasoleo A` y
`Longitud (WGS84)`.

El normalizador debe aceptar las dos formas. No se puede asumir que el contrato
histórico sea idéntico para siempre ni borrar esta diferencia después de una
sola muestra. Las mediciones completas están en
[09 · Investigación del histórico](09-investigacion-historico-miteco.md).

### 7. No se puede pedir una estación por su identificador

No existe un endpoint `EstacionesTerrestres/{id}`. O te descargas la provincia
entera y filtras, o te descargas España entera. Para nuestro caso da igual,
porque descargamos todo de todas formas.

### 8. El listado de provincias tiene una errata en un nombre de campo

`Listados/Provincias` devuelve el campo como **`IDPovincia`**, sin la "r". No es
un error de transcripción de este documento. Si lo escribes bien, no funciona.

### 9. Hay caídas puntuales

El servicio se cae de vez en cuando. Por eso RF-05 exige que un fallo de
descarga aborte el despliegue en lugar de publicar datos vacíos.

El cliente debe llevar reintentos con espera creciente (3 intentos, 2 s, 4 s,
8 s) y un timeout por petición de 30 segundos.

### 10. Los precios del REST y los del Geoportal pueden no coincidir

Hay informes de diferencias puntuales entre lo que muestra el mapa oficial y lo
que devuelve el servicio REST. No hay nada que hacer al respecto: usamos el REST
y mostramos la marca de tiempo que él mismo declara, para que el usuario sepa a
qué momento corresponde el dato.

### 11. Hay estaciones con latitud y longitud intercambiadas en origen

Caso confirmado: id `16268`, rótulo "GUAY", en Tui (Pontevedra). Sus
coordenadas la sitúan en el océano Índico. No es un error de análisis ni de
normalización: llega así del ministerio.

Consecuencia: cualquier cálculo geométrico sobre el conjunto de
estaciones —encuadres, centroides, agrupaciones— sale corrompido por una sola
fila, y en el mapa aparece un marcador en mitad del mar. Se descubrió en la
rama `hito-h12-el-mapa-manda` calculando envolventes por provincia; el
detalle está en [ADR-0015](adr/0015-el-mapa-manda-abandonado.md).

Tratamiento: `scripts/lib/normalizar.ts` descarta la estación y la cuenta,
por separado de las que vienen sin coordenadas (ver trampa 12). El filtro es
geográfico, y tiene que incluir Canarias, Ceuta y Melilla: un rectángulo
peninsular borraría las islas enteras.

### 12. Hay estaciones cuyas coordenadas llegan como (0, 0) exacto

Casos confirmados: id `11988`, rótulo "PETROZAL", en Barcelona; e id `12883`,
rótulo "SUPER GASOIL", en Valdemoro (Madrid). Sus coordenadas son
`(0, 0)`, el punto del golfo de Guinea donde se cruzan el ecuador y el
meridiano de Greenwich.

`(0, 0)` es el valor por defecto del ministerio cuando no tiene la posición
real de la estación: es ausencia disfrazada de dato, no una posición
equivocada. No es un error de análisis ni de normalización: llega así.

Tratamiento: distinto del de la trampa 11. `scripts/lib/normalizar.ts` trata
`(0, 0)` como si lat/lon vinieran vacías: cae por el mismo camino que las
estaciones sin coordenadas, no por el del rectángulo de España, y se cuenta
junto a ellas.

## Forma de la respuesta

```json
{
  "Fecha": "05/08/2026 11:00:00",
  "ResultadoConsulta": "OK",
  "ListaEESSPrecio": [
    {
      "IDEESS": "1234",
      "Rótulo": "BALLENOIL",
      "Dirección": "PORTAL DE GAMARRA 42",
      "Municipio": "VITORIA-GASTEIZ",
      "Provincia": "ARABA/ALAVA",
      "Localidad": "VITORIA-GASTEIZ",
      "C.P.": "01013",
      "Latitud": "42,869500",
      "Longitud (WGS84)": "-2,671600",
      "Margen": "D",
      "Horario": "L-D: 24H",
      "Tipo Venta": "P",
      "Precio Gasolina 95 E5": "1,409",
      "Precio Gasoleo A": "1,489",
      "Precio Gasolina 98 E5": "",
      "Precio Gasoleo Premium": ""
    }
  ]
}
```

Comprobar siempre que `ResultadoConsulta` sea `OK` antes de procesar nada.

### Combustibles que nos interesan

| Campo | Clave interna |
|---|---|
| `Precio Gasolina 95 E5` | `gasolina95e5` |
| `Precio Gasoleo A` | `gasoleoA` |
| `Precio Gasolina 98 E5` | `gasolina98e5` |
| `Precio Gasoleo Premium` | `gasoleoPremium` |

Hay muchos más (`Precio Biodiesel`, `Precio Gas Natural Comprimido`, `Precio
Hidrogeno`, `Precio Adblue`…). Fuera de la v1, pero el normalizador no debe
romperse si aparecen o desaparecen campos.

Ojo: existen tanto `Gasolina 95 E5` como `Gasolina 95 E10`, y son productos
distintos. No mezclarlos.

## El campo Tipo Venta

Tres códigos, no dos. Según el anexo de la Orden ITC/2308/2007:

| Código | Significado |
|---|---|
| `P` | Venta al público en general |
| `R` | Venta restringida a asociados o cooperativistas |
| `A` | Vende productos **distintos** al público general y a sus asociados |

Una instalación que venda a sus cooperativistas a un precio distinto remite **dos
registros**, uno `P` y otro `R`. Si solo vende a asociados, remite `R`.

**En la muestra nacional comprobada el 5 de agosto de 2026, el servicio REST
devolvía `P` en el 100 % de las 11.519 estaciones:** cero `R`, cero `A`. Es una
medición, no una garantía permanente de la fuente; el normalizador sigue
aceptando los tres códigos.

No es un error de lectura. Hay dos razones:

1. **La venta restringida es esencialmente un fenómeno del gasóleo B**, el
   agrícola. Según la CNMC, las estaciones de venta restringida son
   independientes y, más concretamente, cooperativas. Los cuatro combustibles de
   la v1 —gasolina 95, 98, gasóleo A y premium— son productos de venta al
   público.
2. **El conjunto de datos del que cuelga este servicio se titula "Instalaciones
   de suministro de combustibles a vehículos y embarcaciones con venta pública".**

Consecuencia práctica: **mientras no se incorpore el gasóleo B, no van a
aparecer `R`.** El campo se normaliza y se conserva igualmente, porque cuesta
cero y protege el día que eso cambie, pero **no se construye interfaz para un
caso que hoy no ocurre**.

Ojo con `A`: no estaba documentado en la primera versión de este fichero y el
validador no lo contemplaba. Debe aceptarse sin romper, aunque tampoco se haya
visto nunca.

## El campo Horario

Es texto libre con una convención más o menos respetada. Formas que aparecen:

```
L-D: 24H
L-V: 06:00-22:00; S: 08:00-14:00
L-S: 07:00-22:00
L-D: 07:00-23:00
```

Las letras de los días son las iniciales en español: **L M X J V S D**. La `X`
es miércoles.

Reglas del intérprete:

- Los bloques se separan por punto y coma.
- `24H` en un bloque significa abierto todo ese rango de días.
- Un rango horario cuyo cierre sea menor o igual que la apertura cruza
  medianoche: hay que sumarle 24 h antes de comparar.
- **Si el campo está vacío o no se entiende, la estación se considera abierta.**
  Enseñar una de más molesta menos que ocultar una que sí abre.
- Los rangos de días pueden dar la vuelta a la semana (`V-L`). El recorrido debe
  ser circular.

Esta función merece pruebas unitarias. Es donde se esconden los casos raros.

## Otras opciones descartadas

**Precioil** (`api.precioil.es`) es un envoltorio de terceros con endpoints más
sensatos (búsqueda por radio, estaciones cercanas, histórico por estación) y
JSON limpio. Se descarta porque requiere clave de API y añade una dependencia de
un tercero que puede desaparecer o empezar a cobrar. La fuente oficial es la
fuente oficial.

Merece la pena tenerlo apuntado por si alguna vez hace falta búsqueda geográfica
que no queramos implementar nosotros.
