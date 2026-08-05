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

### 6. El histórico escapa los caracteres raros

El endpoint `EstacionesTerrestresHist` devuelve las mismas claves pero con las
secuencias escapadas:

```json
"Precio_x0020_Gasoleo_x0020_A"
"Longitud_x0020__x0028_WGS84_x0029_"
```

`_x0020_` es un espacio, `_x0028_` y `_x0029_` los paréntesis. El normalizador
debe aceptar las dos formas.

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
