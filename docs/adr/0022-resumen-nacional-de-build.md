# ADR-0022 · La vista nacional usa un resumen generado en el build

**Fecha:** 2026-08-09 · **Estado:** aceptado

## Contexto

V2-18 necesita mostrar, para las 52 provincias, el nombre, el precio medio del
combustible elegido, el número de estaciones de esa media y el centroide de sus
estaciones. La aplicación almacena los datos completos en un JSON por provincia
y ADR-0005 impide convertir España en una zona que fusione los 52 ficheros.

Con los datos actuales, descargar todas las provincias supone unos 588 KB
comprimidos y procesar 11.513 estaciones para terminar pintando como máximo 52
pastillas. Supera el límite de 300 KB de RNF-15 y contradice RNF-13, además de
hacer depender una vista auxiliar del mayor camino de datos posible.

V2-10 ya creó un módulo de agregados que calcula una media simple y su `n` por
combustible. Excluye los precios `null` del numerador y del divisor y devuelve
media `null` con `n` cero cuando ninguna estación vende el producto. Esa es la
semántica exigida por V2-18 y no debe duplicarse.

## Decisión

El build publica un único `public/data/resumen-nacional.json`, separado del
índice territorial y de los JSON provinciales. Contiene la fecha de
actualización y, para cada provincia:

- identificador y nombre oficiales;
- centroide de todas sus estaciones públicas con coordenadas válidas;
- para cada combustible, media simple y `n` de las estaciones públicas que lo
  venden.

El resumen reutiliza las funciones puras del módulo de agregados de V2-10. El
filtrado de estaciones públicas ocurre antes de agregarlas: una estación de
venta restringida no entra en la media, en el `n` ni en el centroide. El filtro
«Solo abiertas» no interviene porque el resumen se genera en build y V2-18
representa oferta provincial, no disponibilidad en este minuto.

El fichero pesa menos de 10 KB comprimido. Se escribe de forma atómica en el
mismo proceso que los demás datos y nunca contiene estaciones individuales ni
geometrías administrativas.

El navegador lo solicita solo al inicializar la capacidad de vista nacional del
mapa, con el mismo timeout y rescate que cualquier recurso de red de la
aplicación. No descarga los 52 JSON provinciales. RNF-13 se precisa en
consecuencia: prohíbe descargar datos de estaciones fuera de la zona cargada,
pero permite este resumen agregado y acotado.

La vista nacional no es una zona. Cargar el resumen no modifica estado, selector,
URL, lista, escala de la zona ni `fitBounds`. Solo pulsar una pastilla provincial
constituye una elección territorial explícita y activa el flujo existente de
cambio de zona de RF-88 y ADR-0016.

Si el resumen no carga, la aplicación y el mapa de la zona cargada siguen
funcionando. Si MapLibre falla, el resumen no crea una representación alternativa
ni bloquea la lista, la ficha o los filtros.

## Motivos

Un resumen de unos pocos kilobytes responde exactamente a la pregunta nacional
sin transferir datos que no pueden mostrarse. Mantenerlo separado permite que el
índice siga describiendo el catálogo territorial y que el mapa, que es opcional,
sea el único consumidor del nuevo recurso.

Reutilizar el módulo de agregados evita dos definiciones de media y conserva las
pruebas ya existentes para `null`, `n=0` y media simple. Generar también el
centroide en build hace que cambiar combustible no mueva las pastillas y evita
recalcular sobre datos que el navegador no tiene.

El presupuesto de 10 KB deja margen sobre la medición actual —del orden de 2 a 5
KB comprimidos— sin convertir el límite en una descripción accidental de una
muestra concreta.

## Consecuencias

Buenas: V2-18 añade una sola petición pequeña, crea como máximo 52 nodos y no
afecta al peso de los JSON provinciales de RNF-12. RNF-15 conserva sus 300 KB
para datos de estaciones y obtiene un límite separado y verificable para el
resumen.

Malas: aparece un nuevo artefacto público cuyo esquema, escritura atómica y
presupuesto deben probarse. El mismo agregado se materializa en un formato más,
aunque la fórmula siga teniendo una única implementación.

A vigilar: los datos reales actuales son todos de venta pública, pero el filtro
debe existir antes de que llegue gasóleo B y aparezcan estaciones restringidas.
Canarias, Ceuta y Melilla no se excluyen: la separación fiscal de las
editoriales no es una regla cartográfica y las pastillas nacionales son
cromáticamente neutras.

## Alternativas descartadas

- **Descargar las 52 provincias.** Transfiere unos 588 KB comprimidos, supera
  RNF-15 y contradice RNF-13 para reducir 11.513 estaciones a 52 cifras.
- **Convertir España en una zona.** Reintroduce la fusión nacional descartada en
  ADR-0005 y haría que lista, escala y selector cambiasen de significado.
- **Añadir los agregados al índice territorial.** Es viable en peso, pero obliga
  a descargar datos exclusivos del mapa incluso cuando MapLibre no se inicia y
  mezcla catálogo y visualización.
- **Calcular en el navegador.** Requiere precisamente los datos completos que el
  resumen evita descargar.
- **Calcular la media sin reutilizar V2-10.** Crea una segunda fórmula y permite
  que `null`, estaciones restringidas o el divisor diverjan entre productos.
