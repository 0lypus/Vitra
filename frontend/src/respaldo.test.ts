import { describe, expect, it } from "vitest";
import type { Lista, Pista } from "./biblioteca";
import { VERSION_RESPALDO, crearRespaldo, leerRespaldo, nombreArchivoRespaldo } from "./respaldo";

function pista(id: number, nombreArchivo: string, tamano: number, extra: Partial<Pista> = {}): Pista {
  return {
    id,
    titulo: nombreArchivo.replace(/\.[^/.]+$/, ""),
    artista: "Alguien",
    album: "Demo",
    duracion: 30,
    nombreArchivo,
    tamano,
    ...extra,
  };
}

const biblioteca = [
  pista(1, "uno.mp3", 1000, { favorito: true, actualizado: "2026-10-18T10:00:00.000Z" }),
  pista(2, "dos.mp3", 2000, {
    letra: [
      { t: 1, texto: "hola" },
      { t: 2.5, texto: "chau" },
    ],
    actualizado: "2026-10-18T11:00:00.000Z",
  }),
];

const listas: Lista[] = [
  { id: 7, nombre: "Fiesta", pistas: [2, 1], actualizado: "2026-10-18T12:00:00.000Z" },
];

describe("crearRespaldo", () => {
  it("arma un JSON con versión, fecha y las pistas convertidas", () => {
    const r = JSON.parse(crearRespaldo(biblioteca, listas));
    expect(r.version).toBe(VERSION_RESPALDO);
    expect(r.exportado).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(r.pistas).toHaveLength(2);
    expect(r.pistas[0].clave).toBe("uno.mp3|1000");
    expect(r.pistas[0].favorito).toBe(true);
    expect(r.pistas[1].letra).toBe("[00:01.00]hola\n[00:02.50]chau");
  });

  it("guarda las listas como claves, en el orden elegido", () => {
    const r = JSON.parse(crearRespaldo(biblioteca, listas));
    expect(r.listas[0]).toMatchObject({ nombre: "Fiesta" });
    expect(r.listas[0].pistas).toBe("dos.mp3|2000\nuno.mp3|1000");
  });

  it("no exporta el audio ni la carátula", () => {
    const texto = crearRespaldo([pista(1, "uno.mp3", 1000, { caratula: new Blob(["x"]) })], []);
    expect(texto).not.toContain("caratula");
    expect(texto).not.toContain("Blob");
  });
});

describe("leerRespaldo", () => {
  it("ida y vuelta: lo que se exporta se vuelve a leer igual", () => {
    const r = leerRespaldo(crearRespaldo(biblioteca, listas));
    expect(r.pistas).toHaveLength(2);
    expect(r.pistas[0].clave).toBe("uno.mp3|1000");
    expect(r.listas[0].pistas).toBe("dos.mp3|2000\nuno.mp3|1000");
  });

  it("rechaza un archivo que no es JSON", () => {
    expect(() => leerRespaldo("no soy json")).toThrow(/JSON/);
  });

  it("rechaza un JSON que no es un respaldo", () => {
    expect(() => leerRespaldo("[1, 2, 3]")).toThrow(/no parece un respaldo/);
    expect(() => leerRespaldo('{"pistas": []}')).toThrow(/no parece un respaldo/);
  });

  it("rechaza un respaldo de una versión más nueva", () => {
    const futuro = JSON.stringify({ version: VERSION_RESPALDO + 1, pistas: [], listas: [] });
    expect(() => leerRespaldo(futuro)).toThrow(/más nueva/);
  });

  it("descarta las entradas con forma inválida", () => {
    const mezcla = JSON.stringify({
      version: 1,
      pistas: [{ clave: "uno.mp3|1000", titulo: "Uno", artista: "", album: "", duracion: 10 }, { clave: 7 }, "cualquiera"],
      listas: [{ nombre: "   " }, 5],
    });
    const r = leerRespaldo(mezcla);
    expect(r.pistas).toHaveLength(1);
    expect(r.listas).toHaveLength(0);
  });

  it("rechaza un respaldo sin nada aprovechable", () => {
    const vacio = JSON.stringify({ version: 1, pistas: [{ clave: 3 }], listas: [] });
    expect(() => leerRespaldo(vacio)).toThrow(/no tiene canciones ni listas/);
  });
});

describe("nombreArchivoRespaldo", () => {
  it("incluye la fecha del día", () => {
    expect(nombreArchivoRespaldo(new Date("2026-10-18T15:00:00.000Z"))).toBe("vitra-respaldo-2026-10-18.json");
  });
});
