/** Los archivos de ejemplo que trae el botón (y su letra, si existe). */
export const NOMBRES_DEMO = ["demo1.mp3", "demo2.mp3", "demo3.mp3"];

type Traer = (ruta: string) => Promise<Response>;

/**
 * Baja un archivo de ejemplo de `/demo/`.
 *
 * Ojo: el servidor de la app contesta `index.html` con un 200 cuando el archivo
 * no existe (es una SPA), así que no alcanza con mirar `res.ok`: hay que mirar
 * el tipo de contenido y descartar el HTML. Si no, se importan "canciones" que
 * en realidad son la página de Vitra de 798 bytes.
 */
export async function traerDemo(ruta: string, traer: Traer = fetch): Promise<Blob | null> {
  try {
    const res = await traer(ruta);
    if (!res.ok) return null;
    if (/text\/html/i.test(res.headers.get("content-type") ?? "")) return null;
    const blob = await res.blob();
    return blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}

/** Arma los `File` de las canciones de ejemplo que existan en `/demo/`. */
export async function archivosDeEjemplo(traer: Traer = fetch, nombres = NOMBRES_DEMO): Promise<File[]> {
  const archivos: File[] = [];
  for (const nombre of nombres) {
    const audio = await traerDemo(`/demo/${nombre}`, traer);
    if (audio) archivos.push(new File([audio], nombre, { type: audio.type || "audio/mpeg" }));
    // Trae también la letra .lrc si existe junto al archivo de ejemplo
    const base = nombre.replace(/\.mp3$/i, "");
    const letra = await traerDemo(`/demo/${base}.lrc`, traer);
    if (letra) archivos.push(new File([letra], `${base}.lrc`, { type: "text/plain" }));
  }
  return archivos;
}
