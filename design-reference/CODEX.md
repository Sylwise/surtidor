# Referencia de implementación para Codex

## Fuentes de verdad

1. **Comportamiento, datos y arquitectura:** el código actual, `CLAUDE.md` y `docs/`.
2. **Resultado visual del rediseño:** los frames indicados en `manifest.json` y sus JSON en `frames/`.
3. **Comprobación visual:** los PNG de `../surtidor-pics/`.
4. **Tokens reutilizables:** `src/estilos/tokens.css`. No introduzcas CDN, fuentes remotas ni un segundo sistema de estilos.

Los JSON son una especificación estructural, no código para copiar. Conservan jerarquía, nombres de capas, tamaños, espaciados, colores, tipografía y variantes desktop/móvil del archivo `../surtidor.pen`.

## Correspondencia

| Pantalla/estado | Frame | PNG |
|---|---:|---|
| Principal desktop | `d0yaSA` | `../surtidor-pics/principal-desktop.png` |
| Principal móvil | `coEwt` | `../surtidor-pics/principal-m-vil.png` |
| Selector de zona desktop | `JYmYz` | `../surtidor-pics/selector-de-zona-desktop.png` |
| Panel Hoy móvil | `MLRlB` | `../surtidor-pics/principal-hoy-m-vil.png` |
| Selector de zona móvil | `sHq6P` | `../surtidor-pics/principal-zona-m-vil.png` |
| Evolución desktop | `bi8Au` | `../surtidor-pics/evoluci-n-araba-lava.png` |
| Evolución móvil | `lLXW9` | `../surtidor-pics/evoluci-n-m-vil.png` |
| Artículo Hoy desktop | `wC99O` | `../surtidor-pics/art-culo-hoy-redise-o.png` |
| Artículo Hoy móvil | `Iqts8` | `../surtidor-pics/art-culo-hoy-m-vil.png` |
| Estados interactivos | `SQ2EH` | `../surtidor-pics/estados-interactivos.png` |

## Prompt recomendado

```text
Implementa el rediseño de Surtidor de forma fiel, adaptándolo a la arquitectura Astro y al comportamiento ya existente. No reconstruyas la aplicación como HTML estático y no copies literalmente la exportación del diseño.

Antes de editar:
1. Lee CLAUDE.md, README.md, docs/01-especificacion.md, docs/02-requisitos.md, docs/03-arquitectura.md, docs/05-diseno.md y docs/08-evolucion.md.
2. Inspecciona la implementación actual y localiza los componentes y CSS responsables de cada pantalla.
3. Lee design-reference/manifest.json y los JSON de los frames que vas a implementar. Usa los PNG correspondientes solo para comprobar el resultado global.
4. Escribe un plan por pantalla y enumera qué archivos vas a modificar. No empieces a editar hasta haber comparado diseño e implementación actual.

Reglas de implementación:
- Mantén intacta la lógica de datos, rutas, SEO, accesibilidad y estados de fallo salvo que el diseño exija conectarlos a una UI nueva.
- Reutiliza AppInteractiva, NavegacionApp, Hoja, Lista, Totem, Evolucion y DocumentoEditorial; refactoriza solo cuando evite duplicación real.
- Traduce la jerarquía del diseño a HTML semántico y CSS mantenible. Los nombres de capa indican intención, no nombres obligatorios de clases.
- Centraliza colores, radios y tipografía en src/estilos/tokens.css. No uses colores literales dispersos.
- No añadas Tailwind, React, librerías de iconos, fuentes remotas ni dependencias nuevas.
- Verde, amarillo y rojo solo tienen significado económico, de precio, evolución o comparación. No los uses como decoración.
- Evita tarjetas innecesarias, divisores agresivos, sombras decorativas e iconos redundantes.
- Conserva objetivos táctiles de al menos 44 px, foco visible, contraste AA y prefers-reduced-motion.
- Implementa desktop y móvil como composiciones específicas; no reduzcas desktop por escala.
- No inventes datos ni textos. Usa los datos reales y las funciones de formato existentes.

Proceso obligatorio:
- Trabaja por bloques pequeños: principal, paneles, Evolución, editorial y estados.
- Después de cada bloque, ejecuta npm run check y las pruebas relevantes.
- Arranca la app y compara visualmente en 1440×1024 y 390×844 (artículo móvil: 390×1204) contra el PNG correspondiente.
- Corrige diferencias de estructura, tamaño, alineación, espaciado, tipografía y responsive antes de pasar al siguiente bloque.
- Comprueba además 360 px de ancho y los estados vacío/error.
- Al final ejecuta npm test y npm run build.

Entrega un informe con:
1. archivos modificados;
2. pantallas y estados verificados;
3. tamaños de viewport usados;
4. diferencias deliberadas respecto al diseño y su motivo técnico;
5. pruebas y comandos ejecutados.
```

## Cómo pedir el trabajo

No conviene pedir «implementa todo» en una sola ejecución. Divide el encargo:

1. Principal desktop/móvil y ficha/lista.
2. Selector de zona y panel Hoy.
3. Evolución desktop/móvil y estados interactivos.
4. Layout editorial y artículos Hoy.
5. Revisión visual completa y regresiones.

En cada encargo indica los IDs de frame concretos y exige comparación visual antes de aceptar el bloque.

## Conflictos y cautelas

- El diseño usa nombres de fuente como `Inter` y `Roboto Mono`, pero la aplicación no debe cargarlas desde Google Fonts. Deben resolverse con las pilas locales definidas en tokens.
- Los PNG son la referencia visual; los JSON aportan las medidas y la jerarquía que el PNG no puede comunicar.
- Si el diseño contradice un requisito funcional o un ADR, Codex debe detenerse, describir el conflicto y pedir decisión; no debe resolverlo silenciosamente.
- No debe modificar documentación vinculante para hacer que el código parezca conforme.
