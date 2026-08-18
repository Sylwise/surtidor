# 06 · Roadmap por versiones

Tres versiones y una lista de exclusiones. El criterio que las separa no es la
ambición: es que **la v1 sea publicable**.

Regla que gobierna todo el documento: **ninguna función de ninguna versión
requiere un servidor.** Todo es estático o se calcula en el navegador. Lo que no
cabe ahí está en "Fuera del proyecto" y ahí se queda.

Segunda regla, y pesa igual: **una función que estropea la interfaz no entra**.
Hay veinte cosas en cola y el modo de fallo de este proyecto no es quedarse
corto, es acabar pareciéndose a lo que quería sustituir. Ver el apartado
"Presupuesto de interfaz" en `docs/05-diseno.md`.

---

# V1 · Publicable

**Estado: terminada y publicada.** El objetivo no era estar completo, sino estar
en línea y ser mejor que lo que había. Los hitos siguientes conservan el orden y
los criterios con los que se construyó la v1; ya no son una cola de trabajo.

## H1 · Andamiaje

Proyecto Astro con TypeScript. `npm run dev`, `build`, `check` funcionando.
`tokens.css` con todos los tokens de `docs/05-diseno.md`. Sin contenido.

**Terminado cuando:** `npm run build` genera un `dist/` bien tipado.

## H2 · Cliente de la API del MITECO

`scripts/lib/miteco.ts`. Cabecera `Accept: application/json`, timeout de 30 s, 3
reintentos con espera creciente, comprobación de `ResultadoConsulta === "OK"`.
Esquemas `zod`: si la API cambia los nombres de campo, esto revienta de forma
ruidosa (RNF-41).

**Terminado cuando:** descarga Álava (`01`) y reporta el número de estaciones.

## H3 · Normalizador

`scripts/lib/normalizar.ts`. De la respuesta cruda al contrato de
`docs/03-arquitectura.md`. Con pruebas: `"1,479"` → `1.479`; `""` → `null`
(**jamás `0`**); `"-2,671600"` → `-2.6716`; claves escapadas `_x0020_`; estación
sin coordenadas descartada y contada.

Aquí entra también el campo **`Tipo Venta`**: `P` es público y `R` restringido
(cooperativas y flotas, donde el usuario no puede repostar). Las `R` se marcan,
no se borran.

**Terminado cuando:** las pruebas pasan y ninguna estación de Álava sale con
precio `0`.

## H4 · Intérprete de horarios

`scripts/lib/horario.ts`. Casos con prueba: `L-D: 24H`; `L-V: 06:00-22:00; S:
08:00-14:00`; cierre pasada medianoche; rango de días que da la vuelta a la
semana (`V-L`); campo vacío o ininteligible devuelve abierta.

**Terminado cuando:** las pruebas pasan, incluidos los casos raros.

## H5 · Generación de datos

`scripts/descargar-datos.ts`. Las 52 provincias a `public/data/provincias/NN.json`
más `indice.json` con los catálogos de provincias y zonas. El catálogo de
municipios vive en `datos-build/municipios.json`: solo lo consume el build y no
se despliega. Escritura atómica: fichero temporal y renombrado. Si falla
cualquier provincia, sale con código distinto de cero y no toca nada.

Más `scripts/datos-mock.ts` para desarrollar sin salida a internet.

**Terminado cuando:** 52 ficheros válidos y el mayor por debajo de 100 KB
comprimido (RNF-12).

## H6 · Lista, ficha y controles

Toda la interfaz **menos el mapa**. Lista ordenada, ficha con los cuatro
combustibles, selector de combustible, selector de zona, filtro de abiertas,
persistencia en `localStorage`.

`src/logica/zona.ts`: carga en paralelo de las provincias de la zona, fusión y
fallo parcial (RF-36). Prueba obligatoria con Euskadi, que son tres.

Incluye tres cosas de V1 que viven aquí:

- **Litros a repostar** (no "depósito": casi nadie llena desde vacío). Con las
  dos cifras: lo que cuesta aquí y lo que costaría en la más cara, y el ahorro
  como número grande.

Nota: los **descuentos por marca están descartados**, no aplazados. El motivo,
con números, en [ADR-0009](adr/0009-descuentos-en-el-dispositivo.md). Resumen: la
brecha entre las low-cost y las de marca ronda los 30 céntimos por litro y el
descuento son cinco, así que no mueve la cabeza de la lista.
- **Estaciones de venta restringida** excluidas en silencio (RF-48). Sin
  interfaz: el servicio devuelve `P` en las 11.519 estaciones de España, porque
  la venta restringida es un fenómeno del gasóleo B, que llega en la v2. Un
  control que no puede activarse nunca no ocupa hueco en la cabecera. El
  interruptor y la etiqueta son RF-56, aplazados.
- **Botón de cómo llegar** (RF-27, RF-28).
- **De qué lado de la carretera está** (RF-29), a partir del campo `Margen`. Un
  icono pequeño en la ficha. Comparte causa raíz con `Tipo Venta`: los dos campos
  se pierden en el mismo punto del normalizador, así que se arreglan juntos.

**Terminado cuando:** la aplicación es útil de verdad sin una sola línea de
código de mapa. Este es el hito importante.

## H7 · Estados de error y vacío

Los casos de la tabla de `docs/05-diseno.md`. Provocarlos a mano: cortar la red,
corromper un JSON, filtrar hasta dejarlo vacío, datos de más de 6 h.

**Terminado cuando:** ningún camino de fallo deja la pantalla en blanco ni un
indicador de carga que no se resuelva.

## H8 · El mapa

MapLibre como dependencia npm, **nunca por CDN**. Tiles de OpenFreeMap,
`positron`. Marcadores del DOM con agrupación y colisiones propias (ADR-0006).
`fitBounds` al cargar (RF-19). Botón de ubicación que solo pide permiso al
pulsarlo.

Degradación: si MapLibre o los tiles no cargan, el hueco lo explica y el resto
sigue vivo.

**Terminado cuando:** funciona con mapa, y sigue funcionando entero con el mapa
bloqueado en las herramientas de desarrollo.

## H9 · Despliegue

`.github/workflows/datos.yml` con `schedule` cada dos horas y `push` a `main`.
Descarga, build y `wrangler pages deploy`. Si la descarga falla, para antes de
desplegar.

**Terminado cuando:** está en línea, los datos se refrescan solos, y una caída
simulada del ministerio no tumba lo publicado.

## H10 · SEO: páginas por municipio

El activo de captación del proyecto. No se pelea por "gasolina barata" a nivel
nacional: eso está copado. Se pelea por **"gasolineras baratas en
Vitoria-Gasteiz"**, y por las 500-800 variantes municipales con volumen real.

- Una página estática por municipio con volumen suficiente, más las 52 de
  provincia y las de comunidad.
- Título y descripción **generados con el dato real y fresco**: "Gasolina 95
  desde 1,549 €/L en Vitoria-Gasteiz · actualizado hoy a las 11:00". Un fragmento
  con precio y hora se clica mucho más que uno genérico.
- JSON-LD con `ItemList` de `GasStation` y su `Offer`. No da estrellitas en
  Google, pero hace los datos legibles por asistentes y buscadores con IA. Todo
  lo que vaya en el JSON-LD **tiene que coincidir con lo visible en la página**.
- `sitemap.xml` con `lastmod` regenerado en cada despliegue. Con datos que
  cambian cada dos horas, esa frescura es una señal regalada.
- Enlazado interno: zona → municipios → municipios vecinos. Sin eso, las 800
  páginas quedan huérfanas.

**Terminado cuando:** las páginas se generan estáticas, comparten datos sin
duplicarlos, y el sitemap está enviado en Search Console.

## H11 · Imagen de compartición

Una imagen generada en el build por municipio, con el precio más barato del día
y el nombre del pueblo, como `og:image`. Cuando alguien pegue el enlace en
WhatsApp aparece el dato en vez de un rectángulo gris.

Es de lo que más multiplica la difusión por lo poco que cuesta, y en España el
canal es WhatsApp.

**Terminado cuando:** el enlace de un municipio, pegado en WhatsApp y en
Telegram, muestra la tarjeta con el precio.

---

# V2 · Ya pensado, en curso

La v1 ya está publicada. El orden es de valor aparente y la gente lo va a
reordenar. V2-10, V2-13 y V2-18 están terminados; los demás estados se declaran
de forma explícita a continuación.

**Perfil de vehículo, coste del desvío y euros por 100 km — descartados.** Pedir
consumo y combustible habitual añade configuración antes de aportar valor. En
una aplicación sin cuentas esos datos solo pueden guardarse en el navegador:
no cruzan dispositivos o navegadores y desaparecen al limpiar sus datos. V2-04,
V2-05 y V2-06 se cierran como conjunto; una posible estimación futura sin perfil
se evaluaría desde cero.

**Favoritos — V2-09, descartados.** Una colección de favoritos se percibe como
un dato personal duradero, pero `localStorage` no cruza navegadores o dispositivos
y puede desaparecer. Darle continuidad exigiría cuentas y sincronización, ambas
fuera del proyecto. Ver [ADR-0023](adr/0023-evolucion-contextual-sin-perfil.md).

**Ordenar por distancia — V2-13, terminada.** Al pulsar «Mi ubicación», el mapa muestra la
posición aproximada del usuario y la lista pasa a cercanía con la distancia
geográfica de cada estación. Se puede volver a precio sin pedir permiso otra
vez. Posición y modo de orden son efímeros y nunca salen del dispositivo.

**Vista nacional por provincias — V2-18, terminada.** Al alejar el zoom, las
estaciones dan paso a una pastilla por provincia con su precio medio, en el
centro de sus gasolineras. Es la vista que responde a "dónde está barato", que es lo único
que se puede preguntar cuando cabe España entera en la pantalla. Ver
[ADR-0015](adr/0015-el-mapa-manda-abandonado.md) y
[ADR-0022](adr/0022-resumen-nacional-de-build.md). Entra por debajo de zoom 8
y sale al alcanzar 8,5; usa un resumen de build menor de 10 KB comprimidos, no los
52 ficheros provinciales. Las pastillas son neutras, muestran siempre la media y
su número de estaciones, conservan identidad por provincia y al pulsarlas
seleccionan explícitamente esa zona y encuadran sus estaciones. Canarias, Ceuta
y Melilla permanecen en el mapa en su posición real.

V2-18 está publicada con pruebas para la media con `null`, la provincia sin
datos, los cuatro combustibles y la histéresis alrededor de ambos umbrales. Las
colisiones son estables al desplazar, los nodos DOM se reutilizan y la selección
de zona funciona por pulsación, teclado y con movimiento reducido. El resumen
cumple su presupuesto; tanto su fallo como el de MapLibre dejan operativa la
aplicación sin mapa.

Se intentó además que la vista del mapa decidiera la zona cargada, y se
abandonó tras implementarlo. El porqué, en el mismo ADR.

**Evolución e histórico — V2-01, V2-02 y V2-08, completado.** El
histórico deja de ser una flecha aislada y se convierte en una capacidad común
dentro de Hoy. Desde una estación, municipio o zona explica cuánto ha cambiado
el precio, durante qué periodo y si el movimiento también ocurre en su entorno.

La entrega cubre el contrato de 90 días, la recuperación entre despliegues, los
artefactos provinciales, las lecturas de provincia y municipio, la comparación
estación ↔ municipio ↔ provincia, los rankings territoriales, los cuatro
periodos, la estabilidad observada y la tabla accesible. La ficha ofrece un
indicio compacto junto al precio; el análisis completo vive fuera de la
aplicación de mapa. La revisión final queda registrada en
[08 · Evolución](08-evolucion.md#registro-de-aceptación--2026-08-17).

La primera entrega incluye cambios a 1, 7, 30 y 90 días, gráfica de 90 días por
estación, comparación con municipio y provincia, evolución de media y mínimo y
mayores subidas y bajadas del territorio. V2-08 se expresa de forma neutral como
«sin cambios detectados desde hace N días»: los datos no permiten atribuir una
intención a la estación.

La experiencia es contextual, no personalizada. Parte de la URL, la ficha, el
combustible y, si se ha concedido, una ubicación efímera. No guarda lugares
habituales ni necesita permiso de ubicación. Ver
[08 · Evolución](08-evolucion.md) y
[ADR-0023](adr/0023-evolucion-contextual-sin-perfil.md).

La ventana es móvil y está limitada a 90 días cerrados. No se conserva ni se
publica un histórico anual: Evolución aporta certidumbre sobre cambios recientes,
no sirve estudios de mercado.

**Más combustibles.** Gasóleo B (agrícola, con demanda real en Álava rural y mal
atendido), GLP, GNC. El normalizador ya no debe romperse con campos nuevos.

Cuando entre el gasóleo B, **entra con él RF-56**: es el único combustible donde
la venta restringida existe de verdad, así que el interruptor y la etiqueta de
"restringida" pasan a tener sentido. El filtro silencioso y sus pruebas ya están
escritos desde la v1, solo hay que darles interfaz.

**API pública.** Los 52 JSON normalizados son bastante más usables que la API del
ministerio. Publicarlos como API abierta documentada no cuesta un euro más y trae
enlaces desde repositorios y foros técnicos, que es el tipo de enlace que Google
valora.

**Páginas editoriales automáticas — V2-10, terminado.** Seis documentos bajo
`/hoy/`, generados con los datos de cada build, enlazados desde la aplicación y
con imagen de compartición propia. Ver RF-97 a RF-107 y ADR-0019.

---

# V3 · Ambicioso, todavía sin servidor

**Cuándo repostar.** Todo lo anterior responde a "dónde"; nada a "cuándo". Con un
resumen diario guardado por provincia —unos pocos kilobytes al día— se puede
decir *"en los últimos seis meses el martes ha sido de media 2,1 céntimos más
barato en Álava"*. Antes de entrar debe demostrarse que el patrón es estable,
declarar la ventana y el tamaño de muestra y evitar presentarlo como predicción.

**Filtro por carretera.** "Voy de Vitoria a Burgos, dónde reposto." La ruta de
verdad es cara; el atajo es **precalcular en el build la distancia de cada
estación a cada carretera principal** y convertir "voy por la A-1" en un filtro.
Estático, gratis, y cubre el 90 % de los casos.

**Puntos de recarga eléctrica.** Misma familia de servicios y misma clase de
fuente pública.

---

# Fuera del proyecto

No es "algún día". Es que no.

**Alertas por precio.** "Avísame cuando baje de 1,45." Exige guardar
suscripciones y enviar notificaciones: servidor, base de datos y factura. Es la
primera función que rompe el ADR-0001 y cambia la naturaleza del proyecto.

**Cuentas de usuario.** Todo se guarda en el dispositivo. Sin cuentas no hay
sesiones, ni contraseñas, ni brechas, ni RGPD.

**Precios introducidos por la comunidad.** Exige moderación, y la moderación
exige servidor y tiempo. La fuente oficial es obligatoria por ley y suficiente.

**Anuncios.** Es el motivo por el que existe el proyecto.

**Sincronización entre dispositivos.** Consecuencia de no tener cuentas. Se
asume.

**PWA con funcionamiento sin conexión.** Descartada, no aplazada. Sin conexión
no hay precio fresco, y un precio que no es el del cartel no sirve para decidir
dónde repostar. Además es el único componente que no se corrige desplegando.
El motivo completo, en [ADR-0013](adr/0013-pwa-sin-conexion-descartada.md).

---

## Ideas sin evaluar

Recogidas el 8 de agosto de 2026. No están comprometidas, no tienen
requisito ni versión asignada, y varias se solapan con lo ya planificado.
Se anotan para no perderlas. Son un registro fechado, no una descripción del
estado actual; antes de promover una hay que contrastarla de nuevo con el código
y los requisitos vigentes.

**Forman parte del diseño de Evolución y se priorizarán después de su primera
entrega:**

- "¿Está barato ahora?": situar el precio actual frente a su propia media
  histórica, en porcentaje.
- Cambios desde ayer o desde la semana pasada, en céntimos, mostrando el
  precio anterior junto al actual.
- "Las ganadoras del día": ranking de las mayores bajadas y subidas.
- Precio medio del municipio comparado en porcentaje con el de su
  provincia.
- "Semáforo nacional" en la portada: medias de España, evolución a 30 días
  y comunidades más baratas.

**Depende del histórico y además del calendario:**

- "Récord histórico": aviso cuando un precio se acerca al mínimo de los
  últimos doce meses. Necesita doce meses de datos guardados, o que el
  ministerio publique el pasado.

**Dependen de la ubicación del usuario y cuestan interfaz:**

- "¿Merece la pena ir?": cruzar ubicación, precio y distancia para decir si
  el ahorro compensa el desplazamiento, sin exigir perfil de vehículo.
- "La mejor gasolinera para ti": puntuación que combina precio y distancia,
  distinta de la más barata a secas.
- Gráfico de dispersión de ahorro frente a distancia, cada estación un
  punto.
- El municipio más barato cerca del usuario.

**Se solapan con cosas ya planificadas o ya hechas, comprobar antes:**

- Preferencia de combustible persistente. **Ya implementada:** `estado.ts`
  guarda combustible junto a zona y litros.
- Indicador de frescura del dato. **Ya implementado:** la interfaz muestra la
  hora y avisa cuando los datos superan seis horas.
- Detección de precios anómalos. Los cambios y la falta de variación ya forman
  parte de Evolución; cualquier alerta adicional necesitará una regla explicable
  y no atribuirá intenciones.
