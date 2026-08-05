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

## Alcance de la v1

Dentro:

- Mapa con todas las estaciones de una **zona** y su precio. Una zona es una
  provincia, una comunidad autónoma, o una agrupación a medida que cruza
  fronteras administrativas.
- Cuatro combustibles: gasolina 95 E5, gasóleo A, gasolina 98 E5, gasóleo premium.
- Selección de zona, con detección automática por geolocalización opcional.
- Ficha de estación con todos sus combustibles, dirección y horario.
- Filtro de abiertas ahora.
- Cálculo de ahorro en euros según el tamaño del depósito.
- Ordenación por precio y por distancia (si hay geolocalización).
- Funciona en móvil y escritorio.

Fuera de la v1, por orden de probabilidad de entrar después:

- Histórico y gráficas de evolución.
- Alertas por precio.
- Rutas y estaciones a lo largo de un trayecto.
- Puntos de recarga eléctrica.
- Instalación como PWA y funcionamiento sin conexión.

Fuera para siempre: cuentas de usuario, precios introducidos por la comunidad,
anuncios, y cualquier cosa que requiera un servidor encendido.

## Casos de uso

### CU-1 · Consultar mi zona

El usuario abre la web. Se le muestra su zona (recordada de la última visita o,
si es la primera, detectada por geolocalización si la concede, y si no, un
selector). Ve el mapa con los precios del combustible que tenga guardado.

Quien vive en Vitoria-Gasteiz puede tener guardada "Álava", "Euskadi" o "Euskadi
y alrededores", que además de las tres provincias vascas incluye Navarra y
Burgos. La frontera provincial no significa nada para quien conduce.

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
| Antigüedad máxima de los precios | 2 horas |
| Funciona sin que cargue el mapa | sí, completo |
| Anuncios, cookies, registro | ninguno |

## No objetivos

- No hay que ser exhaustivo con combustibles minoritarios en la v1.
- No hay que competir en funcionalidad con las apps existentes. Se compite en
  que se abra rápido y no moleste.
- No hay que soportar navegadores sin ES2020.
