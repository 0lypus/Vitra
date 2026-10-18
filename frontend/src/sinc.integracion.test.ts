/* Prueba de integración de la sincronización: IndexedDB de mentira
   (fake-indexeddb) + un servidor de mentira en memoria. */

import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { crearLista, guardarPista, listarListas, listarPistas, type Pista } from "./biblioteca";
import { clavePista, sincronizar, type ListaSinc, type PistaSinc } from "./sinc";

const VIEJA = "2026-01-01T00:00:00.000Z";
const NUEVA = "2026-06-01T00:00:00.000Z";
const MAS_NUEVA = "2026-09-01T00:00:00.000Z";

function json(datos: unknown) {
  return new Response(JSON.stringify(datos), { status: 200, headers: { "Content-Type": "application/json" } });
}

/* Servidor de mentira: devuelve lo que tiene y se queda con lo que le mandan */
function servidorFalso(inicial: { pistas?: PistaSinc[]; listas?: ListaSinc[] } = {}) {
  const pistas = new Map((inicial.pistas ?? []).map((p) => [p.clave, p]));
  const listas = new Map((inicial.listas ?? []).map((l) => [l.nombre, l]));

  globalThis.fetch = vi.fn(async (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    const url = String(entrada);
    if (url.endsWith("/api/sinc")) return json({ pistas: [...pistas.values()], listas: [...listas.values()] });
    const cuerpo = opciones?.body ? JSON.parse(String(opciones.body)) : undefined;
    if (url.endsWith("/api/pistas")) {
      pistas.set(cuerpo.clave, cuerpo);
      return new Response(null, { status: 200 });
    }
    if (url.endsWith("/api/listas")) {
      listas.set(cuerpo.nombre, cuerpo);
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
      tamano: 1000 + contador,
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

describe("sincronizar", () => {
  it("sube las pistas y las listas locales que el servidor no tiene", async () => {
    const p = await agregar();
    await crearLista("Fiesta", [p.id]);
    const servidor = servidorFalso();

    const res = await sincronizar("http://servidor");

    expect(res.pistasSubidas).toBe(1);
    expect(res.listasSubidas).toBe(1);
    expect(servidor.pistas.has(clavePista(p))).toBe(true);
    expect(servidor.listas.get("Fiesta")?.pistas).toBe(clavePista(p));
  });

  it("baja del servidor lo que esté más nuevo", async () => {
    const p = await agregar();
    servidorFalso({
      pistas: [
        pistaSinc({
          clave: clavePista(p),
          titulo: "Editado en el otro dispositivo",
          favorito: true,
          letra: "[00:01.00]hola",
          actualizado: NUEVA,
        }),
      ],
    });

    const res = await sincronizar("http://servidor");

    expect(res.pistasActualizadas).toBe(1);
    const local = (await listarPistas()).find((x) => x.id === p.id);
    expect(local?.titulo).toBe("Editado en el otro dispositivo");
    expect(local?.favorito).toBe(true);
    expect(local?.letra).toEqual([{ t: 1, texto: "hola" }]);
  });

  it("no pisa una pista local más nueva que la del servidor", async () => {
    const p = await agregar({ actualizado: MAS_NUEVA, titulo: "Mío" });
    const servidor = servidorFalso({
      pistas: [pistaSinc({ clave: clavePista(p), titulo: "Viejo", actualizado: NUEVA })],
    });

    const res = await sincronizar("http://servidor");

    expect(res.pistasActualizadas).toBe(0);
    // La base de mentira se comparte entre tests: puede subir también otras pistas
    expect(res.pistasSubidas).toBeGreaterThanOrEqual(1);
    expect(servidor.pistas.get(clavePista(p))?.titulo).toBe("Mío");
    expect((await listarPistas()).find((x) => x.id === p.id)?.titulo).toBe("Mío");
  });

  it("cuenta las canciones que el servidor conoce y nosotros no tenemos", async () => {
    const antes = (await listarPistas()).length;
    servidorFalso({ pistas: [pistaSinc({ clave: "ajena.mp3|777", actualizado: NUEVA })] });

    const res = await sincronizar("http://servidor");

    expect(res.sinAudio).toBe(1);
    expect((await listarPistas()).length).toBe(antes);
  });

  it("baja una lista del servidor traduciendo las claves a los ids locales", async () => {
    const a = await agregar();
    const b = await agregar();
    servidorFalso({
      listas: [
        {
          nombre: "Del servidor",
          pistas: `${clavePista(b)}\n${clavePista(a)}\najena.mp3|777`,
          actualizado: NUEVA,
        },
      ],
    });

    const res = await sincronizar("http://servidor");

    expect(res.listasActualizadas).toBe(1);
    const lista = (await listarListas()).find((l) => l.nombre === "Del servidor");
    // El orden del servidor se respeta y la canción que no tenemos se saltea
    expect(lista?.pistas).toEqual([b.id, a.id]);
  });
});
