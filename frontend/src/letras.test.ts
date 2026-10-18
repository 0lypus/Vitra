import { describe, expect, it } from "vitest";
import { parsearLrc, serializarLrc } from "./letras";

describe("parsearLrc", () => {
  it("parsea marcas [mm:ss] y [mm:ss.x]", () => {
    const texto = "[00:10.5]primera línea\n[01:02]segunda línea";
    expect(parsearLrc(texto)).toEqual([
      { t: 10.5, texto: "primera línea" },
      { t: 62, texto: "segunda línea" },
    ]);
  });

  it("acepta centésimas y milésimas", () => {
    expect(parsearLrc("[00:01.25]a")[0].t).toBeCloseTo(1.25);
    expect(parsearLrc("[00:01.250]b")[0].t).toBeCloseTo(1.25);
    expect(parsearLrc("[00:01:25]c")[0].t).toBeCloseTo(1.25); // separador ":" también es válido
  });

  it("admite varias marcas en la misma línea", () => {
    const r = parsearLrc("[00:10][00:50]estribillo");
    expect(r).toEqual([
      { t: 10, texto: "estribillo" },
      { t: 50, texto: "estribillo" },
    ]);
  });

  it("ordena las líneas por tiempo aunque vengan desordenadas", () => {
    const r = parsearLrc("[00:50]b\n[00:10]a\n[01:00]c");
    expect(r.map((l) => l.texto)).toEqual(["a", "b", "c"]);
  });

  it("aplica el desfase [offset:±ms]", () => {
    // Adelanta 500 ms: 10.0 - 0.5 → 9.5
    expect(parsearLrc("[offset:+500]\n[00:10.0]línea")[0].t).toBeCloseTo(9.5);
    // Atrasa 300 ms: 10.0 + 0.3 → 10.3
    expect(parsearLrc("[offset:-300]\n[00:10.0]línea")[0].t).toBeCloseTo(10.3);
  });

  it("ignora metadatos y líneas sin marca", () => {
    const texto = "[ar:Artista]\n[ti:Título]\ntexto libre\n[00:05]con marca";
    expect(parsearLrc(texto)).toEqual([{ t: 5, texto: "con marca" }]);
  });

  it("permite líneas vacías (para pausas en la letra)", () => {
    expect(parsearLrc("[00:05]")).toEqual([{ t: 5, texto: "" }]);
  });

  it("devuelve [] si no hay ninguna marca", () => {
    expect(parsearLrc("solo texto\n[ar:algo]")).toEqual([]);
  });

  it("no permite tiempos negativos (offset muy grande)", () => {
    expect(parsearLrc("[offset:+60000]\n[00:10]línea")[0].t).toBe(0);
  });

  it("funciona con fin de línea Windows (CRLF)", () => {
    const r = parsearLrc("[00:01]a\r\n[00:02]b\r\n");
    expect(r).toEqual([
      { t: 1, texto: "a" },
      { t: 2, texto: "b" },
    ]);
  });
});

describe("serializarLrc", () => {
  it("genera marcas [mm:ss.xx] con dos dígitos de centésimas", () => {
    expect(
      serializarLrc([
        { t: 1, texto: "a" },
        { t: 62.5, texto: "b" },
      ]),
    ).toBe("[00:01.00]a\n[01:02.50]b");
  });

  it("ida y vuelta conserva líneas y tiempos", () => {
    const lineas = [
      { t: 0, texto: "inicio" },
      { t: 10.5, texto: "con tilde: canción" },
      { t: 72.25, texto: "" },
      { t: 300, texto: "final" },
    ];
    expect(parsearLrc(serializarLrc(lineas))).toEqual(lineas);
  });
});
