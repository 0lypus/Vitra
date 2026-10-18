/* Cómo repartir el espectro del analizador en las barras del visualizador.

   El AnalyserNode devuelve la energía repartida en bins lineales: con
   fftSize 256 son 128 bins de 172 Hz cada uno. Pero la música concentra casi
   todo abajo de 1 kHz, así que si cada bin es una barra se mueve solo la
   punta izquierda del canvas y el resto queda clavado en el mínimo.

   La solución es agrupar los bins con escala logarítmica: las primeras
   barras agarran un bin (los graves, que son los que más se mueven) y las
   últimas juntan varios (los agudos, donde hay poca energía), así el
   movimiento se ve repartido por todo el ancho. */

export type Barra = {
  /* Primer bin de la barra (inclusivo) */
  desde: number;
  /* Último bin, sin incluir (puede igualar a "desde": barra vacía) */
  hasta: number;
};

/* Rangos de bins para "cantidad" barras, cubriendo 0..bins sin huecos.
   El exponente (2.2) tira un poco más de ancho a los graves. */
export function barrasLogaritmicas(bins: number, cantidad: number): Barra[] {
  const total = Math.max(0, Math.floor(bins));
  const n = Math.max(1, Math.floor(cantidad));

  const barras: Barra[] = [];
  let desde = 0;
  for (let i = 0; i < n; i++) {
    // Borde de la barra i: crece rápido al principio y despacio al final
    const borde = Math.round(total * Math.pow((i + 1) / n, 2.2));
    // Cada barra lleva al menos un bin, para que ninguna quede muda
    const hasta = Math.min(total, Math.max(desde + 1, borde));
    barras.push({ desde, hasta });
    desde = hasta;
  }
  return barras;
}

/* Valor de la barra (0..255): el máximo del rango. El máximo resalta los
   golpes de batería mejor que el promedio, que los aplasta. */
export function valorBarra(datos: ArrayLike<number>, barra: Barra): number {
  let max = 0;
  for (let i = barra.desde; i < barra.hasta; i++) {
    if (datos[i] > max) max = datos[i];
  }
  return max;
}

/* Alto de la barra en píxeles, con una gamma < 1 que levanta los valores
   chicos: así se mueven también los medios y los agudos, que llegan flojos. */
export function altoBarra(valor: number, altoMaximo: number, altoMinimo = 2): number {
  const v = Math.min(255, Math.max(0, valor)) / 255;
  return Math.max(altoMinimo, Math.pow(v, 0.75) * altoMaximo);
}
