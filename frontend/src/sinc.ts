/* Cliente del backend de sincronización (backend/Vitra.Api).

   El audio nunca se sube: solo metadatos, favoritos, letras (.lrc como texto)
   y listas. Las canciones se emparejan por "nombreArchivo|tamano", así que en
   el otro dispositivo primero hay que importar los mismos archivos de audio.

   Estrategia del merge: gana la versión con la marca "actualizado" más nueva
   (ISO UTC). Los borrados todavía no se propagan. */

import { actualizarPista, crearLista, guardarLista, listarListas, listarPistas, type Lista, type Pista } from "./biblioteca";
import { parsearLrc, serializarLrc, type LineaLetra } from "./letras";

export type PistaSinc = {
  clave: string;
  titulo: string;
  artista: string;
  album: string;
  duracion: number;
  favorito: boolean;
  letra: string | null;
  actualizado: string;
};

export type ListaSinc = {
  nombre: string;
  /* Claves de las pistas, una por línea, en el orden elegido */
  pistas: string;
  actualizado: string;
};

export type Inventario = { pistas: PistaSinc[]; listas: ListaSinc[] };

export type ResultadoSync = {
  pistasSubidas: number;
  pistasActualizadas: number;
  listasSubidas: number;
  listasActualizadas: number;
  /* Canciones que el servidor conoce pero no tenemos importadas (sin audio) */
  sinAudio: number;
};

/* Clave de emparejamiento entre dispositivos */
export function clavePista(p: Pick<Pista, "nombreArchivo" | "tamano">) {
  return `${p.nombreArchivo}|${p.tamano}`;
}

/* Compara dos marcas ISO UTC: como tienen el mismo formato, el orden
   alfabético coincide con el temporal. Vacío = "nunca tocado" = lo más viejo. */
export function masNueva(a: string | undefined, b: string | undefined): boolean {
  return (a ?? "") > (b ?? "");
}

/* Pista local en el formato que viaja (servidor o archivo de respaldo) */
export function aPistaSinc(p: Pista): PistaSinc {
  return {
    clave: clavePista(p),
    titulo: p.titulo,
    artista: p.artista,
    album: p.album,
    duracion: p.duracion,
    favorito: !!p.favorito,
    letra: p.letra && p.letra.length > 0 ? serializarLrc(p.letra) : null,
    actualizado: p.actualizado ?? new Date(0).toISOString(),
  };
}

/* Claves de las pistas de una lista, en orden, una por línea */
export function clavesDeLista(l: Lista, porId: Map<number, Pista>): string {
  return l.pistas
    .map((id) => (porId.has(id) ? clavePista(porId.get(id)!) : null))
    .filter((c): c is string => c !== null)
    .join("\n");
}

/* Lista local en el formato que viaja */
export function aListaSinc(l: Lista, porId: Map<number, Pista>): ListaSinc {
  return {
    nombre: l.nombre,
    pistas: clavesDeLista(l, porId),
    actualizado: l.actualizado ?? new Date(0).toISOString(),
  };
}

/* Traduce las claves de una lista que llega de afuera a los ids locales,
   descartando las canciones cuyo audio no tenemos */
export function idsDeClaves(claves: string, porClave: Map<string, Pista>): number[] {
  return claves
    .split(/\r?\n/)
    .map((clave) => porClave.get(clave.trim())?.id)
    .filter((id): id is number => id !== undefined);
}

/* Aplica los datos de una versión que llega de afuera (servidor o respaldo)
   sobre una pista local. Si no trae letra, se conserva la local: las letras
   nunca se borran solas. */
export function conDatosDeFuera(p: Pista, remota: PistaSinc): Pista {
  let letra: LineaLetra[] | undefined = p.letra;
  if (remota.letra) {
    const l = parsearLrc(remota.letra);
    letra = l.length > 0 ? l : undefined;
  }
  return {
    ...p,
    titulo: remota.titulo,
    artista: remota.artista,
    album: remota.album,
    favorito: remota.favorito,
    letra,
    actualizado: remota.actualizado,
  };
}

async function pedirInventario(base: string): Promise<Inventario> {
  const r = await fetch(`${base}/api/sinc`);
  if (!r.ok) throw new Error(`GET /api/sinc → ${r.status}`);
  return (await r.json()) as Inventario;
}

async function enviar(base: string, ruta: string, metodo: "PUT" | "DELETE", cuerpo?: unknown) {
  const r = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers: cuerpo !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  if (!r.ok) throw new Error(`${metodo} ${ruta} → ${r.status}`);
}

/* Sincroniza el navegador con el servidor: sube lo local más nuevo y baja
   lo del servidor más nuevo. Lee y escribe IndexedDB directamente. */
export async function sincronizar(servidor: string): Promise<ResultadoSync> {
  const base = servidor.trim().replace(/\/+$/, "");
  const inventario = await pedirInventario(base);
  const pistas = await listarPistas();
  const listas = await listarListas();

  const porId = new Map(pistas.map((p) => [p.id, p]));
  const localPorClave = new Map(pistas.map((p) => [clavePista(p), p]));
  const remotaPorClave = new Map(inventario.pistas.map((p) => [p.clave, p]));
  const remotaListaPorNombre = new Map(inventario.listas.map((l) => [l.nombre, l]));

  const res: ResultadoSync = {
    pistasSubidas: 0,
    pistasActualizadas: 0,
    listasSubidas: 0,
    listasActualizadas: 0,
    sinAudio: 0,
  };

  // 1. Sube las pistas que el servidor no tiene o tiene más viejas
  for (const p of pistas) {
    const remota = remotaPorClave.get(clavePista(p));
    if (!remota || masNueva(p.actualizado, remota.actualizado)) {
      await enviar(base, "/api/pistas", "PUT", aPistaSinc(p));
      res.pistasSubidas++;
    }
  }

  // 2. Baja los metadatos más nuevos (solo de las pistas cuyo audio ya tenemos).
  //    Si el servidor no trae letra, se conserva la local: las letras no se borran.
  for (const p of pistas) {
    const remota = remotaPorClave.get(clavePista(p));
    if (!remota || !masNueva(remota.actualizado, p.actualizado)) continue;
    await actualizarPista(conDatosDeFuera(p, remota));
    res.pistasActualizadas++;
  }

  for (const clave of remotaPorClave.keys()) {
    if (!localPorClave.has(clave)) res.sinAudio++;
  }

  // 3. Listas por nombre
  const listaPorNombre = new Map(listas.map((l) => [l.nombre, l]));

  for (const l of listas) {
    const remota = remotaListaPorNombre.get(l.nombre);
    if (!remota || masNueva(l.actualizado, remota.actualizado)) {
      await enviar(base, "/api/listas", "PUT", aListaSinc(l, porId));
      res.listasSubidas++;
    }
  }

  for (const remota of inventario.listas) {
    const local = listaPorNombre.get(remota.nombre);
    if (local && !masNueva(remota.actualizado, local.actualizado)) continue;
    // Traduce las claves a los ids locales; las canciones que no tenemos se omiten
    const ids = idsDeClaves(remota.pistas, localPorClave);
    if (local) await guardarLista({ ...local, pistas: ids }, remota.actualizado);
    else await crearLista(remota.nombre, ids, remota.actualizado);
    res.listasActualizadas++;
  }

  return res;
}
