# ADR-0019 · Las páginas editoriales viven fuera de la aplicación

**Fecha:** 2026-08-09 · **Estado:** aceptado

## Contexto

Hasta ahora el sitio tiene dos tipos de página: zona y municipio. Las dos
sirven la aplicación interactiva, con mapa, lista, ficha, hoja y selectores.
V2-10 añade páginas editoriales automáticas que responden preguntas distintas
con cifras agregadas y que no necesitan ninguno de esos elementos.

La raíz ya es el espacio de nombres de las 71 zonas y la ruta `[...zona]` es un
parámetro resto. Añadir nuevas rutas editoriales directamente en la raíz las
haría competir con ese espacio de nombres.

Además, una media no aparece en el cartel de ninguna estación. Para respetar la
regla «ningún número sin origen visible» de `docs/05-diseno.md`, su procedencia
tiene que quedar explícita en la propia página.

## Decisión

Existe un tercer tipo de página: el **documento**. Es HTML y CSS y no lleva
mapa, `AppInteractiva`, MapLibre, hoja ni selector. Vive fuera de la aplicación
y por eso no consume su presupuesto de interfaz. El documento se desplaza por
definición y se regenera entero en cada build, como el resto del sitio.

Las páginas editoriales viven bajo el prefijo estático `/hoy/`; por ejemplo,
`/hoy/provincias-mas-baratas/`. Así no colisionan con los 71 slugs de zona ni
con el parámetro resto `[...zona]`.

La cifra de cabecera de una zona es la **media simple por estación**, no el
mínimo ni una media ponderada. No hay datos de volumen de venta con los que
ponderarla. Para cada combustible se calcula solo sobre las estaciones que lo
venden: una estación sin ese producto vale `null`, nunca cero.

Toda cifra agregada muestra el número de estaciones sobre el que se calcula y
enlaza a la página de municipio o zona de la que sale. No se enlaza a una
estación concreta porque no existe URL de estación: el ADR-0007 detiene la
jerarquía de páginas en el municipio. La media no está en ningún cartel y ese
origen visible es necesario para que el número sea comprobable.

Los rankings comparan los precios con los tres decimales que publica el
ministerio. Los resultados empatados comparten posición y, dentro de ella, se
ordenan alfabéticamente.

La página de rótulos analiza península y Baleares y exige un mínimo de 100
estaciones para entrar en el ranking. Muestra en texto visible tanto el umbral
como cuántas estaciones quedan fuera: con los datos actuales entran 12 rótulos
y quedan fuera unas 4.900 de las 10.993 estaciones.

Se ordenan rótulos, no empresas ni grupos empresariales: lo escrito en el
cartel, conforme a «el precio de pantalla es el precio del cartel» de
`docs/05-diseno.md`. MOEVE y CEPSA aparecen por separado aunque pertenezcan a
la misma compañía en pleno cambio de marca; PETRONOR y CAMPSA aparecen
separados de REPSOL por la misma razón. La página lo explica en una línea para
dejar claro que es deliberado.

Los rótulos se agrupan por coincidencia literal después de recortar espacios al
principio y al final. No se normalizan mayúsculas ni tildes, porque los datos
actuales no presentan variantes por ninguna de las dos. No se mantiene una
tabla de equivalencias entre marcas: sería trabajo recurrente y cambiaría cada
pocos meses conforme avance el cambio de marca.

Canarias, Ceuta y Melilla no entran en los rankings nacionales. Sus resultados
van en una tabla aparte porque su régimen fiscal de los carburantes es distinto:
no forman un mercado más barato, sino sujeto a otro impuesto.

Cada editorial enlaza hacia abajo, a zonas o municipios, y recibe un enlace
desde la portada. Ninguna depende solo del sitemap, conforme al
[ADR-0017](0017-jerarquia-de-enlaces.md).

## Motivos

Las editoriales responden preguntas de lectura, no la pregunta operativa
«¿dónde reposto?» de la aplicación. Darles una plantilla de documento permite
mostrar contexto, metodología y tablas sin sumar controles ni longitud a las
páginas de mapa.

El prefijo `/hoy/` reserva un espacio inequívoco para ellas. La media describe
el nivel general de una zona mejor que su estación extrema, y la media simple
es la única agregación posible sin inventar un peso que la fuente no ofrece.

Separar los territorios con distinto régimen fiscal evita presentar como una
diferencia de mercado lo que es una diferencia tributaria.

## Consecuencias

Las rutas editoriales se tienen que dar de alta en `src/pages/sitemap.xml.ts`.
El array de rutas se arma a mano.

Cada editorial necesita una `og:image` propia. Las seis comparten una única
plantilla, con el título de la página y su cifra de cabecera; no se diseña una
por editorial. RF-66 hoy solo cubre zona y municipio, y
`scripts/generar-imagenes-compartir.ts` indexa las imágenes por identificador
de zona; ese contrato no cubre documentos editoriales.

La portada crece con enlaces a todas las editoriales y cada documento abre
caminos hacia páginas más concretas de zona o municipio. Las cifras agregadas
requieren acompañar siempre el tamaño de la muestra y el enlace a la página de
municipio o zona de origen.

## Alternativas descartadas

- **Meter las editoriales dentro de la aplicación.** No necesitan interacción
  ni mapa y consumirían un presupuesto de interfaz reservado a decidir dónde
  repostar.
- **Publicarlas en la raíz.** Colisiona con el espacio de nombres de las 71
  zonas y con el parámetro resto `[...zona]`.
- **Usar el precio mínimo como cifra de zona.** Responde por una estación
  extrema, no por el nivel general de la zona.
- **Ponderar la media.** La fuente no ofrece volumen de venta y cualquier peso
  sería inventado.
- **Incluir Canarias, Ceuta y Melilla en el ranking nacional.** Compararía
  mercados sometidos a regímenes fiscales distintos como si la diferencia
  fuese solo de precio.
