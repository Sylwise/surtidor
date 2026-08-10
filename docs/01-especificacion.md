# 01 · Especificación

## El problema

Los precios de los carburantes en España son un dato público y obligatorio: cada
estación de servicio está obligada a declararlos al Ministerio. Ese dato está
disponible gratis y para cualquiera.

Aun así, las webs y apps que lo muestran están llenas de anuncios, piden
registro, o entierran el precio bajo capas de interfaz. El dato es público y la
experiencia de consultarlo es mala.

## La propuesta

Una web que muestre esos mismos precios sobre un mapa legible, sin nada más.

El listón: **de abrir la web a saber dónde repostar, menos de cinco segundos y
sin tocar más de un control.**

## Para quién

**Conductor cotidiano.** Reposta una o dos veces al mes en las mismas tres o
cuatro gasolineras. Quiere confirmar cuál está más barata hoy. Entra desde el
móvil, muchas veces aparcado, a veces con cobertura mala.

**Conductor de paso.** Está de viaje, no conoce la zona, necesita ver qué hay
cerca de su ruta y si merece la pena esperar al siguiente pueblo.

**Curioso de datos.** Quiere ver la evolución de precios o comparar por
provincias. Minoritario, pero es quien comparte el enlace.

No es para: flotas, gestores de repostaje, ni nadie que necesite facturación.

## Alcance por versiones

Hay muchas más ideas que tiempo. La regla que las ordena: **la v1 es lo mínimo
para que esto sea mejor que lo que ya existe y esté publicado.** Todo lo demás
espera a que haya gente usándolo, porque los usuarios reales son mejor consejero
que nosotros especulando.

### v1 — lo que se publica

Núcleo:

- Mapa con todas las estaciones de una **zona** y su precio. Una zona es una
  provincia o una comunidad autónoma.
- Cuatro combustibles: gasolina 95 E5, gasóleo A, gasolina 98 E5, gasóleo premium.
- Ficha de estación con todos sus combustibles, dirección y horario.
- Filtro de abiertas ahora.
- Funciona en móvil y escritorio.

Lo que la hace útil de verdad:

- **Litros a repostar**, con el coste total y el ahorro frente a la más cara.
- **Botón de cómo llegar**, que abra la aplicación de mapas de cada uno.
- **De qué lado de la carretera está**, con el campo `Margen`. En autovía, ocho
  kilómetros hasta el siguiente cambio de sentido convierten una barata en cara.
- **Las de venta restringida se filtran o se marcan.** El campo `Tipo Venta`
  distingue público de cooperativas y flotas. Mandar a alguien a una estación
  donde no puede repostar es peor que no mostrarla.

Lo que la hace encontrable:

- Página estática por municipio, no solo por zona.
- Datos estructurados, sitemap con fecha de modificación, y enlazado interno.
- Imagen de compartición generada con el precio del día.
- La zona inicial se resuelve **sin servidor y sin pedir permisos**: zona
  guardada si vuelve, página de aterrizaje si viene de una búsqueda, y selector
  si es visita directa nueva. Ver [ADR-0008](adr/0008-zona-inicial-sin-servidor.md).

### v2 y futuro

Nada de esto necesita servidor. Algunas funciones ya están terminadas, otras
siguen en cola y otras se descartaron después de probarlas. El estado y el orden
se mantienen en [06 · Roadmap](06-roadmap.md); esta tabla conserva la intención
de producto, no actúa como contabilidad de implementación.

| Función | Qué aporta |
|---|---|
| Histórico y tendencia | Flecha de subida o bajada respecto a ayer |
| "¿Lleno hoy o el martes?" | Patrón semanal por provincia. Nadie más lo cuenta |
| Filtro por carretera | "Voy por la A-1". Distancias precalculadas en el build |
| Precio congelado | Señalar las que dejan de actualizar para parecer baratas |
| Favoritos | Fijar arriba tus tres habituales |
| Páginas editoriales | "Las provincias más baratas hoy", generadas solas (terminado: V2-10) |
| API abierta | Publicar nuestros JSON normalizados. Trae enlaces |
| Gasóleo B y otros | Público pequeño pero muy fiel |
| Ordenar por distancia | Requiere geolocalización concedida (terminado: V2-13) |
| Vista nacional | Resumen provincial al alejar el mapa (terminado: V2-18) |
| PWA sin conexión | Descartada: servir precios antiguos rompe la confianza; ver [ADR-0013](adr/0013-pwa-sin-conexion-descartada.md) |
| Puntos de recarga | Misma familia de servicios |

### Descartado, y no se revisa

- **Alertas por precio.** Exigen guardar suscripciones y enviar notificaciones:
  servidor encendido y base de datos. Es la única función de toda la lista que
  rompe el coste cero. Queda fuera.
- **Cuentas de usuario.** Nada que guardar en servidor.
- **Precios introducidos por la comunidad.** Exige moderación, y la fuente
  oficial ya es obligatoria por ley.
- **Anuncios.** Es el motivo por el que existe el proyecto.
- **Descuentos por marca.** Se propuso y se descartó con números:
  [ADR-0009](adr/0009-descuentos-en-el-dispositivo.md). Los programas de
  fidelización son de las gasolineras caras, así que el descuento no mueve la
  cabeza de la lista.
- **Perfil de vehículo, coste del desvío y euros por 100 km.** Exigen pedir
  datos al usuario y conservarlos solo en el navegador. Añaden fricción al uso
  principal y ofrecen una persistencia demasiado frágil para una configuración
  que el usuario esperaría recuperar en otro navegador o dispositivo.
- **Cualquier cosa que necesite un proceso encendido.** Es el filtro que se
  aplica a toda idea nueva, antes que cualquier otro criterio.

## Casos de uso

### CU-1 · Consultar mi zona

El usuario abre la web. Se le muestra su zona guardada o la zona de la página de
aterrizaje; en una primera visita directa sin historial, se abre el selector.
La geolocalización nunca se solicita al cargar: solo al pulsar «Mi ubicación».
Ve el mapa con los precios del combustible que tenga guardado.

Quien vive en Vitoria-Gasteiz puede elegir su provincia o su comunidad autónoma.
No existen zonas manuales ni agrupaciones territoriales inventadas por el
proyecto; la corrección y sus motivos están en
[ADR-0005](adr/0005-provincia-unidad-y-zonas.md).

La más barata está resaltada. La lista lateral va ordenada de más barata a más
cara. El color se calcula sobre la zona completa, así que dos estaciones de
provincias distintas son directamente comparables.

### CU-2 · Comparar dos gasolineras concretas

El usuario toca una estación. Aparece su ficha con los cuatro combustibles.
Toca otra. Compara. La ficha siempre le dice en qué puesto está esa estación
dentro de la provincia y cuánto se ahorra o se gasta de más.

### CU-3 · Cambiar de combustible

El usuario pulsa una pestaña de combustible. Todos los precios del mapa y de la
lista cambian a la vez. El color se recalcula, porque la escala es relativa a
ese combustible en esa provincia.

### CU-4 · Descartar las cerradas

Es la una de la mañana. El usuario activa "solo abiertas ahora". Desaparecen las
que declaran horario cerrado a esa hora. Las estaciones que no declaran horario
se consideran abiertas, porque es menos malo enseñar una de más que ocultar una
que sí abre.

### CU-5 · Saber si merece la pena desviarse

El usuario indica el tamaño de su depósito una vez y se guarda. En cada ficha ve
cuántos euros se ahorra respecto a la más cara de la provincia. Es la cifra que
convierte una diferencia de céntimos en una decisión.

## Criterios de éxito

| Métrica | Objetivo |
|---|---|
| Coste mensual de infraestructura | 0 € |
| Contenido útil en pantalla | menos de 1 s |
| Peso de la carga inicial (sin tiles) | menos de 150 KB comprimido |
| Cadencia programada de actualización | cada 2 horas; si los datos superan 6 horas, se avisa |
| Funciona sin que cargue el mapa | sí, completo |
| Anuncios, cookies, registro | ninguno |

## No objetivos

- No hay que ser exhaustivo con combustibles minoritarios en la v1.
- No hay que competir en funcionalidad con las apps existentes. Se compite en
  que se abra rápido y no moleste.
- No hay que soportar navegadores sin ES2020.
