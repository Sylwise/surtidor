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

El objetivo no es estar completo, es **estar en línea y ser mejor que lo que hay**.
Cada hito en su rama, en este orden. Los datos primero y el mapa después: es la
pieza que más falla y la que menos aporta al principio.

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
más `indice.json` con los catálogos de provincias, municipios y zonas. Escritura
atómica: fichero temporal y renombrado. Si falla cualquier provincia, sale con
código distinto de cero y no toca nada.

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

# V2 · Ya pensado, esperando

Nada de esto entra hasta que la v1 esté publicada y con gente usándola. El orden
es de valor aparente, y la gente lo va a reordenar.

**Coste del desvío.** Si la barata está a 9 km, ese desvío gasta gasolina.
Ahorro neto = ahorro bruto − (km extra × consumo × precio). Con 20 litros y tres
céntimos de diferencia muchas veces sale que **no** compensa, y decirlo es más
útil que ocultarlo.

**Perfil de vehículo.** Consumo a los 100 y combustible habitual, en
`localStorage`. Convierte el coste del desvío en exacto y desbloquea comparar en
euros por 100 km, que es la unidad real de lo que cuesta conducir.

**Favoritos.** Marcar tus tres habituales y verlas fijas arriba. Barato, y es el
90 % del uso real de un conductor cotidiano.

**Ordenar por distancia** con geolocalización concedida (RF-26).

**Vista nacional por provincias.** Al alejar el zoom, las estaciones dan paso a
una pastilla por provincia con su precio medio, en el centro de sus
gasolineras. Es la vista que responde a "dónde está barato", que es lo único
que se puede preguntar cuando cabe España entera en la pantalla. Ver
[ADR-0015](adr/0015-el-mapa-manda-abandonado.md).

Se intentó además que la vista del mapa decidiera la zona cargada, y se
abandonó tras implementarlo. El porqué, en el mismo ADR.

**Precio congelado.** Algunas dejan de actualizar para parecer baratas. Con el
histórico se detecta si lleva días sin moverse y se marca. Genera confianza
porque nadie más lo cuenta.

**Tendencia respecto a ayer.** Flecha arriba o abajo, del endpoint histórico.

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

**Páginas editoriales automáticas.** "Las provincias más baratas de España hoy",
"la gasolinera más barata del país ahora mismo". Se generan solas con los datos
que ya hay, se actualizan cada dos horas, cero mantenimiento, e imanes de enlaces.

---

# V3 · Ambicioso, todavía sin servidor

**Cuándo repostar.** Todo lo anterior responde a "dónde"; nada a "cuándo". Con un
resumen diario guardado por provincia —unos pocos kilobytes al día— se puede
decir *"en los últimos seis meses el martes ha sido de media 2,1 céntimos más
barato en Álava"*. Nadie da ese dato y se comparte solo.

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
