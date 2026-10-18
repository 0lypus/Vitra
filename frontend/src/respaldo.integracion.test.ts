/* Prueba de integración del respaldo: IndexedDB de mentira (fake-indexeddb). */

import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  alternarFavorito,
  crearLista,
  eliminarLista,
  eliminarPista,
  guardarLetra,
  guardarPista,
  listarListas,
  listarPistas,
  type Pista,
} from "./biblioteca";
import { aplicarRespaldo, crearRespaldo, leerRespaldo } from "./respaldo";
import { clavePista, type PistaSinc } from "./sinc";

const VIEJA = "2026-01-01T00:00:00.000Z";
const NUEVA = "2026-06-01T00:00:00.000Z";
const MAS_NUEVA = "2026-09-01T00:00:00.000Z";

let contador = 0;

/* Inserta una pista local con nombre y tamaño únicos (o sea, clave única) */
async function agregarCon(nombreArchivo: string, tamano: number, extra: Partial<Pista> = {}): Promise<Pista> {
  contador++;
  return guardarPista(
    {
      titulo: `Tema ${contador}`,
      artista: "Alguien",
      album: "Demo",
      duracion: 10,
      nombreArchivo,
      tamano,
      ...extra,
    },
    new Blob([new Uint8Array([contador])]),
  );
}

async function agregar(extra: Partial<Pista> = {}): Promise<Pista> {
  contador++;
  return agregarCon(`tema${contador}.mp3`, 1000 + contador, extra);
}

function pistaRespaldo(sobre: Partial<PistaSinc> & { clave: string }): PistaSinc {
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

function respaldo(pistas: PistaSinc[], listas: { nombre: string; pistas: string; actualizado?: string }[] = []) {
  return leerRespaldo(
    JSON.stringify({
      version: 1,
      exportado: NUEVA,
      pistas,
      listas: listas.map((l) => ({ actualizado: VIEJA, ...l })),
    }),
  );
}

describe("aplicarRespaldo", () => {
  it("aplica favorito, letra y metadatos sobre una canción que ya tenemos", async () => {
    const p = await agregar();
    const r = respaldo([
      pistaRespaldo({
        clave: clavePista(p),
        titulo: "Editado",
        favorito: true,
        letra: "[00:02.00]chau",
        actualizado: NUEVA,
      }),
    ]);

    const res = await aplicarRespaldo(r);

    expect(res.pistasAplicadas).toBe(1);
    expect(res.sinAudio).toBe(0);
    const local = (await listarPistas()).find((x) => x.id === p.id);
    expect(local?.titulo).toBe("Editado");
    expect(local?.favorito).toBe(true);
    expect(local?.letra).toEqual([{ t: 2, texto: "chau" }]);
  });

  it("cuenta las canciones sin audio y no las crea", async () => {
    const antes = (await listarPistas()).length;
    const r = respaldo([pistaRespaldo({ clave: "no-la-tengo.mp3|5", actualizado: NUEVA })]);

    const res = await aplicarRespaldo(r);

    expect(res.pistasAplicadas).toBe(0);
    expect(res.sinAudio).toBe(1);
    expect((await listarPistas()).length).toBe(antes);
  });

  it("no pisa datos locales más nuevos", async () => {
    const p = await agregar({ actualizado: MAS_NUEVA, titulo: "Mío" });
    const r = respaldo([pistaRespaldo({ clave: clavePista(p), titulo: "Viejo", actualizado: NUEVA })]);

    const res = await aplicarRespaldo(r);

    expect(res.pistasAplicadas).toBe(0);
    expect((await listarPistas()).find((x) => x.id === p.id)?.titulo).toBe("Mío");
  });

  it("crea una lista del respaldo con las canciones que tenemos, en orden", async () => {
    const a = await agregar();
    const b = await agregar();
    const r = respaldo([], [{ nombre: "Del respaldo", pistas: `${clavePista(b)}\n${clavePista(a)}\najena.mp3|777`, actualizado: NUEVA }]);

    const res = await aplicarRespaldo(r);

    expect(res.listasAplicadas).toBe(1);
    const lista = (await listarListas()).find((l) => l.nombre === "Del respaldo");
    expect(lista?.pistas).toEqual([b.id, a.id]);
  });

  it("ida y vuelta: respaldar, quedarse sin biblioteca y restaurar", async () => {
    const a = await agregarCon("ciclo-a.mp3", 111);
    const b = await agregarCon("ciclo-b.mp3", 222);
    await alternarFavorito(a.id, true);
    await guardarLetra(b.id, [{ t: 3, texto: "letra" }]);
    const lista = await crearLista("Ciclo", [b.id, a.id]);

    const texto = crearRespaldo(await listarPistas(), await listarListas());

    // Se borra todo, como si el navegador hubiera limpiado los datos
    await eliminarPista(a.id);
    await eliminarPista(b.id);
    await eliminarLista(lista.id);
    expect((await listarListas()).find((l) => l.nombre === "Ciclo")).toBeUndefined();

    // Se vuelven a agregar los mismos archivos: ids nuevos y sin datos
    const a2 = await agregarCon("ciclo-a.mp3", 111);
    const b2 = await agregarCon("ciclo-b.mp3", 222);
    expect((await listarPistas()).find((x) => x.id === a2.id)?.favorito).toBeFalsy();
    expect((await listarPistas()).find((x) => x.id === b2.id)?.letra).toBeUndefined();

    const res = await aplicarRespaldo(leerRespaldo(texto));

    expect(res.sinAudio).toBe(0);
    expect(res.listasAplicadas).toBe(1);
    expect((await listarPistas()).find((x) => x.id === a2.id)?.favorito).toBe(true);
    expect((await listarPistas()).find((x) => x.id === b2.id)?.letra).toEqual([{ t: 3, texto: "letra" }]);
    expect((await listarListas()).find((l) => l.nombre === "Ciclo")?.pistas).toEqual([b2.id, a2.id]);
  });
});
