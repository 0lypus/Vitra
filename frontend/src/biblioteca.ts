import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { LineaLetra } from "./letras";

export type Pista = {
  id: number;
  titulo: string;
  artista: string;
  album: string;
  duracion: number;
  caratula?: Blob;
  /* Color dominante de la carátula en formato rgb(r, g, b), para el fondo dinámico */
  color?: string;
  /* Letra sincronizada (.lrc) si la tiene */
  letra?: LineaLetra[];
  favorito?: boolean;
  nombreArchivo: string;
  tamano: number;
  /* Última modificación (ISO UTC): decide qué versión gana al sincronizar */
  actualizado?: string;
};

/* Nombre del archivo sin la extensión, para emparejar audio con su .lrc */
export function baseNombre(nombre: string) {
  return nombre.replace(/\.[^/.]+$/, "");
}

/* Clave de emparejamiento entre dispositivos: "nombreArchivo|tamano".
   Los ids de IndexedDB cambian en cada navegador, así que no sirven. */
export function clavePista(p: Pick<Pista, "nombreArchivo" | "tamano">) {
  return `${p.nombreArchivo}|${p.tamano}`;
}

type NuevaPista = Omit<Pista, "id">;

/* Lista de reproducción: ids de pistas en el orden elegido */
export type Lista = {
  id: number;
  nombre: string;
  pistas: number[];
  actualizado?: string;
};

type NuevaLista = Omit<Lista, "id">;

/* Borrado pendiente de sincronizar (tumba): lo que hay que contarle al
   servidor. Vive hasta que el servidor confirma que lo tiene. */
export type Borrado = {
  tipo: "pista" | "lista";
  /* Clave sincronizada: "nombreArchivo|tamano" para pistas, nombre para listas */
  clave: string;
  /* ISO UTC del borrado */
  en: string;
};

interface VitraDB extends DBSchema {
  pistas: { key: number; value: Pista };
  archivos: { key: number; value: Blob };
  listas: { key: number; value: Lista };
  borrados: { key: [string, string]; value: Borrado };
}

let dbPromise: Promise<IDBPDatabase<VitraDB>> | undefined;

function abrir() {
  dbPromise ??= openDB<VitraDB>("vitra", 3, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore("pistas", { keyPath: "id", autoIncrement: true });
        db.createObjectStore("archivos");
      }
      if (oldVersion < 2) {
        db.createObjectStore("listas", { keyPath: "id", autoIncrement: true });
      }
      if (oldVersion < 3) {
        db.createObjectStore("borrados", { keyPath: ["tipo", "clave"] });
      }
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

/* Conversión RGB (0-255) a HSL (h 0-1, s 0-1, l 0-1) */
export function rgbAHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

/* Conversión HSL (h 0-1, s 0-1, l 0-1) a RGB (0-255) */
export function hslARgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

/* Saca el color dominante de una carátula (grilla de 16x16) y lo deja vivo
   para que se note como tinte sobre el fondo. Devuelve "rgb(r, g, b)" o null. */
export async function extraerColor(blob: Blob): Promise<string | null> {
  try {
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bmp.close();
      return null;
    }
    ctx.drawImage(bmp, 0, 0, 16, 16);
    bmp.close();
    const data = ctx.getImageData(0, 0, 16, 16).data;
    let r = 0;
    let g = 0;
    let b = 0;
    const n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    const [h, s, l] = rgbAHsl(r / n, g / n, b / n);
    const [rr, gg, bb] = hslARgb(h, Math.max(0.5, s), 0.45 + Math.min(l, 1) * 0.25);
    return `rgb(${rr}, ${gg}, ${bb})`;
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
  let color: string | undefined;

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
      if (caratula) color = (await extraerColor(caratula)) ?? undefined;
    }
  } catch {
    /* sin etiquetas legibles: queda el nombre del archivo */
  }

  return {
    titulo,
    artista,
    album,
    duracion,
    caratula,
    color,
    nombreArchivo: archivo.name,
    tamano: archivo.size,
    actualizado: new Date().toISOString(),
  };
}

export async function listarPistas(): Promise<Pista[]> {
  return (await abrir()).getAll("pistas");
}

export async function guardarPista(nueva: NuevaPista, archivo: Blob): Promise<Pista> {
  const db = await abrir();
  const tx = db.transaction(["pistas", "archivos", "borrados"], "readwrite");
  const id = await tx.objectStore("pistas").add(nueva as Pista);
  await tx.objectStore("archivos").put(archivo, id);
  // Volver a importar el audio cancela su borrado pendiente, si lo hubiera
  await tx.objectStore("borrados").delete(["pista", clavePista(nueva)]);
  await tx.done;
  return { ...nueva, id };
}

export async function obtenerArchivo(id: number): Promise<Blob | undefined> {
  return (await abrir()).get("archivos", id);
}

/* Borra una pista y su archivo. Con "tumba" deja un registro del borrado para
   que el servidor se entere al sincronizar; se omite cuando el borrado viene
   del propio servidor, porque ahí ya está registrado. */
export async function eliminarPista(id: number, tumba = true): Promise<void> {
  const db = await abrir();
  const tx = db.transaction(["pistas", "archivos", "borrados"], "readwrite");
  const pista = await tx.objectStore("pistas").get(id);
  await tx.objectStore("pistas").delete(id);
  await tx.objectStore("archivos").delete(id);
  if (tumba && pista) {
    await tx.objectStore("borrados").put({ tipo: "pista", clave: clavePista(pista), en: new Date().toISOString() });
  }
  await tx.done;
}

/* Guarda (o reemplaza) la letra sincronizada de una pista ya importada */
export async function guardarLetra(id: number, letra: LineaLetra[]): Promise<void> {
  const db = await abrir();
  const tx = db.transaction("pistas", "readwrite");
  const pista = await tx.store.get(id);
  if (pista) await tx.store.put({ ...pista, letra, actualizado: new Date().toISOString() });
  await tx.done;
}

/* Marca o desmarca una pista como favorita */
export async function alternarFavorito(id: number, favorito: boolean): Promise<void> {
  const db = await abrir();
  const tx = db.transaction("pistas", "readwrite");
  const pista = await tx.store.get(id);
  if (pista) await tx.store.put({ ...pista, favorito, actualizado: new Date().toISOString() });
  await tx.done;
}

/* Guarda los metadatos editados a mano (título, artista, álbum) */
export async function guardarMetadatos(id: number, cambios: Pick<Pista, "titulo" | "artista" | "album">): Promise<void> {
  const db = await abrir();
  const tx = db.transaction("pistas", "readwrite");
  const pista = await tx.store.get(id);
  if (pista) await tx.store.put({ ...pista, ...cambios, actualizado: new Date().toISOString() });
  await tx.done;
}

/* Reemplaza una pista entera (la usa la sincronización al bajar cambios del servidor) */
export async function actualizarPista(pista: Pista): Promise<void> {
  await (await abrir()).put("pistas", pista);
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

/* Listas de reproducción */
export async function listarListas(): Promise<Lista[]> {
  return (await abrir()).getAll("listas");
}

export async function crearLista(
  nombre: string,
  pistas: number[] = [],
  actualizado = new Date().toISOString(),
): Promise<Lista> {
  const db = await abrir();
  const limpio = nombre.trim();
  const tx = db.transaction(["listas", "borrados"], "readwrite");
  const nueva: NuevaLista = { nombre: limpio, pistas, actualizado };
  const id = await tx.objectStore("listas").add(nueva as Lista);
  // Crear de nuevo una lista con ese nombre cancela su borrado pendiente
  await tx.objectStore("borrados").delete(["lista", limpio]);
  await tx.done;
  return { ...nueva, id };
}

/* Guarda una lista; le estampa la marca de sincronización (o la que se pase a mano) */
export async function guardarLista(lista: Lista, actualizado = new Date().toISOString()): Promise<void> {
  await (await abrir()).put("listas", { ...lista, actualizado });
}

export async function eliminarLista(id: number, tumba = true): Promise<void> {
  const db = await abrir();
  const tx = db.transaction(["listas", "borrados"], "readwrite");
  const lista = await tx.objectStore("listas").get(id);
  await tx.objectStore("listas").delete(id);
  if (tumba && lista) {
    await tx.objectStore("borrados").put({ tipo: "lista", clave: lista.nombre, en: new Date().toISOString() });
  }
  await tx.done;
}

/* Borrados pendientes de contarle al servidor */
export async function listarBorrados(): Promise<Borrado[]> {
  return (await abrir()).getAll("borrados");
}

export async function eliminarBorrado(tipo: Borrado["tipo"], clave: string): Promise<void> {
  await (await abrir()).delete("borrados", [tipo, clave]);
}