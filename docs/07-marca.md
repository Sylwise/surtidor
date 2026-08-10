# 07 · Marca e iconos

## Qué es

El icono es **el tótem**: el cartel de precio con su poste y su peana, la misma
forma que usan los marcadores del mapa. No es una marca inventada aparte del
producto, es el producto reducido a su silueta.

Colores: fondo `--petrol` (#16323B) y tótem `--signal` (#F5B921). El ámbar es
correcto aquí porque **un icono es chrome, no un precio**: la regla que lo
prohíbe en mapa y lista (docs/05-diseno.md) no aplica al icono de la aplicación.

El fondo oscuro es deliberado: funciona igual en pestaña clara y oscura, sin
necesitar dos versiones.

## Marca reducida (por debajo de 32 px)

El tótem completo —cartel, poste y peana— necesita sitio para leerse como lo
que es. Por debajo de 32 px el poste y la peana dejan de leerse como
"anclaje al mapa" y se leen como el pie de una copa: la silueta entera pasa a
verse como un trofeo, no como un cartel de precio. Pasó en la imagen de
compartición (RF-66), con el tótem a unos 19×10 px.

**Por debajo de 32 px se usa solo el cartel** —el rectángulo redondeado de
arriba— sin poste ni peana:

```
┌────────┐
│        │   ← solo esto: un rectángulo redondeado
└────────┘
```

Mismas coordenadas que el maestro (`marca/icono.svg`, cartel en
`x=11 y=11 width=42 height=23 rx=6` sobre un lienzo de 64), simplemente sin
dibujar los otros dos `<rect>`. No es un icono nuevo que mantener: es el
mismo tótem, con menos piezas, para el tamaño en el que las piezas de más
estorban en vez de ayudar.

## Ficheros

| Fichero | Para qué |
|---|---|
| `public/favicon.svg` | Favicon moderno. Vectorial, nítido a cualquier tamaño |
| `marca/icono.svg` | Maestro del icono normal. Editar aquí y regenerar derivados |
| `marca/icono-maskable.svg` | Maestro con margen seguro para Android |
| `src/assets/marca.svg` | Sin fondo, hereda `currentColor`; cabecera y documentos |
| `public/apple-touch-icon.png` | 180×180. iOS, al guardar en pantalla de inicio |
| `public/icono-192.png` / `public/icono-512.png` | Manifiesto e instalación |
| `public/icono-maskable-512.png` | Android puede recortar; esta lleva margen |
| `public/site.webmanifest` | Manifiesto. Ajustar si cambia el nombre |

Solo los derivados destinados al navegador van en `public/`. Los maestros
viven en `marca/` y la marca que se integra en el código, en `src/assets/`.

## Etiquetas en el `<head>`

```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#16323B">
```

Sin `favicon.ico`: los navegadores que lo necesitaban ya no cuentan.

## Si cambia el nombre

El tótem sirve igual para Surtidor que para Boquerel: no lleva letras. Solo hay
que tocar `site.webmanifest` y el texto de la cabecera, que es HTML normal.

## Al regenerar

Editar `marca/icono.svg` (y `marca/icono-maskable.svg` cuando afecte al área
segura) y volver a rasterizar. **Comprobar siempre a 16 px**: es donde
se rompe todo. El poste tiene 8 unidades de ancho de 64 justamente por eso — con
4 desaparecía y el icono quedaba en un borrón.

## Dónde vive cada cosa

| Ruta | Qué hay | Se despliega |
|---|---|---|
| `public/` | favicon, PNG de instalación y manifiesto | sí, en la raíz del sitio |
| `src/assets/marca.svg` | la marca sin fondo, para incrustar en la cabecera | va en el bundle |
| `marca/` | los SVG maestros | no |

Los maestros están fuera de `public/` a propósito: si estuvieran dentro se
desplegarían sin necesidad, y peor, alguien podría editar el desplegado en vez
del maestro y perder el cambio en la siguiente regeneración.
