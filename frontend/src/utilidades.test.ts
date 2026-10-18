import { describe, expect, it } from "vitest";
import { formato, formatoTamano, normalizar } from "./utilidades";

describe("formato", () => {
  it("convierte segundos a m:ss", () => {
    expect(formato(0)).toBe("0:00");
    expect(formato(9)).toBe("0:09");
    expect(formato(65)).toBe("1:05");
    expect(formato(600)).toBe("10:00");
    expect(formato(3599.9)).toBe("59:59");
  });

  it("usa dos dígitos para los segundos", () => {
    expect(formato(61)).toBe("1:01");
    expect(formato(120)).toBe("2:00");
  });

  it("no explota con valores inválidos", () => {
    expect(formato(NaN)).toBe("0:00");
    expect(formato(Infinity)).toBe("0:00");
    expect(typeof formato(-5)).toBe("string"); // negativo: caso que no ocurre en la práctica
  });
});

describe("formatoTamano", () => {
  it("muestra MB para archivos chicos", () => {
    expect(formatoTamano(1024 * 1024)).toBe("1 MB");
    expect(formatoTamano(7.4 * 1024 * 1024)).toBe("7 MB");
  });

  it("muestra GB con un decimal para archivos grandes", () => {
    expect(formatoTamano(1024 * 1024 * 1024)).toBe("1.0 GB");
    expect(formatoTamano(2.5 * 1024 * 1024 * 1024)).toBe("2.5 GB");
  });
});

describe("normalizar", () => {
  it("quita tildes y baja mayúsculas", () => {
    expect(normalizar("Canción")).toBe("cancion");
    expect(normalizar("ÁÉÍÓÚÜÑ")).toBe("aeiouun");
    expect(normalizar("JÁTACA")).toBe("jataca");
  });

  it("deja el resto igual", () => {
    expect(normalizar("rock & roll 80s")).toBe("rock & roll 80s");
    expect(normalizar("")).toBe("");
  });
});
