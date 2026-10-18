/* Respaldo de la biblioteca en un archivo JSON.

   Guarda lo mismo que viajaría al backend de sincronización (metadatos,
   favoritos, letras y listas), así que sirve como copia de seguridad y también
   para pasar los datos a otro dispositivo a mano.

   Los archivos de audio no entran en el respaldo (pesan muchísimo): después de
   importarlo hay que volver a agregar los mismos audios para que las canciones
   queden completas. El emparejamiento es por "nombreArchivo|tamano". */

import {
  actualizarPista,
  crearLista,
  guardarLista,
  listarListas,
  listarPistas,
  type Lista,
  type Pista,
} from "./biblioteca";
import {
  aListaSinc,
  aPistaSinc,
  clavePista,
  conDatosDeFuera,
  idsDeClaves,
  masNueva,
  type ListaSinc,
  type PistaSinc,
} from "./sinc";

export const VERSION_RESPALDO = 1;

export type Respaldo = {
  version: number;
  exportado: string;
  pistas: PistaSinc[];
  listas: ListaSinc[];
};

export type ResultadoRespaldo = {
  pistasAplicadas: number;
  listasAplicadas: number;
  /* Canciones que el respaldo conoce pero no tenemos importadas (sin audio) */
  sinAudio: number;
};

/* Nombre del archivo que se descarga, con la fecha del día */
export function nombreArchivoRespaldo(fecha = new Date()): string {
  return `vitra-respaldo-${fecha.toISOString().slice(0, 10)}.json`;
}

/* Arma el texto JSON del respaldo a partir de la biblioteca actual */
export function crearRespaldo(pistas: Pista[], listas: Lista[]): string {
  const porId = new Map(pistas.map((p) => [p.id, p]));
  const respaldo: Respaldo = {
    version: VERSION_RESPALDO,
    exportado: new Date().toISOString(),
    pistas: pistas.map(aPistaSinc),
    listas: listas.map((l) => aListaSinc(l, porId)),
  };
  return JSON.stringify(respaldo, null, 2);
}

function esPistaSinc(v: unknown): v is PistaSinc {
  const p = v as Partial<PistaSinc> | null;
  return (
    !!p &&
    typeof p.clave === "string" &&
    p.clave.includes("|") &&
    typeof p.titulo === "string" &&
    typeof p.artista === "string" &&
    typeof p.album === "string" &&
    typeof p.duracion === "number"
  );
}

function esListaSinc(v: unknown): v is ListaSinc {
  const l = v as Partial<ListaSinc> | null;
  return !!l && typeof l.nombre === "string" && l.nombre.trim().length > 0 && typeof l.pistas === "string";
}

/* Lee el texto de un archivo de respaldo y valida que sea de Vitra.
   Si no sirve, tira Error con un mensaje que se le puede mostrar al usuario. */
export function leerRespaldo(texto: string): Respaldo {
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    throw new Error("El archivo no es un JSON válido.");
  }
  if (typeof crudo !== "object" || crudo === null) throw new Error("El archivo no parece un respaldo de Vitra.");

  const r = crudo as Partial<Respaldo>;
  if (typeof r.version !== "number" || !Array.isArray(r.pistas) || !Array.isArray(r.listas)) {
    throw new Error("El archivo no parece un respaldo de Vitra.");
  }
  if (r.version > VERSION_RESPALDO) throw new Error("El respaldo lo hizo una versión más nueva de Vitra.");

  // Se descartan las entradas con forma rara (archivo tocado a mano)
  const pistas = r.pistas.filter(esPistaSinc);
  const listas = r.listas.filter(esListaSinc);
  if (pistas.length === 0 && listas.length === 0) throw new Error("El respaldo no tiene canciones ni listas.");

  return {
    version: r.version,
    exportado: typeof r.exportado === "string" ? r.exportado : "",
    pistas,
    listas,
  };
}

/* Aplica un respaldo sobre la biblioteca: solo pisa lo que esté más viejo y
   omite las canciones cuyo audio no tengamos. Lee y escribe IndexedDB. */
export async function aplicarRespaldo(respaldo: Respaldo): Promise<ResultadoRespaldo> {
  const pistas = await listarPistas();
  const listas = await listarListas();
  const porClave = new Map(pistas.map((p) => [clavePista(p), p]));
  const listaPorNombre = new Map(listas.map((l) => [l.nombre, l]));

  const res: ResultadoRespaldo = { pistasAplicadas: 0, listasAplicadas: 0, sinAudio: 0 };

  for (const remota of respaldo.pistas) {
    const local = porClave.get(remota.clave);
    if (!local) {
      res.sinAudio++;
      continue;
    }
    if (!masNueva(remota.actualizado, local.actualizado)) continue;
    await actualizarPista(conDatosDeFuera(local, remota));
    res.pistasAplicadas++;
  }

  for (const remota of respaldo.listas) {
    const local = listaPorNombre.get(remota.nombre);
    if (local && !masNueva(remota.actualizado, local.actualizado)) continue;
    const ids = idsDeClaves(remota.pistas, porClave);
    if (local) await guardarLista({ ...local, pistas: ids }, remota.actualizado);
    else await crearLista(remota.nombre, ids, remota.actualizado);
    res.listasAplicadas++;
  }

  return res;
}
