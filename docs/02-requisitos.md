# 02 · Requisitos

Cada requisito es verificable. Si no se puede comprobar mirando la pantalla o
ejecutando un comando, no es un requisito: es una intención, y no va aquí.

Prioridad: **M** imprescindible para la v1 · **S** deseable dentro de la v1 ·
**C** si sobra tiempo. Lo aplazado a v2 y v3 no lleva requisito todavía: está en
`docs/06-roadmap.md` y se especifica cuando le toque.

Filtro previo a cualquier requisito nuevo: **si necesita un servidor, no entra.**

Todo lo de este documento es **v1**, salvo la última sección. Los requisitos de
la v2 están al final, claramente separados: no se implementan hasta que la v1
esté publicada.

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
| RF-16 | M | Los marcadores nunca se solapan de forma ilegible. Por debajo del zoom 11 las estaciones se agrupan mostrando cuántas son y el precio mínimo del grupo; por encima, la detección de colisiones oculta las etiquetas que se pisarían. |
| RF-17 | S | Botón de "mi ubicación" que centra el mapa. Solo se pide permiso al pulsarlo. |
| RF-18 | M | La estación más barata visible gana siempre la detección de colisiones: su etiqueta jamás queda oculta por otra. |
| RF-19 | M | Al cargar una zona, el mapa encuadra sus estaciones con `fitBounds` y un 8 % de margen. Nunca centro y zoom fijos. |

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
| RF-29 | M | La ficha indica de qué lado de la carretera está la estación, a partir del campo `Margen` (`D`, `I`, `N`). |
| RF-27 | M | Botón de "cómo llegar" que abre la aplicación de mapas del dispositivo. En Android, esquema `geo:` para que salga el selector del sistema y se respete la app de cada uno. Enlace universal de Google Maps como opción por defecto, con Waze y Apple Maps como alternativas secundarias. |
| RF-28 | M | Los enlaces externos llevan `rel="noopener noreferrer"` y abren en pestaña nueva. |

### Controles

| ID | Prioridad | Requisito |
|---|---|---|
| RF-30 | M | Selector de combustible siempre visible, accesible en un solo toque, sin menús desplegables. |
| RF-31 | M | Filtro de "solo abiertas ahora" que interpreta el campo de horario del ministerio. |
| RF-32 | M | Selector de zona: provincias, comunidades autónomas y zonas a medida, agrupadas y buscables por nombre. |
| RF-36 | M | Una zona de varias provincias descarga sus ficheros en paralelo y los fusiona. Si alguno falla, se muestra lo que sí ha llegado y se avisa de qué falta. |
| RF-37 | S | Cuando el usuario pulsa el botón de ubicación, se le propone además cambiar a la zona que le corresponde. |
| RF-33 | M | Control de **litros a repostar** (no "depósito": casi nadie llena desde vacío), con 20 L por defecto. Vive en la ficha, no en la cabecera. |
| RF-44 | M | Con los litros indicados, la ficha muestra **dos cifras**: coste total en esta estación y coste en la más cara de la zona. El ahorro es el número destacado; los totales, secundarios. |
| RF-48 | M | Las estaciones con `Tipo Venta` distinto de `P` (venta restringida: cooperativas, flotas) se ocultan por defecto. Un ajuste permite mostrarlas, siempre marcadas como restringidas. |
| RF-34 | M | Combustible, zona y litros a repostar se recuerdan entre visitas en `localStorage`. |
| RF-35 | S | La URL refleja provincia y combustible, de modo que se pueda compartir un enlace concreto. |
| RF-49 | M | Al entrar en la raíz, la zona se resuelve **sin servidor**: la guardada en `localStorage`, si no la página de aterrizaje por la que se ha entrado, y si no un selector. **Nunca se pide permiso de geolocalización al cargar.** |
| RF-38 | M | En móvil, hoja inferior con tres posiciones de anclaje (asomada, media, completa), arrastrable. El selector de combustible y el filtro son visibles en las tres. |
| RF-39 | M | En móvil, la ficha de estación se apila sobre la lista dentro de la hoja; no la sustituye. |

### Encontrabilidad

| ID | Prioridad | Requisito |
|---|---|---|
| RF-70 | M | Página estática por municipio, además de por zona, para los municipios con población suficiente. Los precios van en el HTML servido, nunca inyectados por JavaScript. |
| RF-71 | M | Título y descripción de cada página generados con el dato real y su hora: precio mínimo, combustible y municipio. |
| RF-72 | M | JSON-LD con un `ItemList` de `GasStation`, cada una con su `Offer`. Todo lo declarado debe coincidir exactamente con lo visible en la página. |
| RF-73 | M | `sitemap.xml` con `lastmod` regenerado en cada despliegue. |
| RF-74 | M | Enlazado interno entre zona, sus municipios y los municipios vecinos. Ninguna página queda huérfana. |
| RF-75 | M | Imagen de compartición (Open Graph) generada en el build por municipio, con el precio más barato del día y el nombre del municipio. |

### Estados de error

| ID | Prioridad | Requisito |
|---|---|---|
| RF-40 | M | Si el JSON de datos no carga, se muestra un mensaje que explica qué ha fallado y ofrece reintentar. |
| RF-41 | M | Si el mapa no carga, la lista y la ficha siguen funcionando al completo y el hueco del mapa explica el fallo. |
| RF-42 | M | Si ninguna estación de la zona vende el combustible elegido, se dice explícitamente en vez de mostrar una lista vacía. |
| RF-43 | M | Si los datos tienen más de 6 horas, se avisa de que pueden estar desactualizados. |

### Coste y navegación (v1)

| ID | Prioridad | Requisito |
|---|---|---|
| RF-53 | M | Control de **litros a repostar** (no "depósito"), con 20 L por defecto, persistido. Vive en la ficha, no en la cabecera. |
| RF-54 | M | La ficha muestra dos cifras y un resultado: coste de esos litros aquí, coste en la más cara de la zona, y el ahorro. El ahorro es el número grande. |
| RF-55 | M | Botón de "cómo llegar" que respeta la aplicación de mapas del dispositivo: `geo:` en Android, enlace universal de Google Maps como opción por defecto, y accesos secundarios a Waze y Apple Maps. |
| RF-56 | M | Las estaciones con `Tipo Venta` distinto de `P` (venta restringida) se ocultan por defecto. Un interruptor permite verlas, y entonces aparecen etiquetadas como tales. |

### Encontrabilidad (v1)

| ID | Prioridad | Requisito |
|---|---|---|
| RF-60 | M | Página estática por municipio con un mínimo de estaciones. Por debajo de ese mínimo no se genera y se redirige a la página de nivel superior. |
| RF-61 | M | Los precios están en el HTML servido, nunca inyectados solo por JavaScript. |
| RF-62 | M | Título y descripción generados con el precio mínimo real y la hora de actualización. |
| RF-63 | M | JSON-LD con `ItemList` de `GasStation` y su `Offer`. Todo lo declarado coincide con lo visible en la página. |
| RF-64 | M | `sitemap.xml` con `lastmod`, regenerado en cada despliegue. |
| RF-65 | M | Enlazado interno entre municipio, municipios vecinos y provincia. |
| RF-66 | M | Imagen `og:image` generada en el build por municipio, con el precio más barato del día y el nombre del municipio. |

### Zona inicial (v1)

| ID | Prioridad | Requisito |
|---|---|---|
| RF-70 | M | La zona inicial se resuelve **sin servidor y sin pedir permisos**: zona guardada, si no la página de aterrizaje, si no el selector. |
| RF-71 | M | El selector de zona es una pantalla de primer nivel, no un menú de rescate: zonas frecuentes arriba, búsqueda por nombre, áreas de pulsación grandes. |

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
| RNF-24 | M | Usable con una mano en pantallas de 360 px de ancho. Los controles principales, en la mitad inferior, con área de pulsación mínima de 44 px. |
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

---

## Requisitos de la v2

**No se implementan hasta que la v1 esté publicada.** Están aquí para que las
decisiones de la v1 no cierren puertas, no para construirlos ahora.

Ninguno necesita servidor. Si alguno acaba necesitándolo, se cae de la lista.

| ID | Requisito |
|---|---|
| V2-01 | Resumen histórico diario por provincia, generado en el build desde `EstacionesTerrestresHist`. Unos pocos KB al día. |
| V2-02 | Flecha de tendencia en la ficha: sube o baja respecto a ayer. |
| V2-03 | "¿Lleno hoy o el martes?": día de la semana de media más barato en esa provincia, con la ventana temporal usada. |
| V2-04 | Perfil de vehículo: consumo en L/100 km y combustible habitual, en `localStorage`. |
| V2-05 | Coste del desvío: ahorro neto tras descontar el combustible de llegar hasta allí. Requiere V2-04 y geolocalización. |
| V2-06 | Comparar en euros por 100 km además de en euros por litro. |
| V2-07 | Filtro por carretera principal, con la distancia de cada estación a cada vía precalculada en el build. |
| V2-08 | Detección de precio congelado: estaciones que llevan días sin actualizar. |
| V2-09 | Favoritos fijados arriba, en `localStorage`. |
| V2-10 | Páginas editoriales automáticas: provincias más baratas, estación más barata del país. |
| V2-11 | Publicar los JSON normalizados como datos abiertos, con su documentación. |
| V2-12 | Combustibles adicionales, empezando por gasóleo B. |
| V2-13 | Ordenar por distancia con geolocalización concedida. |
| V2-14 | PWA con la última zona en caché para uso sin conexión. |
| V2-15 | Puntos de recarga eléctrica. |

## Fuera de alcance permanente

No son "todavía no". Son "no".

| Qué | Por qué |
|---|---|
| Alertas por precio | Exigen guardar suscripciones y enviar notificaciones: servidor y base de datos. Rompen RNF-01, que es el requisito que sostiene el proyecto. |
| Cuentas de usuario | No hay nada que guardar en servidor. |
| Precios de la comunidad | Exige moderación, y la fuente oficial ya es obligatoria por ley. |
| Anuncios | Es el motivo por el que existe el proyecto. |
| Cualquier proceso encendido | RNF-02. |
