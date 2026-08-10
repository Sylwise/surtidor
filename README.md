# Surtidor

Mapa de precios de carburantes de España. Sin anuncios, sin registro, sin rastreo.

Los datos vienen de la API pública del Ministerio para la Transición Ecológica
(MITECO), la misma fuente que alimenta Waze y las webs de comparación. La
diferencia es que aquí no hay nada entre el precio y tú.

**Estado actual:** v1 completa y publicada en [surtidor.app](https://surtidor.app).
De la v2 están terminadas las seis páginas editoriales bajo `/hoy/` (V2-10),
la ordenación por cercanía tras conceder ubicación (V2-13) y la vista nacional
por provincias (V2-18). El estado completo —terminado, pendiente y descartado—
se mantiene en el [roadmap](docs/06-roadmap.md); los requisitos verificables,
en [02 · Requisitos](docs/02-requisitos.md).

Pendiente conocido y aplazado a la v2: RF-56, la interfaz de venta restringida.
El filtro y sus pruebas están, pero no se expone porque la muestra nacional
verificada no contenía ninguna estación `R`. Entra con el gasóleo B. El detalle
y el contexto de esa medición están en `docs/04-fuente-datos.md`.

Cada documento tiene una responsabilidad distinta: los requisitos y los ADR
vigentes son normativos; la arquitectura describe lo construido; el roadmap
separa lo terminado de lo pendiente y descartado. Ante una duda sobre el estado
actual, hay que comprobar también el código, las pruebas y el workflow: una
aspiración del roadmap no demuestra que una función exista.

---

## Idea en una frase

Abres la web, ves los precios de tu zona sobre un mapa, y en dos segundos sabes
si merece la pena desviarte y cuántos euros te ahorras. Una zona es tu provincia,
tu comunidad autónoma: quien vive en Vitoria-Gasteiz puede mirar Álava sola o
Euskadi entera.

## Principios que no se negocian

1. **Cero coste de infraestructura.** Si una decisión técnica implica pagar un
   servidor, es la decisión equivocada. Ver [ADR-0001](docs/adr/0001-sin-backend.md).
2. **Cero fricción.** Sin login, sin cookies, sin banner de consentimiento, sin
   app que instalar. Se usa desde el coche con una mano.
3. **Cero anuncios.** Es el motivo por el que existe el proyecto.
4. **Funciona con mala cobertura.** La carga inicial tiene que ser pequeña y el
   contenido útil aparecer antes que el mapa.

## Arranque rápido

```bash
npm install
npm run data:fetch      # descarga y normaliza los datos del MITECO a public/data/
npm run dev             # servidor de desarrollo
npm run check           # tipos de Astro y TypeScript de scripts
npm test                # pruebas unitarias
npm run build           # build estático a dist/
npm run preview         # sirve el build localmente
```

## Documentación

Leer en este orden.

| Documento | Para qué |
|---|---|
| [01 · Especificación](docs/01-especificacion.md) | Qué es el producto, para quién, qué hace y qué no |
| [02 · Requisitos](docs/02-requisitos.md) | Lista numerada y verificable de RF y RNF |
| [03 · Arquitectura](docs/03-arquitectura.md) | Flujo de datos, stack, despliegue, estructura de carpetas |
| [04 · Fuente de datos](docs/04-fuente-datos.md) | La API del MITECO y todas sus trampas |
| [05 · Diseño](docs/05-diseno.md) | Tokens, tipografía, el tótem, componentes |
| [06 · Roadmap](docs/06-roadmap.md) | Trabajo terminado, pendiente, descartado y futuro |
| [07 · Marca](docs/07-marca.md) | Icono, favicon, manifiesto y dónde vive cada fichero |
| [ADR](docs/adr/) | Decisiones de arquitectura y por qué se tomaron |

Las instrucciones para Claude Code están en [CLAUDE.md](CLAUDE.md).

## Licencia

Código: MIT. Datos de precios: MITECO (reutilización libre). Cartografía:
OpenFreeMap © OpenMapTiles, datos de OpenStreetMap — la atribución es
obligatoria y no se toca.
