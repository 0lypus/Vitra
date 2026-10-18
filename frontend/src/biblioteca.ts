import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type Pista = {
  id: number;
  titulo: string;
  artista: string;
  album: string;
  duracion: number;
  caratula?: Blob;
  nombreArchivo: string;
  tamano: number;
};

type NuevaPista = Omit<Pista, "id">;

interface VitraDB extends DBSchema {
  pistas: { key: number; value: Pista };
  archivos: { key: number; value: Blob };
}

let dbPromise: Promise<IDBPDatabase<VitraDB>> | undefined;

function abrir() {
  dbPromise ??= openDB<VitraDB>("vitra", 1, {
    upgrade(db) {
      db.createObjectStore("pistas", { keyPath: "id", autoIncrement: true });
      db.createObjectStore("archivos");
    },
  });
  return dbPromise;
}

/* Reduce la carátula a 256 px para ahorrar espacio y memoria */
async function reducirCaratula(original: Blob, max = 256): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(original);
    const escala = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * escala));
    const h = Math.max(1, Math.round(bmp.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.8));
  } catch {
    return null;
  }
}

/* Lee las etiquetas del archivo (la librería se carga recién al agregar música) */
export async function leerMetadatos(archivo: File): Promise<NuevaPista> {
  const base = archivo.name.replace(/\.[^/.]+$/, "");
  let titulo = base;
  let artista = "Artista desconocido";
  let album = "";
  let duracion = 0;
  let caratula: Blob | undefined;

  try {
    const { parseBlob, selectCover } = await import("music-metadata");
    const meta = await parseBlob(archivo);
    titulo = meta.common.title?.trim() || base;
    artista = meta.common.artist?.trim() || artista;
    album = meta.common.album?.trim() || "";
    duracion = meta.format.duration ?? 0;

    const cover = selectCover(meta.common.picture);
    if (cover) {
      const original = new Blob([new Uint8Array(cover.data)], { type: cover.format });
      caratula = (await reducirCaratula(original)) ?? undefined;
    }
  } catch {
    /* sin etiquetas legibles: queda el nombre del archivo */
  }

  return { titulo, artista, album, duracion, caratula, nombreArchivo: archivo.name, tamano: archivo.size };
}

export async function listarPistas(): Promise<Pista[]> {
  return (await abrir()).getAll("pistas");
}

export async function guardarPista(nueva: NuevaPista, archivo: Blob): Promise<Pista> {
  const db = await abrir();
  const tx = db.transaction(["pistas", "archivos"], "readwrite");
  const id = await tx.objectStore("pistas").add(nueva as Pista);
  await tx.objectStore("archivos").put(archivo, id);
  await tx.done;
  return { ...nueva, id };
}

export async function obtenerArchivo(id: number): Promise<Blob | undefined> {
  return (await abrir()).get("archivos", id);
}

export async function eliminarPista(id: number): Promise<void> {
  const db = await abrir();
  const tx = db.transaction(["pistas", "archivos"], "readwrite");
  await tx.objectStore("pistas").delete(id);
  await tx.objectStore("archivos").delete(id);
  await tx.done;
}

export async function espacioUsado(): Promise<number | null> {
  try {
    const estimado = await navigator.storage?.estimate?.();
    return estimado?.usage ?? null;
  } catch {
    return null;
  }
}

/* Pide al navegador que no borre la biblioteca si falta espacio */
export function pedirAlmacenamientoPersistente() {
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* no disponible */
  }
}