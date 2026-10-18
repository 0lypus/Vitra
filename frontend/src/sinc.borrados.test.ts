/* Borrados en la sincronización: viajan como "tumbas" (borrado: true) de los
   dos lados y compiten por la marca "actualizado" igual que las ediciones. */

import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import {
  crearLista,
  eliminarLista,
  eliminarPista,
  guardarPista,
  listarBorrados,
  listarListas,
  listarPistas,
  type Lista,
  type Pista,
} from "./biblioteca";
import { clavePista, perdioContraServidor, sincronizar, type ListaSinc, type PistaSinc } from "./sinc";

const VIEJA = "2026-01-01T00:00:00.000Z";
const MAS_NUEVA = "2026-09-01T00:00:00.000Z";

function json(datos: unknown) {
  return new Response(JSON.stringify(datos), { status: 200, headers: { "Content-Type": "application/json" } });
}

/* Servidor de mentira que aplica el mismo criterio que el de verdad:
   gana la versión con la marca más nueva */
function servidorFalso(inicial: { pistas?: PistaSinc[]; listas?: ListaSinc[] } = {}) {
  const pistas = new Map((inicial.pistas ?? []).map((p) => [p.clave, p]));
  const listas = new Map((inicial.listas ?? []).map((l) => [l.nombre, l]));

  globalThis.fetch = vi.fn(async (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    const url = String(entrada);
    if (url.endsWith("/api/sinc")) return json({ pistas: [...pistas.values()], listas: [...listas.values()] });
    const cuerpo = opciones?.body ? JSON.parse(String(opciones.body)) : undefined;
    if (url.endsWith("/api/pistas")) {
      // Como el DTO del backend: "borrado" viene opcional y cuenta como false
      const llega = { ...cuerpo, borrado: cuerpo.borrado === true };
      const existente = pistas.get(llega.clave);
      if (!existente || llega.actualizado >= existente.actualizado) pistas.set(llega.clave, llega);
      return new Response(null, { status: 200 });
    }
    if (url.endsWith("/api/listas")) {
      const llega = { ...cuerpo, borrado: cuerpo.borrado === true };
      const existente = listas.get(llega.nombre);
      if (!existente || llega.actualizado >= existente.actualizado) listas.set(llega.nombre, llega);
      return new Response(null, { status: 200 });
    }
    return new Response(null, { status: 404 });
  }) as unknown as typeof fetch;

  return { pistas, listas };
}

let contador = 0;

/* Inserta una pista local con nombre y tamaño únicos (o sea, clave única) */
async function agregar(extra: Partial<Pista> = {}): Promise<Pista> {
  contador++;
  return guardarPista(
    {
      titulo: `Tema ${contador}`,
      artista: "Alguien",
      album: "Demo",
      duracion: 10,
      nombreArchivo: `tema${contador}.mp3`,
      tamano: 3000 + contador,
      actualizado: VIEJA,
      ...extra,
    },
    new Blob([new Uint8Array([contador])]),
  );
}

function pistaSinc(sobre: Partial<PistaSinc> & { clave: string }): PistaSinc {
  return {
    titulo: "Título",
    artista: "Alguien",
    album: "Demo",
    duracion: 10,
    favorito: false,
    letra: null,
    actualizado: VIEJA,
    ...sobre,
  };
}

async function tieneTumba(tipo: "pista" | "lista", clave: string) {
  return (await listarBorrados()).some((b) => b.tipo === tipo && b.clave === clave);
}

describe("perdioContraServidor", () => {
  it("perde contra lo que el servidor tiene igual de nuevo o más nuevo", () => {
    expect(perdioContraServidor({ actualizado: MAS_NUEVA, borrado: true }, VIEJA)).toBe(true);
    expect(perdioContraServidor({ actualizado: VIEJA, borrado: true }, VIEJA)).toBe(true);
    // También contra una versión viva más nueva: ahí el borrado no tiene chance
    expect(perdioContraServidor({ actualizado: MAS_NUEVA }, VIEJA)).toBe(true);
  });

  it("gana si el servidor no tiene nada o lo tiene más viejo", () => {
    expect(perdioContraServidor(undefined, VIEJA)).toBe(false);
    expect(perdioContraServidor({ actualizado: VIEJA, borrado: true }, MAS_NUEVA)).toBe(false);
  });
});

describe("borrar una canción en casa", () => {
  it("deja una tumba, la sube al servidor y se olvida cuando el servidor la confirma", async () => {
    const p = await agregar();
    const servidor = servidorFalso();

    await eliminarPista(p.id);
    expect(await tieneTumba("pista", clavePista(p))).toBe(true);

    const res = await sincronizar("http://servidor", "");
    expect(res.borradosSubidos).toBe(1);
    expect(servidor.pistas.get(clavePista(p))?.borrado).toBe(true);
    // Sigue local: solo se borra cuando la vemos confirmada en el servidor
    expect(await tieneTumba("pista", clavePista(p))).toBe(true);

    await sincronizar("http://servidor", "");
    expect(await tieneTumba("pista", clavePista(p))).toBe(false);
  });
});

describe("un borrado del servidor", () => {
  it("borra la canción en casa, la saca de las listas y no se cuentan fantasmas como sin audio", async () => {
    const p = await agregar({ titulo: "Se va" });
    await crearLista("Con el borrado", [p.id]);
    servidorFalso({ pistas: [pistaSinc({ clave: clavePista(p), actualizado: MAS_NUEVA, borrado: true })] });

    const res = await sincronizar("http://servidor", "");

    expect(res.borradosAplicados).toBe(1);
    expect(res.sinAudio).toBe(0);
    expect((await listarPistas()).some((x) => x.id === p.id)).toBe(false);
    const lista = (await listarListas()).find((l: Lista) => l.nombre === "Con el borrado");
    expect(lista?.pistas).not.toContain(p.id);
    // No se deja tumba local: el servidor ya sabe que se borró
    expect(await tieneTumba("pista", clavePista(p))).toBe(false);
  });

  it("no borra una edición local más nueva: el borrado pierde y la canción se sube", async () => {
    const p = await agregar({ titulo: "Sigo acá", actualizado: MAS_NUEVA });
    const servidor = servidorFalso({ pistas: [pistaSinc({ clave: clavePista(p), actualizado: VIEJA, borrado: true })] });

    const res = await sincronizar("http://servidor", "");

    expect((await listarPistas()).some((x) => x.id === p.id)).toBe(true);
    expect(res.borradosAplicados).toBe(0);
    // Y le avisa al servidor que la canción vuelve a existir
    expect(servidor.pistas.get(clavePista(p))?.borrado).toBe(false);
    expect(servidor.pistas.get(clavePista(p))?.titulo).toBe("Sigo acá");
  });
});

describe("re-importar el audio", () => {
  it("cancela el borrado pendiente, para no borrar lo que acaba de volver", async () => {
    const p = await agregar();
    await eliminarPista(p.id);
    expect(await tieneTumba("pista", clavePista(p))).toBe(true);

    await guardarPista(
      {
        titulo: "Otra vez",
        artista: "Alguien",
        album: "Demo",
        duracion: 10,
        nombreArchivo: p.nombreArchivo,
        tamano: p.tamano,
        actualizado: MAS_NUEVA,
      },
      new Blob([new Uint8Array([9])]),
    );

    expect(await tieneTumba("pista", clavePista(p))).toBe(false);
  });
});

describe("las listas", () => {
  it("también se tumban al borrarlas en casa", async () => {
    await crearLista("Para borrar");
    const l = (await listarListas()).find((x) => x.nombre === "Para borrar");
    expect(l).toBeDefined();
    const servidor = servidorFalso();

    await eliminarLista(l!.id);
    const res = await sincronizar("http://servidor", "");

    expect(res.borradosSubidos).toBeGreaterThanOrEqual(1);
    expect(servidor.listas.get("Para borrar")?.borrado).toBe(true);
  });

  it("y un borrado del servidor las borra en casa", async () => {
    await crearLista("De afuera", [], MAS_NUEVA);
    servidorFalso({ listas: [{ nombre: "De afuera", pistas: "", actualizado: MAS_NUEVA, borrado: true }] });

    const res = await sincronizar("http://servidor", "");

    expect((await listarListas()).some((x) => x.nombre === "De afuera")).toBe(false);
    expect(res.borradosAplicados).toBeGreaterThanOrEqual(1);
  });
});
