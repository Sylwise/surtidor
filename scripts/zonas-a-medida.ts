// Zonas que cruzan fronteras administrativas. Son juicios sobre cómo se
// conduce de verdad y no salen de ningún dato del ministerio — por eso se
// declaran a mano aquí, y no en `Listados/Provincias` (ver ADR-0005).
//
// Cuidado: Canarias nunca va en la misma zona que provincias peninsulares.
// Su régimen fiscal hace que los precios sean mucho más bajos, y mezclarlas
// pintaría toda la península de rojo en la escala relativa (ADR-0003).

import type { Zona } from './lib/tipos.ts';

export const ZONAS_A_MEDIDA: Zona[] = [
  {
    id: 'euskadi-plus',
    nombre: 'Euskadi y alrededores',
    tipo: 'medida',
    // Araba/Álava, Bizkaia, Gipuzkoa, Navarra (Pamplona) y Burgos (Miranda de
    // Ebro): quien vive en Vitoria-Gasteiz reposta con normalidad en las
    // cinco.
    provincias: ['01', '48', '20', '31', '09'],
  },
];
