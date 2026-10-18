import { describe, expect, it } from "vitest";
import { clavePista, masNueva } from "./sinc";

describe("clavePista", () => {
  it("usa nombreArchivo|tamano como clave de emparejamiento", () => {
    expect(clavePista({ nombreArchivo: "tema.mp3", tamano: 4096 })).toBe("tema.mp3|4096");
  });

  it("distingue dos archivos con el mismo nombre y distinto tamaño", () => {
    const a = clavePista({ nombreArchivo: "tema.mp3", tamano: 4096 });
    const b = clavePista({ nombreArchivo: "tema.mp3", tamano: 8192 });
    expect(a).not.toBe(b);
  });
});

describe("masNueva", () => {
  it("compara las marcas ISO como textos (mismo formato, mismo orden)", () => {
    expect(masNueva("2026-10-18T12:00:00.000Z", "2026-10-18T11:00:00.000Z")).toBe(true);
    expect(masNueva("2026-10-18T11:00:00.000Z", "2026-10-18T12:00:00.000Z")).toBe(false);
  });

  it("no considera más nueva a una marca igual", () => {
    expect(masNueva("2026-10-18T12:00:00.000Z", "2026-10-18T12:00:00.000Z")).toBe(false);
  });

  it("trata la marca ausente como lo más viejo", () => {
    expect(masNueva("2026-10-18T12:00:00.000Z", undefined)).toBe(true);
    expect(masNueva(undefined, "2026-10-18T12:00:00.000Z")).toBe(false);
    expect(masNueva(undefined, undefined)).toBe(false);
  });
});
