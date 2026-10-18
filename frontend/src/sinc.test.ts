import { describe, expect, it } from "vitest";
import { clavePista, masNueva, servidorSugerido } from "./sinc";

describe("servidorSugerido", () => {
  it("en la compu apunta a localhost con el puerto del backend", () => {
    expect(servidorSugerido("localhost")).toBe("http://localhost:5041");
  });

  it("desde el celular usa la misma IP con la que se abrió la app", () => {
    expect(servidorSugerido("192.168.0.10")).toBe("http://192.168.0.10:5041");
  });

  it("entrecomilla las direcciones IPv6", () => {
    expect(servidorSugerido("::1")).toBe("http://[::1]:5041");
    expect(servidorSugerido("fd00::1")).toBe("http://[fd00::1]:5041");
  });

  it("si no hay host cae en localhost y acepta otro puerto", () => {
    expect(servidorSugerido("  ")).toBe("http://localhost:5041");
    expect(servidorSugerido("192.168.0.10", 5199)).toBe("http://192.168.0.10:5199");
  });
});

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
