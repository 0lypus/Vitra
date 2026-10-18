/* Cliente del backend de sincronización (backend/Vitra.Api).

   El audio nunca se sube: solo metadatos, favoritos, letras (.lrc como texto)
   y listas. Las canciones se emparejan por "nombreArchivo|tamano", así que en
   el otro dispositivo primero hay que importar los mismos archivos de audio.

   Estrategia del merge: gana la versión con la marca "actualizado" más nueva
   (ISO UTC). Los borrados se propagan como "tumbas" (borrado: true) con su
   propia marca, así que también compiten: si el borrado es lo más nuevo, se
   borra en el otro extremo; si alguien lo editó después, vuelve a existir.

   Si el backend tiene clave configurada, se manda en el encabezado X-Clave. */

import {
  actualizarPista,
  clavePista,
  crearLista,
  eliminarBorrado,
  eliminarLista,
  eliminarPista,
  guardarLista,
  listarBorrados,
  listarListas,
  listarPistas,
  type Lista,
  type Pista,
} from "./biblioteca";
import { parsearLrc, serializarLrc, type LineaLetra } from "./letras";

/* La clave vive en biblioteca.ts; se re-exporta acá por comodidad */
export { clavePista };

/* Encabezado con el que viaja la clave del backend */
export const ENCABEZADO_CLAVE = "X-Clave";

/* Error con el código HTTP a mano, para poder distinguir "el servidor pide
   clave" (401) de "no llegué al servidor" */
export class ErrorHttp extends Error {
  readonly status: number;

  constructor(status: number, mensaje: string) {
    super(mensaje);
    this.name = "ErrorHttp";
    this.status = status;
  }
}

export type PistaSinc = {
  clave: string;
  titulo: string;
  artista: string;
  album: string;
  duracion: number;
  favorito: boolean;
  letra: string | null;
  actualizado: string;
  /* true = tumba: la canción se borró en el otro extremo */
  borrado?: boolean;
};

export type ListaSinc = {
  nombre: string;
  /* Claves de las pistas, una por línea, en el orden elegido */
  pistas: string;
  actualizado: string;
  /* true = tumba: la lista se borró en el otro extremo */
  borrado?: boolean;
};

export type Inventario = { pistas: PistaSinc[]; listas: ListaSinc[] };

export type ResultadoSync = {
  pistasSubidas: number;
  pistasActualizadas: number;
  listasSubidas: number;
  listasActualizadas: number;
  /* Borrados que le avisamos al servidor y borrados que trajimos y aplicamos */
  borradosSubidos: number;
  borradosAplicados: number;
  /* Canciones que el servidor conoce pero no tenemos importadas (sin audio) */
  sinAudio: number;
};

/* Compara dos marcas ISO UTC: como tienen el mismo formato, el orden
   alfabético coincide con el temporal. Vacío = "nunca tocado" = lo más viejo. */
export function masNueva(a: string | undefined, b: string | undefined): boolean {
  return (a ?? "") > (b ?? "");
}

/* ¿Esta tumba local ya perdió contra lo que tiene el servidor? Vale cuando el
   servidor tiene algo (una versión viva o su propia tumba) igual de nuevo o
   más nuevo: en ese caso ya no hace falta subirla y se puede olvidar. */
export function perdioContraServidor(
  remota: { actualizado: string; borrado?: boolean } | undefined,
  en: string,
): boolean {
  return remota !== undefined && !masNueva(en, remota.actualizado);
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

/* Encabezados de una petición: la clave (si hay) y el tipo de cuerpo */
function cabeceras(clave: string, conCuerpo: boolean): Record<string, string> | undefined {
  const h: Record<string, string> = {};
  if (clave.trim()) h[ENCABEZADO_CLAVE] = clave.trim();
  if (conCuerpo) h["Content-Type"] = "application/json";
  return Object.keys(h).length > 0 ? h : undefined;
}

async function pedirInventario(base: string, clave: string): Promise<Inventario> {
  const r = await fetch(`${base}/api/sinc`, { headers: cabeceras(clave, false) });
  if (!r.ok) throw new ErrorHttp(r.status, `GET /api/sinc → ${r.status}`);
  return (await r.json()) as Inventario;
}

async function enviar(base: string, ruta: string, metodo: "PUT" | "DELETE", cuerpo: unknown, clave: string) {
  const r = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers: cabeceras(clave, cuerpo !== undefined),
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  if (!r.ok) throw new ErrorHttp(r.status, `${metodo} ${ruta} → ${r.status}`);
}

/* Sincroniza el navegador con el servidor: sube lo local más nuevo, baja lo
   del servidor más nuevo y propaga los borrados de los dos lados. Lee y
   escribe IndexedDB directamente. */
export async function sincronizar(servidor: string, clave = ""): Promise<ResultadoSync> {
  const base = servidor.trim().replace(/\/+$/, "");
  const inventario = await pedirInventario(base, clave);
  const pistas = await listarPistas();
  const listas = await listarListas();
  const borrados = await listarBorrados();

  const porId = new Map(pistas.map((p) => [p.id, p]));
  const localPorClave = new Map(pistas.map((p) => [clavePista(p), p]));
  const remotaPorClave = new Map(inventario.pistas.map((p) => [p.clave, p]));
  const remotaListaPorNombre = new Map(inventario.listas.map((l) => [l.nombre, l]));
  const listaPorNombre = new Map(listas.map((l) => [l.nombre, l]));

  const res: ResultadoSync = {
    pistasSubidas: 0,
    pistasActualizadas: 0,
    listasSubidas: 0,
    listasActualizadas: 0,
    borradosSubidos: 0,
    borradosAplicados: 0,
    sinAudio: 0,
  };

  // Cosas que se borraron en este pase: no hay que subirlas ni bajar nada sobre ellas
  const borradasPistas = new Set<number>();
  const borradasListas = new Set<number>();

  /* Saca una pista de todas las listas locales. Al quedar modificadas, las
     listas se marcan solas para subirse más abajo (les estampa la marca). */
  const quitarDeListas = async (id: number) => {
    for (let i = 0; i < listas.length; i++) {
      const l = listas[i];
      if (!l.pistas.includes(id)) continue;
      const nueva = { ...l, pistas: l.pistas.filter((x) => x !== id) };
      await guardarLista(nueva);
      listas[i] = nueva;
    }
  };

  /* 1. Tumbas locales: si el servidor ya tiene algo igual de nuevo o más
        nuevo, ya cumplió y se borra del local; si no, se la contamos. */
  for (const b of borrados) {
    const remota = b.tipo === "pista" ? remotaPorClave.get(b.clave) : remotaListaPorNombre.get(b.clave);
    if (perdioContraServidor(remota, b.en)) {
      await eliminarBorrado(b.tipo, b.clave);
      continue;
    }
    if (b.tipo === "pista") {
      await enviar(
        base,
        "/api/pistas",
        "PUT",
        {
          clave: b.clave,
          titulo: "",
          artista: "",
          album: "",
          duracion: 0,
          favorito: false,
          letra: null,
          actualizado: b.en,
          borrado: true,
        },
        clave,
      );
    } else {
      await enviar(base, "/api/listas", "PUT", { nombre: b.clave, pistas: "", actualizado: b.en, borrado: true }, clave);
    }
    res.borradosSubidos++;
  }

  /* 2. Borrados del servidor: se borra acá lo que no esté más nuevo. La tumba
        no se copia al local: ya está registrada del lado del servidor. */
  for (const remota of inventario.pistas) {
    if (remota.borrado !== true) continue;
    const local = localPorClave.get(remota.clave);
    if (!local || masNueva(local.actualizado, remota.actualizado)) continue;
    await eliminarPista(local.id, false);
    borradasPistas.add(local.id);
    await quitarDeListas(local.id);
    res.borradosAplicados++;
  }

  for (const remota of inventario.listas) {
    if (remota.borrado !== true) continue;
    const local = listaPorNombre.get(remota.nombre);
    if (!local || masNueva(local.actualizado, remota.actualizado)) continue;
    await eliminarLista(local.id, false);
    listaPorNombre.delete(remota.nombre);
    borradasListas.add(local.id);
    res.borradosAplicados++;
  }

  /* 3. Sube las pistas que el servidor no tiene o tiene más viejas. Si el
        servidor tiene una tumba más nueva, la pista ya salió del camino. */
  for (const p of pistas) {
    if (borradasPistas.has(p.id)) continue;
    const remota = remotaPorClave.get(clavePista(p));
    if (!remota || masNueva(p.actualizado, remota.actualizado)) {
      await enviar(base, "/api/pistas", "PUT", aPistaSinc(p), clave);
      res.pistasSubidas++;
    }
  }

  /* 4. Baja los metadatos más nuevos (solo de las pistas cuyo audio tenemos).
        Si el servidor no trae letra, se conserva la local: no se borra sola. */
  for (const p of pistas) {
    if (borradasPistas.has(p.id)) continue;
    const remota = remotaPorClave.get(clavePista(p));
    if (!remota || remota.borrado === true || !masNueva(remota.actualizado, p.actualizado)) continue;
    await actualizarPista(conDatosDeFuera(p, remota));
    res.pistasActualizadas++;
  }

  for (const [c, remota] of remotaPorClave) {
    // Las tumbas del servidor no son canciones que falten importar
    if (!localPorClave.has(c) && remota.borrado !== true) res.sinAudio++;
  }

  /* 5. Listas por nombre */
  for (const l of listas) {
    if (borradasListas.has(l.id)) continue;
    const remota = remotaListaPorNombre.get(l.nombre);
    if (!remota || masNueva(l.actualizado, remota.actualizado)) {
      await enviar(base, "/api/listas", "PUT", aListaSinc(l, porId), clave);
      res.listasSubidas++;
    }
  }

  for (const remota of inventario.listas) {
    if (remota.borrado === true) continue; // las tumbas ya se aplicaron arriba
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
