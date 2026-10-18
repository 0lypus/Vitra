import { describe, expect, it } from "vitest";
import { clavePista } from "./sinc";

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
