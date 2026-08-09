# Surtidor

Mapa de precios de carburantes de España. Sin anuncios, sin registro, sin rastreo.

Los datos vienen de la API pública del Ministerio para la Transición Ecológica
(MITECO), la misma fuente que alimenta Waze y las webs de comparación. La
diferencia es que aquí no hay nada entre el precio y tú.

**Estado:** v1 completa. H1 a H11: mapa con botón de ubicación (RF-17),
páginas de zona y de municipio, JSON-LD, sitemap.xml, 404 real para el
municipio sin página propia —
[ADR-0012](docs/adr/0012-municipio-sin-pagina-404.md)— e imagen de
compartición `og:image` generada en el build —
[ADR-0011](docs/adr/0011-imagen-og-generada-en-build-con-resvg.md).
Enlazado interno portada → zona → municipio (RF-91, RF-92) —
[ADR-0017](docs/adr/0017-jerarquia-de-enlaces.md). El precio que acompaña a
cada municipio, en zona y en vecinos, sigue al combustible seleccionado
(RF-94). Las URLs de zona llevan el nombre, no el identificador (RF-95,
RF-96) — [ADR-0018](docs/adr/0018-urls-de-zona-por-nombre.md).

**V2 en curso:** V2-10 completado. Las seis páginas editoriales bajo `/hoy/`,
sus agregados, enlazado interno, sitemap e imágenes de compartición están
publicados (RF-97 a RF-107, ADR-0019 y ADR-0020).

Pendiente conocido y aplazado a la v2: RF-56, la interfaz de venta restringida.
El filtro y sus pruebas están, pero no se expone porque hoy no hay ninguna
estación `R` en toda España. Entra con el gasóleo B. El detalle, en
`docs/04-fuente-datos.md`.

La documentación describe el objetivo, no siempre lo ya construido. Ante una
discrepancia entre documento y código, **manda el documento**: es la
especificación, y el código es lo que va detrás.

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
npm run build           # build estático a dist/
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
| [06 · Roadmap](docs/06-roadmap.md) | Hitos en orden, listos para convertir en issues |
| [07 · Marca](docs/07-marca.md) | Icono, favicon, manifiesto y dónde vive cada fichero |
| [ADR](docs/adr/) | Decisiones de arquitectura y por qué se tomaron |

Las instrucciones para Claude Code están en [CLAUDE.md](CLAUDE.md).

## Licencia

Código: MIT. Datos de precios: MITECO (reutilización libre). Cartografía:
OpenFreeMap © OpenMapTiles, datos de OpenStreetMap — la atribución es
obligatoria y no se toca.
