# 08 · Evolución

## Qué es

**Evolución** es el espacio de análisis histórico de Surtidor. Vive dentro de
**Hoy**, fuera de la aplicación de mapa, y explica qué está pasando con los
precios que la persona tiene delante.

La aplicación principal responde **dónde repostar ahora**. Evolución añade
contexto temporal: cuánto ha cambiado un precio, si el movimiento es local o
general, y cómo se compara una estación con su municipio y su provincia.

No es un panel profesional ni una colección de gráficos. Cada página empieza
por una conclusión legible y permite comprobarla en la visualización y los
datos. El resultado debe sentirse riguroso y especial sin abandonar el lenguaje
visual de Surtidor.

## Principio de producto: contextual, no personalizado

Surtidor no construye un perfil del usuario. No guarda favoritos, lugares
habituales ni un historial de navegación, y no promete que una preferencia
local aparezca en otro navegador o dispositivo.

El contexto ya existe en la navegación actual:

- la estación cuya ficha está abierta;
- el municipio o la zona de la URL;
- el combustible seleccionado;
- las estaciones visibles alrededor de una ubicación concedida voluntariamente.

Evolución parte del contexto más próximo disponible. La ubicación es un atajo
efímero, nunca una condición para usar el producto. Si no existe contexto
territorial, Hoy ofrece búsqueda o selección explícita y, como alternativa,
el panorama nacional.

La jerarquía de comparación es:

```text
estación → municipio → provincia → España
```

El nivel nacional sirve como referencia para explicar si un cambio es local o
general. No es la portada obligatoria de todos los análisis.

## Puertas de entrada

### Desde la ficha de una estación

Junto al precio activo aparece un indicio compacto con el cambio y el periodo:

```text
1,429 €/L
↓ 4,0 cts en 7 días
Ver evolución →
```

Puede incorporar una minigráfica de 30 días si sigue siendo legible a 360 px.
El indicio enlaza al análisis de esa estación y ese combustible. Nunca sustituye
el precio actual ni añade un paso para abrir la ficha o usar «Cómo llegar».
El histórico provincial se descarga solo al abrir una ficha y se reutiliza en
las siguientes selecciones. Si falla, la ficha, el precio y «Cómo llegar» siguen
operativos y el enlace permite reintentar desde Evolución.

### Desde un municipio o una zona

El acceso Hoy conserva el territorio de la página y abre primero su lectura
local. Ejemplos de encabezado:

- «La gasolina 95 ha bajado 2,3 cts en Vitoria-Gasteiz en 7 días».
- «Álava está 1,8 cts por debajo de su media de 30 días».

### Desde «Mi ubicación»

Mientras la posición siga disponible en memoria, Hoy puede ofrecer un análisis
del entorno cercano o de las estaciones visibles. La posición no se serializa
en la URL, no se persiste y no sale del dispositivo. Al perderla, la página
continúa funcionando con su contexto territorial.

### Sin contexto previo

Hoy pregunta «¿Qué precios quieres entender?» y ofrece buscar un municipio o
seleccionar una provincia. El panorama nacional permanece disponible para
exploración, enlaces externos y comparación, pero no suplanta una elección
local que ya se conoce.

## Primera entrega

El primer corte útil del producto histórico incluye:

1. histórico diario normalizado para los cuatro combustibles actuales;
2. cambio absoluto desde hace 1, 7, 30 y 90 días;
3. gráfica de hasta 90 días en la página de estación;
4. comparación de la estación con su municipio y provincia;
5. evolución de media y mínimo en páginas de municipio y provincia;
6. mayores subidas y bajadas del territorio, con magnitud y periodo;
7. fecha de cada observación y estados explícitos cuando falten datos.

La vista provincial materializada incorpora también las tres mayores bajadas y
subidas del municipio activo para el mismo combustible y periodo. Una estación
solo entra si publicó precio en ambos extremos exactos; cambiar de fila abre su
análisis sin crear otra página.

El histórico es una capacidad común. V2-01 construye los datos; V2-02 y V2-08
son lecturas sobre ellos, no proyectos independientes.

## Ventana temporal

Evolución conserva y publica una **ventana móvil de 90 días cerrados**. Los
precios del día actual siguen llegando por el flujo cada dos horas; la última
observación histórica es la de ayer.

No se acumulan años de instantáneas ni se ofrece una escala anual. El producto
no pretende servir estudios de mercado: responde a la curiosidad y a la
necesidad de certidumbre sobre un cambio reciente. Noventa días permiten ver una
tendencia sin convertir Hoy en una plataforma de series temporales generales.

Cada actualización diaria añade ayer y retira de la ventana activa el día 91.
La ausencia de una estación o precio deja un hueco; nunca se prolonga el último
valor ni se inventa una observación. El histórico oficial permite reconstruir
la ventana si se pierde el material de build, por lo que no se conserva un
archivo propio indefinido «por si acaso».

## Lenguaje de las conclusiones

Una conclusión siempre incluye la magnitud, el periodo y el ámbito. «Baja» o una
flecha aislada no bastan.

Buenos ejemplos:

- «Ha bajado 4,0 cts en 7 días».
- «Está en su precio más bajo de los últimos 90 días».
- «18 de 25 estaciones del municipio han bajado esta semana».
- «Vitoria-Gasteiz baja más rápido que el conjunto de Álava».

No se atribuyen intenciones. V2-08 se expresa como «sin cambios detectados desde
hace N días», nunca como que una estación congela el precio para parecer barata.

No se presentan predicciones como hechos. Un patrón histórico por día de la
semana solo podrá publicarse si declara ventana, tamaño de muestra y diferencia,
y si una revisión posterior demuestra que resulta estable y útil.

## Sistema visual

Evolución usa los tokens, tipografías y nombres canónicos de Surtidor. No crea
una identidad de dashboard separada.

El efecto visual especial nace de la precisión:

- una conclusión principal por pantalla;
- una visualización principal por pregunta;
- cifras grandes en tipografía tabular;
- ejes, unidades, periodo y ámbito siempre visibles;
- comparación directa mediante la misma escala;
- detalle bajo demanda, no doce tarjetas compitiendo;
- movimiento solo cuando explica un cambio y siempre respetando
  `prefers-reduced-motion`.

El color no significa «bueno» o «malo» de forma absoluta. Subir o bajar puede
ser relevante sin convertirse en alarma. Toda codificación de color se acompaña
de signo, cifra o texto, conserva contraste AA y es distinguible sin depender
de rojo y verde.

Las minigráficas no llevan ejes completos, pero sí valor inicial, final, periodo
y texto alternativo equivalente. Las gráficas completas muestran puntos o una
tabla accesible que permita recuperar los valores sin interpretar únicamente la
forma de una línea.

## Navegación y URLs

Cada análisis importante tiene una URL estable y compartible. La URL expresa
territorio y entidad; el combustible puede resolverse con un segmento o estado
canónico definido durante el diseño técnico, sin crear variantes SEO duplicadas.

Hoy mantiene la navegación editorial de ADR-0019: documentos desplazables, sin
mapa ni aplicación interactiva completa. Desde ellos se enlaza de vuelta a la
página operativa de la estación, municipio o zona.

La primera materialización usa 52 documentos estáticos, uno por provincia, en
`/hoy/evolucion/{provinciaId}/`. Una estación se selecciona mediante el parámetro
compartible `?estacion={IDEESS}`. Así cada ficha tiene un enlace profundo sin
crear más de once mil páginas casi idénticas. El documento descarga únicamente
el histórico y el dato actual de su provincia; nombres y direcciones no se
duplican en el histórico. `/hoy/evolucion/` es la entrada sin contexto y ofrece
selección explícita de provincia.

La serie pública conserva también el identificador del municipio actual. Esto
permite dibujar estación, media municipal y media provincial sobre la misma
escala. La pertenencia diaria completa sigue en el estado nacional de build y
es la que gobierna los agregados cuando una estación cambia de territorio.

## Datos y arquitectura

El endpoint `EstacionesTerrestresHist/{fecha}` existe, no admite CORS y escapa
las claves de forma distinta al endpoint actual. La descarga y normalización
deben ocurrir durante procesos de build o tareas programadas, nunca en el
navegador.

La medición y la decisión de persistencia están cerradas en ADR-0024:

- identidad estable de una estación entre días y tratamiento de altas, bajas y
  registros duplicados;
- granularidad conservada: observación por estación frente a agregados;
- representación y rotación de la ventana móvil de 90 días;
- artefactos que se publican y presupuesto comprimido por página;
- forma de añadir ayer y retirar el día 91 entre ejecuciones sin introducir un
  servidor;
- reconstrucción ante días ausentes o cambios del contrato del ministerio;
- impacto en los límites de ficheros y despliegues de Cloudflare Pages.

La primera auditoría empírica ya está registrada en
[09 · Investigación del histórico](09-investigacion-historico-miteco.md): hay
instantáneas oficiales al menos desde 2007 y continuidad alta de `IDEESS`, pero
el tamaño desaconseja reconstruir la ventana completa en cada build.

No se elegirá una biblioteca de gráficos antes de definir el contrato y medir
el volumen. Una dependencia de ejecución deberá justificar su peso frente a SVG
o canvas propios y mantenerse fuera del JavaScript inicial de la aplicación.

## Criterio de éxito

Evolución está bien resuelta cuando una persona puede responder en pocos
segundos:

1. cuánto ha cambiado el precio que está mirando;
2. durante qué periodo;
3. si el cambio también ocurre en su entorno;
4. de qué datos sale la conclusión.

La impresión de «wow» es consecuencia de entender algo valioso de inmediato,
no un requisito de ornamentación.
