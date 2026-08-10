# ADR-0023 · Evolución usa el contexto actual, no un perfil de usuario

**Fecha:** 2026-08-10 · **Estado:** aceptado

## Contexto

Los documentos editoriales actuales responden preguntas nacionales. Son útiles
para explorar y compartir, pero no parten de la situación más frecuente: una
persona compara una estación, su ciudad o las opciones que tiene cerca.

El histórico permite explicar cambios de precios, pero una portada nacional no
convierte esos datos en una experiencia cercana. Personalizarla mediante
favoritos, lugares habituales o historial guardado en `localStorage` crea una
expectativa de continuidad que el proyecto no puede cumplir sin cuentas y
sincronización. Esos datos desaparecen al cambiar de navegador, dispositivo o
almacenamiento local.

La aplicación ya dispone de contexto sin construir un perfil: URL de zona o
municipio, ficha de estación, combustible activo y, cuando la persona pulsa «Mi
ubicación», una posición efímera que no sale del dispositivo.

## Decisión

Evolución vive dentro de Hoy y parte del contexto más próximo que ya expresa la
navegación. La jerarquía es estación, municipio, provincia y España. Cada nivel
se compara con los superiores para explicar si un movimiento es local o general.

La ficha enlaza al histórico de la estación mediante un indicio compacto junto
al precio. Las páginas de municipio y zona enlazan a su propio análisis. Si la
ubicación está concedida durante la sesión, se puede ofrecer una lectura de las
estaciones cercanas o visibles; esa posición no se persiste ni se convierte en
requisito de acceso.

Sin contexto previo, Hoy ofrece búsqueda o selección territorial explícita y un
panorama nacional como alternativa. No intenta adivinar el domicilio del
usuario ni pide ubicación al cargar.

Evolución conserva la separación de ADR-0019: sus análisis son documentos
desplazables fuera de la aplicación de mapa. La aplicación solo muestra
indicios breves y enlaces; no se transforma en un dashboard.

V2-09, favoritos, se descarta. Combustible, zona y litros pueden seguir en
`localStorage` como preferencias prescindibles y fáciles de reconstruir, pero
una colección de favoritos se percibe como dato personal duradero y exigiría
continuidad entre dispositivos que Surtidor no ofrece.

## Motivos

El contexto explícito es más fiable que una personalización incompleta. También
permite compartir y posicionar cada análisis mediante una URL estable, conserva
la privacidad y evita introducir cuentas, identificadores o sincronización.

Empezar por la entidad más cercana responde al uso cotidiano; España adquiere
valor como referencia para interpretar el dato local, no como destino impuesto.
Mantener los análisis fuera de la aplicación protege la prueba de los cinco
segundos y el presupuesto de interfaz de `docs/05-diseno.md`.

## Consecuencias

Buenas: el histórico resulta relevante sin recopilar datos personales; cada
estación y territorio puede tener una entrada compartible; la ubicación sigue
siendo voluntaria y efímera; la interfaz operativa recibe una sola puerta de
entrada compacta.

Malas: no existe un panel permanente de «mis lugares» y una persona que entre
sin URL territorial debe elegir contexto. Hay más rutas y estados editoriales
que diseñar, y deben evitar contenido duplicado y variantes canónicas ambiguas.

A vigilar: el indicio de la ficha no puede competir con el precio actual ni
añadir un paso a la decisión principal. La experiencia cercana no debe depender
de geolocalización: municipio, zona y estación son contextos completos por sí
mismos.

## Alternativas descartadas

- **Portada nacional para todos.** Conserva el modelo actual, pero obliga a cada
  persona a encontrar su territorio dentro de una pregunta demasiado amplia.
- **Favoritos en `localStorage`.** Simula persistencia de un dato personal que
  desaparece o no cruza dispositivos; se descarta V2-09.
- **Perfil o cuenta.** Añade servidor, sesiones y tratamiento de datos para una
  capacidad que la navegación contextual ya resuelve.
- **Pedir ubicación al abrir Hoy.** Introduce fricción y permiso sin necesidad;
  contradice la regla existente de solicitarla solo por acción explícita.
- **Incrustar el análisis completo en la ficha.** Consume el espacio destinado a
  decidir dónde repostar y convierte la aplicación en un dashboard.
