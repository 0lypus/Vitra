/* Cola de reproducción manual.

   Guarda los ids de las canciones que van a sonar antes que el resto del orden
   normal (la biblioteca, las favoritas o la lista activa). Vive en memoria: se
   pierde al recargar, como en cualquier reproductor.

   Todo acá es puro (entra un array, sale otro), así que se puede testear sin
   IndexedDB ni el reproductor. */

/* Agrega la canción al final; si ya estaba encolada, la mueve al final */
export function agregarAlFinal(cola: number[], id: number): number[] {
  return [...quitarDeCola(cola, id), id];
}

/* Pone la canción primera: suena apenas termina la actual */
export function reproducirAContinuacion(cola: number[], id: number): number[] {
  return [id, ...quitarDeCola(cola, id)];
}

export function quitarDeCola(cola: number[], id: number): number[] {
  return cola.filter((x) => x !== id);
}

/* Mueve una canción dentro de la cola (paso -1 arriba, 1 abajo).
   Si se va de los bordes, devuelve la misma cola. */
export function moverEnCola(cola: number[], id: number, paso: number): number[] {
  const i = cola.indexOf(id);
  const j = i + paso;
  if (i < 0 || j < 0 || j >= cola.length) return cola;
  const copia = [...cola];
  [copia[i], copia[j]] = [copia[j], copia[i]];
  return copia;
}

/* Deja solo las canciones que todavía existen en la biblioteca */
export function limpiarCola(cola: number[], existe: (id: number) => boolean): number[] {
  const limpia = cola.filter(existe);
  return limpia.length === cola.length ? cola : limpia;
}

/* Saca la próxima canción que todavía exista, descartando las que ya no están
   (por ejemplo, si borraste el archivo). Devuelve id null si no queda nada. */
export function sacarSiguiente(
  cola: number[],
  existe: (id: number) => boolean,
): { id: number | null; cola: number[] } {
  const resto = limpiarCola(cola, existe);
  if (resto.length === 0) return { id: null, cola: resto };
  return { id: resto[0], cola: resto.slice(1) };
}
