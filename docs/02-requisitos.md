# 02 · Requisitos

Cada requisito es verificable. Si no se puede comprobar mirando la pantalla o
ejecutando un comando, no es un requisito: es una intención, y no va aquí.

Prioridad: **M** imprescindible para la v1 · **S** deseable · **C** si sobra tiempo.

---

## Requisitos funcionales

### Datos

| ID | Prioridad | Requisito |
|---|---|---|
| RF-01 | M | El sistema descarga los precios de la API del MITECO y los guarda como ficheros JSON estáticos, uno por provincia, más un índice. |
| RF-02 | M | La descarga se ejecuta de forma automática y programada, sin intervención manual. |
| RF-03 | M | Los precios se convierten de `String` con coma decimal a número. Un valor vacío significa "no vende ese producto" y nunca se convierte en cero. |
| RF-04 | M | Cada fichero de provincia incluye la marca de tiempo de los datos tal como la devuelve el ministerio. |
| RF-05 | M | Si la descarga falla, el despliegue anterior se mantiene intacto. Nunca se publican ficheros vacíos o a medias. |
| RF-06 | S | El proceso registra cuántas estaciones ha procesado y cuántas ha descartado por datos inválidos. |

### Mapa

| ID | Prioridad | Requisito |
|---|---|---|
| RF-10 | M | El mapa muestra un marcador por estación con el precio del combustible seleccionado escrito dentro. |
| RF-11 | M | El marcador se ancla al punto exacto de la estación, no a un punto aproximado. |
| RF-12 | M | El color del marcador se calcula por el percentil del precio **dentro de la zona mostrada**, nunca por un umbral absoluto. |
| RF-13 | M | La estación más barata se distingue del resto por color y tamaño, no solo por posición. |
| RF-14 | M | Al pulsar un marcador se abre la ficha de esa estación y el mapa se centra en ella. |
| RF-15 | M | Las estaciones cerradas se muestran atenuadas, no se ocultan, salvo que el filtro esté activo. |
| RF-16 | S | Cuando dos marcadores se solapan a un nivel de zoom, se agrupan y muestran el precio más bajo del grupo. |
| RF-17 | S | Botón de "mi ubicación" que centra el mapa. Solo se pide permiso al pulsarlo. |

### Lista y ficha

| ID | Prioridad | Requisito |
|---|---|---|
| RF-20 | M | Lista de estaciones ordenada de menor a mayor precio del combustible seleccionado. |
| RF-21 | M | La lista y el mapa están sincronizados: seleccionar en una resalta en el otro. |
| RF-22 | M | La ficha muestra rótulo, dirección, municipio, horario declarado y los cuatro combustibles con su precio. |
| RF-23 | M | Un combustible que la estación no vende se muestra como "no vende", nunca como 0,000 ni en blanco. |
| RF-24 | M | La ficha indica el puesto de la estación dentro de la zona para el combustible seleccionado, y su provincia cuando la zona abarca varias. |
| RF-25 | M | La ficha calcula el ahorro en euros respecto a la estación más cara de la zona, según el tamaño de depósito indicado. |
| RF-26 | S | Ordenar la lista por distancia cuando hay geolocalización concedida. |
| RF-27 | C | Enlace de "cómo llegar" que abre la app de mapas del dispositivo. |

### Controles

| ID | Prioridad | Requisito |
|---|---|---|
| RF-30 | M | Selector de combustible siempre visible, accesible en un solo toque, sin menús desplegables. |
| RF-31 | M | Filtro de "solo abiertas ahora" que interpreta el campo de horario del ministerio. |
| RF-32 | M | Selector de zona: provincias, comunidades autónomas y zonas a medida, agrupadas y buscables por nombre. |
| RF-36 | M | Una zona de varias provincias descarga sus ficheros en paralelo y los fusiona. Si alguno falla, se muestra lo que sí ha llegado y se avisa de qué falta. |
| RF-37 | S | Al elegir zona por geolocalización, se propone la comunidad autónoma del usuario, no solo su provincia. |
| RF-33 | M | Campo para el tamaño del depósito en litros, con 50 L por defecto. |
| RF-34 | M | Combustible, provincia y depósito se recuerdan entre visitas en `localStorage`. |
| RF-35 | S | La URL refleja provincia y combustible, de modo que se pueda compartir un enlace concreto. |

### Estados de error

| ID | Prioridad | Requisito |
|---|---|---|
| RF-40 | M | Si el JSON de datos no carga, se muestra un mensaje que explica qué ha fallado y ofrece reintentar. |
| RF-41 | M | Si el mapa no carga, la lista y la ficha siguen funcionando al completo y el hueco del mapa explica el fallo. |
| RF-42 | M | Si ninguna estación de la zona vende el combustible elegido, se dice explícitamente en vez de mostrar una lista vacía. |
| RF-43 | M | Si los datos tienen más de 6 horas, se avisa de que pueden estar desactualizados. |

---

## Requisitos no funcionales

### Coste

| ID | Prioridad | Requisito |
|---|---|---|
| RNF-01 | M | El coste mensual de ejecución es 0 €. Cualquier decisión que implique un servicio de pago necesita un ADR que la justifique. |
| RNF-02 | M | No existe ningún proceso que corra de forma continua. Todo es estático o programado. |
| RNF-03 | M | El consumo se mantiene dentro de los límites gratuitos documentados en `docs/03-arquitectura.md`, con margen. |

### Rendimiento

| ID | Prioridad | Requisito |
|---|---|---|
| RNF-10 | M | Contenido útil en pantalla en menos de 1 s con conexión 4G. |
| RNF-11 | M | El JavaScript inicial pesa menos de 150 KB comprimido, sin contar MapLibre, que se carga aparte y después. |
| RNF-12 | M | El JSON de una provincia pesa menos de 100 KB comprimido. El de la provincia más grande marca el listón. |
| RNF-15 | M | Una zona completa no supera los 300 KB comprimidos de datos. Por encima, se sirve un resumen con solo coordenadas y el combustible elegido. |
| RNF-13 | M | El navegador nunca descarga los datos de provincias fuera de la zona mostrada. Un fichero ya descargado se reutiliza entre zonas que lo compartan. |
| RNF-14 | S | El mapa mantiene 30 fps al desplazarlo con 400 marcadores en pantalla. |

### Accesibilidad y compatibilidad

| ID | Prioridad | Requisito |
|---|---|---|
| RNF-20 | M | Todo se puede manejar con teclado, con foco visible en todos los controles. |
| RNF-21 | M | El color nunca es el único portador de información: el precio va siempre escrito. |
| RNF-22 | M | Contraste mínimo AA (4,5:1) en texto, incluidos los precios sobre su fondo de color. |
| RNF-23 | M | Se respeta `prefers-reduced-motion`. |
| RNF-24 | M | Usable con una mano en pantallas de 360 px de ancho. Los controles principales, en la mitad inferior. |
| RNF-25 | S | La escala de color es distinguible con deuteranopia y protanopia. |

### Privacidad

| ID | Prioridad | Requisito |
|---|---|---|
| RNF-30 | M | Sin analítica, sin cookies de terceros, sin píxeles de seguimiento. |
| RNF-31 | M | La ubicación del usuario no sale nunca del dispositivo. |
| RNF-32 | M | Sin banner de consentimiento, porque no hay nada que consentir. |

### Mantenimiento

| ID | Prioridad | Requisito |
|---|---|---|
| RNF-40 | M | Un fallo de la API del ministerio no rompe el sitio publicado. |
| RNF-41 | M | Si cambian los nombres de campo de la API, el proceso de datos falla de forma ruidosa en vez de publicar datos silenciosamente mal. |
| RNF-42 | S | Pruebas del normalizador de datos y del intérprete de horarios, que son las dos piezas con casos raros de verdad. |
