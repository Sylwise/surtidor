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
| RF-32 | M | Selector de zona: 52 provincias y 19 comunidades autónomas, generadas desde los catálogos del ministerio. Buscable por nombre. |
| RF-76 | M | Los nombres de provincia y comunidad se toman del catálogo del ministerio sin modificarlos. El proyecto no traduce, no acorta ni elige entre denominaciones. |
| RF-85 | M | Los nombres de combustible salen de la tabla canónica de `docs/05-diseno.md` y son idénticos en pestañas, lista, ficha, títulos de página y JSON-LD. Un producto, un nombre. |
| RF-86 | M | El rótulo se muestra verbatim; la dirección y el municipio se pasan a caja de título; la provincia, verbatim. |
| RF-87 | M | El lado de la vía se dice "A la derecha de la vía" o "A la izquierda de la vía". Con `Margen` a `N` no se muestra nada. |
| RF-88 | M | Estando en una página de zona, elegir otra zona no recarga el documento: se cargan sus datos, el mapa vuela sin reconstruirse y la dirección cambia con `pushState` a la página real de esa zona. La tabla de precios servida y el `<title>` se actualizan en la misma operación. Atrás y adelante del navegador devuelven a la zona anterior. Desde una página de municipio, elegir zona sigue siendo navegación completa. Ver [ADR-0016](adr/0016-cambio-de-zona-sin-recarga.md). |
| RF-89 | M | En las páginas de aplicación, incluida la portada, la lista de estaciones es el contenido servido: el HTML del build contiene las estaciones ordenadas por los cuatro combustibles, con rótulo, dirección y precio en cada fila, y las pastillas eligen cuál se muestra. Nada cuelga por debajo de `.app`: no hay tabla, sección, directorio de enlaces ni pie después del mapa. Los enlaces a otros municipios cierran la lista como pastillas con el precio mínimo. Los documentos editoriales quedan fuera de esta restricción y se desplazan por definición. Ver `docs/05-diseno.md`, sección "La lista es el contenido", [ADR-0019](adr/0019-paginas-editoriales-sin-aplicacion.md) y [ADR-0020](adr/0020-navegacion-en-paneles-dentro-de-la-aplicacion.md). |
| RF-90 | M | En una página de municipio, la aplicación muestra únicamente las estaciones de ese municipio, no las de la provincia. Un enlace lleva a la página de la provincia. |
| RF-91 | M | La portada contiene, en el HTML servido, enlaces `<a href>` reales a las 52 provincias y las 19 comunidades autónomas. Viven dentro del selector territorial de la cabecera, no en una sección debajo de la aplicación. El cliente mejora esos enlaces para aplicar RF-88 sin recarga; sin JavaScript navegan de forma ordinaria. Ver [ADR-0017](adr/0017-jerarquia-de-enlaces.md) y [ADR-0020](adr/0020-navegacion-en-paneles-dentro-de-la-aplicacion.md). |
| RF-92 | M | Cada página de zona contiene, en el HTML servido, enlaces `<a href>` reales a todos sus municipios con página propia. Ver [ADR-0017](adr/0017-jerarquia-de-enlaces.md). |
| RF-93 | M | Cada página de zona declara un `<h1>` con el nombre de la zona, en el HTML servido, encima de la lista. |
| RF-77 | M | No existen zonas definidas a mano. Toda zona sale de un límite administrativo oficial o de la adyacencia geográfica. |
| RF-36 | M | Una zona de varias provincias descarga sus ficheros en paralelo y los fusiona. Si alguno falla, se muestra lo que sí ha llegado y se avisa de qué falta. |
| RF-37 | S | Cuando el usuario pulsa el botón de ubicación, se le propone además cambiar a la zona que le corresponde. |
| RF-33 | M | Control de **litros a repostar** (no "depósito": casi nadie llena desde vacío), con 20 L por defecto. Vive en la ficha, no en la cabecera. |
| RF-44 | M | Con los litros indicados, la ficha muestra **dos cifras**: coste total en esta estación y coste en la más cara de la zona. El ahorro es el número destacado; los totales, secundarios. |
| RF-48 | M | El normalizador acepta los tres códigos de `Tipo Venta` (`P`, `R`, `A`) sin romper, y las estaciones con código distinto de `P` se excluyen de la lista y el mapa. Sin interfaz asociada en la v1: ver RF-56. |
| RF-34 | M | Combustible, zona y litros a repostar se recuerdan entre visitas en `localStorage`. |
| RF-35 | S | La URL refleja la zona, de modo que se pueda compartir un enlace concreto. El combustible **no** va en la URL: como parámetro de consulta crearía cuatro variantes rastreables de cada página del sitio y obligaría a un `canonical` en todas. El combustible elegido vive en `localStorage` (RF-34). |
| RF-49 | M | Al entrar en la raíz, la zona se resuelve **sin servidor**: la guardada en `localStorage`, si no la página de aterrizaje por la que se ha entrado, y si no un selector. **Nunca se pide permiso de geolocalización al cargar.** |
| RF-38 | M | En móvil, hoja inferior con tres posiciones de anclaje (asomada, media, completa), arrastrable. El selector de combustible y el filtro son visibles en las tres. |
| RF-39 | M | En móvil, la ficha de estación se apila sobre la lista dentro de la hoja; no la sustituye. |
| RF-80 | M | La hoja tiene dos estados. En **lista**: pestañas de combustible en su cabecera. En **ficha**: las pestañas desaparecen, porque la ficha ya muestra los cuatro precios y el control estaría duplicado. |
| RF-81 | M | Con la ficha abierta, las cuatro filas de combustible son pulsables y cambian el combustible activo. Área de pulsación de 44 px como mínimo. |
| RF-82 | M | El filtro de abiertas no ocupa fila propia: es una píldora en la cabecera de la lista, junto al contador de estaciones. |
| RF-83 | M | La ficha se cierra de tres formas, todas válidas: tocando el mapa, arrastrando la hoja hacia abajo, y con una X en la ficha. Ninguna franja de mapa visible queda sin respuesta al toque. |
| RF-84 | M | En móvil, la cabecera muestra solo el icono, no la palabra "Surtidor". En escritorio se muestran los dos. |

### Estados de error

| ID | Prioridad | Requisito |
|---|---|---|
| RF-40 | M | Si el JSON de datos no carga, se muestra un mensaje que explica qué ha fallado y ofrece reintentar. |
| RF-41 | M | Si el mapa no carga, la lista y la ficha siguen funcionando al completo y el hueco del mapa explica el fallo. |
| RF-42 | M | Si ninguna estación de la zona vende el combustible elegido, se dice explícitamente en vez de mostrar una lista vacía. |
| RF-43 | M | Si los datos tienen más de 6 horas, se avisa de que pueden estar desactualizados. |

### Coste y navegación (v1)

RF-53, RF-54 y RF-55 se retiraron de aquí: duplicaban palabra por palabra a
RF-33, RF-44 y RF-27 (misma regla, dos sitios). Queda solo lo que no vive en
ningún otro sitio.

| ID | Prioridad | Requisito |
|---|---|---|
| RF-56 | V2 | Interfaz para la venta restringida (ocultar por defecto, interruptor, etiqueta). **Aplazado:** el servicio REST devuelve `P` en las 11.519 estaciones de España, porque la venta restringida es un fenómeno del gasóleo B, que no está en la v1. Ver `docs/04-fuente-datos.md`. El dato se normaliza igualmente y el filtro silencioso se mantiene. |

### Encontrabilidad (v1)

Esta sección sustituye a una "Encontrabilidad" anterior (RF-70 a RF-75) que
decía casi lo mismo con menos precisión; se retiró para no mantener dos
copias. RF-74 sí decía algo que no está aquí (el enlace desde la zona hacia
sus municipios, no solo entre municipios), así que se queda, con su mismo
número.

| ID | Prioridad | Requisito |
|---|---|---|
| RF-60 | M | Página estática por municipio con un mínimo de estaciones. Por debajo de ese mínimo no se genera página propia: la URL da 404 (ver [ADR-0012](adr/0012-municipio-sin-pagina-404.md); esa URL no la enlaza ninguna otra página del sitio). |
| RF-61 | M | Los precios están en el HTML servido, nunca inyectados solo por JavaScript. |
| RF-62 | M | Título y descripción generados con el precio mínimo real y la hora de actualización. |
| RF-63 | M | JSON-LD con `ItemList` de `GasStation` y su `Offer`. Todo lo declarado coincide con lo visible en la página. |
| RF-64 | M | `sitemap.xml` con `lastmod`, regenerado en cada despliegue. |
| RF-65 | M | Enlazado interno entre municipio, municipios vecinos y provincia. |
| RF-66 | M | Imagen `og:image` generada en el build por municipio, con el precio más barato del día y el nombre del municipio. |
| RF-74 | M | Enlazado interno entre zona, sus municipios y los municipios vecinos. Ninguna página queda huérfana. |

### Zona inicial (v1)

RF-70 se retiró de aquí: decía lo mismo que RF-49, palabra por palabra.

| ID | Prioridad | Requisito |
|---|---|---|
| RF-71 | M | El selector de zona es una pantalla de primer nivel, no un menú de rescate: zonas frecuentes arriba, búsqueda por nombre, áreas de pulsación grandes. |
| RF-94 | M | El precio que acompaña a cada municipio, tanto en el bloque de municipios de una página de zona como en el de vecinos de una página de municipio, es el del combustible seleccionado. Si ese municipio no vende ese combustible, se dice que no vende; nunca se muestra el precio de otro. |
| RF-95 | M | Las páginas de zona se sirven en el slug del nombre de la zona. Las comunidades autónomas cuyo slug colisiona con el de una provincia van bajo `/comunidad/{slug}/`; la provincia conserva el nombre limpio. Ver [ADR-0018](adr/0018-urls-de-zona-por-nombre.md). |
| RF-96 | M | Las 71 URLs de zona anteriores responden con 301 hacia la nueva, mediante reglas exactas generadas en `public/_redirects`. Nunca un comodín. Ver [ADR-0018](adr/0018-urls-de-zona-por-nombre.md). |

### Páginas editoriales (v2)

| ID | Prioridad | Requisito |
|---|---|---|
| RF-97 | V2 | `/hoy/provincias-mas-baratas/` responde en una sola página qué provincias tienen menor precio medio para cada uno de los cuatro combustibles. No se generan cuatro variantes por combustible. Para cada combustible se ven de entrada las diez primeras provincias; las restantes siguen en el HTML servido y se muestran dentro de un `<details>` nativo, sin JavaScript y sin repetir el top 10. Canarias, Ceuta y Melilla no entran en los rankings nacionales y aparecen siempre en una tabla aparte completa. |
| RF-98 | V2 | `/hoy/cuanto-te-juegas/` muestra, por provincia y combustible, la diferencia entre la estación más barata y la media de la provincia, expresada en euros para un depósito de 50 litros. La presenta como el ahorro posible al elegir la más barata frente al precio medio y responde cuánto se puede ahorrar al llenar el depósito. Canarias, Ceuta y Melilla no entran en los rankings nacionales y aparecen en una tabla aparte. |
| RF-99 | V2 | `/hoy/marcas-mas-baratas/` muestra la media por rótulo y combustible, junto al número de estaciones de cada rótulo, como comparación no geográfica. El ámbito analizado es península y Baleares; solo entran rótulos con un mínimo de 100 estaciones en ese ámbito. La página dice en texto visible que el umbral es 100 y cuántas estaciones quedan fuera del ranking; con los datos actuales entran 12 rótulos y quedan fuera unas 4.900 de las 10.993 estaciones. La página ordena rótulos, no empresas ni grupos empresariales: lo escrito en el cartel, de acuerdo con «el precio de pantalla es el precio del cartel» de `docs/05-diseno.md`. MOEVE y CEPSA aparecen por separado porque hoy son dos carteles distintos en la calle, aunque sean la misma compañía en pleno cambio de marca; PETRONOR y CAMPSA aparecen separados de REPSOL por el mismo motivo. La propia página lo explica en una línea para dejar claro que es deliberado. No existe una tabla de equivalencias entre marcas: exigiría trabajo recurrente y cambiaría cada pocos meses conforme avance el cambio de marca. Los rótulos se agrupan por coincidencia literal después de recortar espacios al principio y al final; no se normalizan mayúsculas ni tildes, porque los datos actuales no presentan variantes por ninguna de las dos. Canarias, Ceuta y Melilla quedan fuera del cálculo nacional y aparecen en una tabla aparte. |
| RF-100 | V2 | `/hoy/capitales-de-provincia/` compara la media de las 52 capitales de provincia y enlaza a las 52 páginas de municipio. Una tabla fija escrita a mano una sola vez contiene los 52 nombres y los empareja verbatim contra el catálogo del ministerio, conforme a RF-76. Si un nombre no casa, el build falla e indica cuál no ha encontrado; nunca omite una capital en silencio. Canarias, Ceuta y Melilla no entran en los rankings nacionales y aparecen en una tabla aparte. |
| RF-101 | V2 | `/hoy/la-mas-barata-de-espana/` muestra, para cada combustible, el mínimo nacional y el mínimo de cada comunidad, con el municipio de origen visible y enlace a su página. Si el municipio no genera página propia por el umbral de RF-60, el enlace lleva a su provincia, donde aparece la estación; no se excluye el mínimo ni se crea una URL municipal excepcional. Canarias, Ceuta y Melilla no entran en el ranking nacional y aparecen en una tabla aparte. |
| RF-102 | V2 | `/hoy/canarias-ceuta-melilla/` contiene, para cada combustible, un ranking completo de Las Palmas, Santa Cruz de Tenerife, Ceuta y Melilla. Su único párrafo fijo redactado a mano dice: «Los precios de Canarias, Ceuta y Melilla se presentan por separado porque su fiscalidad de carburantes no es la misma que en Península y Baleares. Canarias aplica un impuesto autonómico específico sobre los combustibles derivados del petróleo; Ceuta y Melilla aplican el IPSI y pueden gravar los carburantes con un complemento propio. Por eso una diferencia de precio no refleja solo competencia o costes comerciales: también incorpora regímenes tributarios distintos». |
| RF-103 | V2 | Todas las editoriales usan una plantilla de documento HTML y CSS, sin mapa, `AppInteractiva`, MapLibre, hoja ni selector; se desplazan y se regeneran enteras en cada build. La cabecera muestra una cifra por cada uno de los cuatro combustibles: Gasolina 95 y Diésel comparten la jerarquía principal; Gasolina 98 y Diésel premium se muestran con jerarquía secundaria, nunca se ocultan. La metodología se resume siempre a la vista en una línea y su explicación completa vive en un `<details>` nativo; no se oculta ni se carga mediante JavaScript. Toda media es simple por estación y combustible, excluye del divisor los valores `null` y nunca los convierte en cero. Toda cifra agregada muestra el número de estaciones sobre el que se calcula. Si el agregado tiene un origen geográfico único, enlaza a su página de municipio o zona; si es no geográfico, como la media nacional por rótulo de RF-99, muestra en su lugar el ámbito analizado y la metodología, sin atribuirlo falsamente a un territorio. Los rankings comparan los precios con los tres decimales del ministerio; los empatados comparten posición y se ordenan alfabéticamente. Ver [ADR-0019](adr/0019-paginas-editoriales-sin-aplicacion.md). |
| RF-104 | V2 | Cada editorial enlaza hacia páginas de zona o municipio y todas las páginas de aplicación contienen, en un acceso «Hoy» de su cabecera, un enlace HTML real a cada editorial. El acceso es un panel independiente del selector territorial: compacto en escritorio y de ancho completo bajo la cabecera en móvil. Ninguna editorial depende solo del sitemap y ningún directorio cuelga debajo del mapa. Ver [ADR-0017](adr/0017-jerarquia-de-enlaces.md), [ADR-0019](adr/0019-paginas-editoriales-sin-aplicacion.md) y [ADR-0020](adr/0020-navegacion-en-paneles-dentro-de-la-aplicacion.md). |
| RF-105 | V2 | Las seis rutas editoriales bajo `/hoy/` figuran en `sitemap.xml`; su array de rutas se mantiene a mano en `src/pages/sitemap.xml.ts`. |
| RF-106 | V2 | Las seis editoriales comparten una única plantilla de `og:image`, generada en el build, con el título de la página y dos cifras de cabecera al mismo nivel: Gasolina 95 y Diésel. Debajo de cada cifra aparece su origen: provincia, capital, rótulo o municipio según la pregunta que responde la editorial. Gasolina 98 y Diésel premium permanecen en la página, pero no entran en la imagen. Cada página tiene su imagen propia, pero no un diseño propio. Estas imágenes son distintas de las indexadas por zona o municipio de RF-66. |
| RF-107 | V2 | Los documentos editoriales terminan en un pie compartido que identifica Surtidor y la fuente oficial de los datos, enlaza a la portada y a todas las editoriales ya publicadas. Es HTML y CSS, forma parte de la plantilla de documento y no se añade a las páginas de aplicación de zona o municipio. |

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
| RNF-15 | M | Una zona completa no supera los 300 KB comprimidos de datos de estaciones. Por encima, se sirve un resumen con solo coordenadas y el combustible elegido. El resumen nacional de V2-18 no es una zona ni contiene estaciones: tiene un presupuesto propio de 10 KB comprimidos. |
| RNF-13 | M | El navegador nunca descarga datos de estaciones de provincias fuera de la zona mostrada. Un fichero ya descargado se reutiliza entre zonas que lo compartan. V2-18 puede descargar un único resumen nacional de build con nombre, centroide y agregados por provincia, nunca los 52 ficheros provinciales. |
| RNF-14 | S | El mapa mantiene 30 fps al desplazarlo con 400 marcadores en pantalla y con las 52 pastillas provinciales de V2-18. |

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
| RNF-43 | M | **El build aborta si algún fichero de `public/data/` lleva `"mock": true`.** Los datos de prueba y los reales comparten ruta y son indistinguibles a simple vista; sin esta guarda es posible desplegar precios inventados a producción. |
| RNF-44 | M | Los datos mock se escriben con una marca visible también en la interfaz: si la aplicación carga datos con `mock: true`, muestra un aviso permanente. |
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
| V2-04 | ~~Perfil de vehículo persistente en `localStorage`.~~ **Descartado:** añade configuración y su persistencia no cruza navegadores o dispositivos. |
| V2-05 | ~~Coste del desvío basado en el perfil de vehículo.~~ **Descartado** junto con V2-04; una futura estimación sin perfil requeriría una propuesta independiente. |
| V2-06 | ~~Comparar en euros por 100 km mediante el consumo guardado.~~ **Descartado** junto con V2-04. |
| V2-08 | Detección de precio congelado: estaciones que llevan días sin actualizar. |
| V2-09 | Favoritos fijados arriba, en `localStorage`. |
| V2-10 | **Completado.** Seis páginas editoriales automáticas bajo `/hoy/`, conforme a RF-97 a RF-107. |
| V2-11 | Publicar los JSON normalizados como datos abiertos, con su documentación. |
| V2-12 | Combustibles adicionales, empezando por gasóleo B. |
| V2-13 | Ordenar por distancia con geolocalización concedida. |
| V2-14 | ~~PWA con la última zona en caché para uso sin conexión.~~ **Descartado**, ver [ADR-0013](adr/0013-pwa-sin-conexion-descartada.md). |
| V2-16 | ~~El mapa decide la zona mostrada.~~ **Descartado**, ver [ADR-0015](adr/0015-el-mapa-manda-abandonado.md). |
| V2-17 | ~~Estado personalizado con `?zonas=NN,NN`.~~ **Descartado**, ver [ADR-0015](adr/0015-el-mapa-manda-abandonado.md). |
| V2-18 | **Completado.** Vista nacional: por debajo de zoom 8 las estaciones se sustituyen por pastillas provinciales neutras con nombre, precio medio del combustible elegido y número de estaciones de la media, ancladas al centroide de las estaciones públicas. La vista vuelve a racimos o estaciones al alcanzar zoom 8,5. Ver [ADR-0015](adr/0015-el-mapa-manda-abandonado.md) y [ADR-0022](adr/0022-resumen-nacional-de-build.md). |

### Detalle verificable de V2-18

- **V2-18.1.** La entrada en la vista nacional ocurre por debajo de zoom 8 y
  la salida al alcanzar zoom 8,5. La franja de histéresis conserva el modo
  anterior para impedir alternancias. Los dos valores son constantes ajustables
  después de probarlos en navegador real; nunca se deducen del encuadre ni
  cambian la zona cargada.
- **V2-18.2.** Cada pastilla muestra el nombre oficial verbatim, la media simple
  del combustible activo y «{n} estación/estaciones». Solo entran estaciones
  públicas que venden ese combustible: `null` no suma ni divide y nunca es cero.
- **V2-18.3.** Si ninguna estación pública de la provincia vende el combustible,
  la pastilla dice «No vende {combustible} · 0 estaciones» y no muestra un precio
  ni un color que lo sugiera.
- **V2-18.4.** Las pastillas son cromáticamente neutras. ADR-0003 no se extiende
  a una escala nacional y Canarias, Ceuta y Melilla se muestran en el mapa en su
  posición geográfica real.
- **V2-18.5.** El centroide es la media de las coordenadas de todas las estaciones
  públicas de la provincia, con independencia del combustible y del filtro de
  abiertas. Puede caer en el mar en territorios insulares: representa al
  conjunto, no una estación ni una capital.
- **V2-18.6.** Pulsar una pastilla es una elección territorial explícita:
  selecciona la provincia como zona, actualiza la URL y la aplicación por el
  flujo de RF-88, carga solo su JSON y encuadra sus estaciones. Desplazar o
  ampliar el mapa sin pulsarla nunca cambia la zona.
- **V2-18.7.** El filtro «Solo abiertas» no modifica las medias ni sus `n`. El
  selector territorial conserva la zona cargada mientras se observa el resumen
  nacional.
- **V2-18.8.** Las pastillas que colisionan pueden ocultarse. Ganan, en este
  orden: la que tiene foco, las provincias con dato de menor media y las
  provincias sin dato; los empates se resuelven por identificador oficial. El
  resultado es determinista y no cambia por el orden de recorrido.
- **V2-18.9.** Cada provincia conserva el mismo nodo del DOM identificado por su
  ID oficial al desplazar, cambiar de combustible y entrar de nuevo en la vista.
  Un gesto no regenera las 52 pastillas ni intercambia identidades.
- **V2-18.10.** Cada pastilla visible es un botón operable con teclado, con foco
  visible, área mínima de 44 × 44 px y etiqueta accesible que anuncia nombre,
  combustible, media, `n` y la acción. Una pastilla oculta por colisión no entra
  en el orden de tabulación.
- **V2-18.11.** `prefers-reduced-motion` elimina animaciones y convierte el
  acercamiento en un salto inmediato. El cambio de combustible nunca mueve el
  centroide.
- **V2-18.12.** La vista usa un resumen nacional generado en el build y de menos
  de 10 KB comprimidos. Nunca descarga los 52 JSON provinciales. Si el resumen o
  MapLibre falla, la lista, ficha, filtros y cambio de zona siguen funcionando.

## Requisitos de la v3

Los identificadores se conservan al mover de versión: son permanentes y no se
renumeran ni se reutilizan.

| ID | Requisito |
|---|---|
| V2-03 | "¿Lleno hoy o el martes?": día de la semana de media más barato en esa provincia, con la ventana temporal usada. |
| V2-07 | Filtro por carretera principal, con la distancia de cada estación a cada vía precalculada en el build. |
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
