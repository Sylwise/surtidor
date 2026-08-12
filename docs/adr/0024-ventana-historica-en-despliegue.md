# ADR-0024 · La ventana histórica se transporta en el despliegue estático

**Fecha:** 2026-08-10 · **Estado:** aceptado

## Contexto

Evolución necesita 90 días cerrados para unas 11.600 estaciones. La fuente
oficial permite reconstruir cualquier fecha al menos desde 2007, pero consultar
90 respuestas en cada uno de los doce builds diarios repite trabajo y carga al
Ministerio. Guardar una instantánea nueva en Git cada día mantiene el coste
monetario cero, pero hace crecer para siempre el historial de un producto que ha
decidido no conservar más de 90 días.

El prototipo normaliza cada día a identidad, territorio y cuatro precios. Las 90
instantáneas ocupan 10.679.206 B comprimidas por separado. Agrupadas por estación,
la ventana nacional completa ocupa 2.040.733 B con `gzip -9` después de añadir
presencia y territorio por día. En la muestra no hubo cambios de provincia o
municipio para un mismo `IDEESS`.

## Decisión

El estado canónico de los últimos 90 días se publica como un artefacto estático
versionado dentro del despliegue de Cloudflare Pages. Es público pero de uso de
build: la interfaz no lo descarga directamente.

El proceso diario recupera el artefacto del despliegue anterior, valida versión,
fechas, identidades y SHA-256, descarga únicamente la instantánea cerrada de
ayer, añade un día y retira el día 91. Después materializa:

- un nuevo estado nacional compacto para el siguiente build;
- artefactos por provincia para estación, municipio y provincia;
- agregados nacionales pequeños que necesiten las páginas de Hoy.

Los builds de precios actuales reutilizan el estado histórico publicado sin
consultar fechas históricas al Ministerio. Si no pueden recuperar un estado
válido, abortan antes de desplegar para no borrar Evolución del sitio publicado.

El primer despliegue y la recuperación ante pérdida reconstruyen los 90 días
desde el Ministerio. Esa operación es excepcional, reanudable e idempotente; no
se ejecuta como camino normal ni se activa automáticamente ante un `404`: exige
el modo explícito `reconstruir_historico` de `workflow_dispatch`.

El workflow tiene una única sección de concurrencia para producción, sin
cancelación del que ya está en curso. `schedule`, `push` y ejecución manual se
serializan para que dos builds no lean el mismo estado y publiquen ventanas en
orden inverso. La actualización ocurre dentro del despliegue ordinario; no añade
una decimotercera ejecución diaria.

«Primer build del día» significa el primer build satisfactorio que detecta que
falta ayer. Puede proceder del cron, de un `push` o de una ejecución manual. Si
ayer todavía no está disponible, conserva el estado anterior con su fecha real y
vuelve a intentarlo dos horas después. Un retraso superior a dos días aborta y
requiere recuperación explícita. Un esquema, checksum o estado corrupto siempre
aborta: solo un fallo temporal al pedir el nuevo día permite conservar la
ventana anterior.

## Motivos

Cloudflare Pages ya sirve todos los artefactos estáticos de Surtidor y no añade
un servicio, proceso permanente o cuenta facturable. Dos megabytes por build son
pequeños frente a reconstruir 90 respuestas y evitan convertir Git en una base
de datos acumulativa.

La fuente oficial sigue siendo la autoridad y permite recuperación. El estado
publicado es una caché materializada y transportable, no la única copia de una
información irreemplazable.

Partir por provincia conserva RNF-13: una persona descarga únicamente el
histórico del territorio consultado. El estado nacional completo queda fuera del
camino del navegador.

## Consecuencias

Buenas: una petición histórica al día, ventana fija, coste monetario cero, Git
sin crecimiento diario y recuperación completa desde la fuente oficial.

Malas: el build depende del despliegue anterior como caché de entrada. El primer
despliegue es más lento y una recuperación exige hasta 90 peticiones. Hay que
evitar que un build ordinario publique el sitio sin copiar los artefactos
históricos válidos.

A vigilar: límites de tiempo del workflow, caché HTTP, rollbacks y cambios
territoriales de una estación. El manifiesto se solicita sin caché y enlaza por
SHA-256 con el estado comprimido; ambos se validan juntos. La ausencia de cambios
territoriales en 90 días es una medición, no una garantía; el contrato conserva
ausencia y territorio por día y los agregados usan el territorio de cada
observación.

El validador de esquema (`validarEstadoHistorico`) acepta a propósito ventanas
de entre 1 y 90 días: lo necesitan las pruebas con ventanas cortas y una
ventana todavía en construcción no es un error de forma. Que la ventana esté
**completa** es una exigencia distinta y se comprueba aparte
(`comprobarVentanaCompleta`), en el punto de publicación real: al terminar
`--reconstruir` y al empezar a materializar los artefactos por provincia. Así,
una reconstrucción que se detiene a mitad de camino —por ejemplo en el día 60
de 90— no escribe nada (la escritura es atómica y ocurre una sola vez, al
final) y tampoco puede llegar a materializarse ni desplegarse como si fuera
una ventana válida.

La implementación medida genera 54 ficheros: manifiesto, estado nacional
comprimido y 52 provincias. Los provinciales suman 3.832.088 B con gzip; la
mediana es 63.322 B, el percentil 95 es 153.624 B y el máximo, Barcelona, 274.725
B. El sitio completo queda en 2.457 ficheros, muy por debajo de los 20.000 del
plan gratuito de Pages.

El enlace estación → municipio añadido al contrato público aumenta el máximo
provincial medido de Barcelona a 274.981 B: 256 B comprimidos. Permite comparar
la estación con su municipio sin publicar otro fichero ni duplicar nombres.

## Alternativas descartadas

- **Una instantánea diaria en Git.** Sencilla y recuperable, pero el historial
  crece unos 43 MB al año según la primera medición aunque la ventana activa rote.
- **Reconstruir 90 días cada día.** Evita estado propio, pero hace 90 peticiones
  y descarga repetidamente datos idénticos.
- **Reconstruir 90 días en cada build.** Multiplica lo anterior por doce y no es
  aceptable como consumidor de una fuente pública.
- **Base de datos o almacenamiento de objetos.** Resuelve persistencia, pero
  añade servicio, credenciales, límites y riesgo de coste antes de demostrar que
  el despliegue estático es insuficiente.
- **Conservar años.** No responde al producto acordado: Evolución aporta contexto
  reciente, no estudios longitudinales.
