import { describe, expect, it } from "vitest";
import { agregarAlFinal, limpiarCola, moverEnCola, quitarDeCola, reproducirAContinuacion, sacarSiguiente } from "./cola";

const existe = (id: number) => [1, 2, 3].includes(id);

describe("agregarAlFinal", () => {
  it("suma al final", () => {
    expect(agregarAlFinal([1, 2], 3)).toEqual([1, 2, 3]);
  });

  it("no repite: si ya estaba, la mueve al final", () => {
    expect(agregarAlFinal([1, 2, 3], 1)).toEqual([2, 3, 1]);
  });

  it("no toca la cola original", () => {
    const cola = [1];
    agregarAlFinal(cola, 2);
    expect(cola).toEqual([1]);
  });
});

describe("reproducirAContinuacion", () => {
  it("la pone primera para que suene enseguida", () => {
    expect(reproducirAContinuacion([2, 3], 1)).toEqual([1, 2, 3]);
  });

  it("si ya estaba, la adelanta sin duplicarla", () => {
    expect(reproducirAContinuacion([1, 2, 3], 3)).toEqual([3, 1, 2]);
  });
});

describe("quitarDeCola", () => {
  it("saca todas las apariciones", () => {
    expect(quitarDeCola([1, 2, 1], 1)).toEqual([2]);
  });

  it("si no estaba, deja todo igual", () => {
    expect(quitarDeCola([1, 2], 9)).toEqual([1, 2]);
  });
});

describe("moverEnCola", () => {
  it("intercambia con la de al lado", () => {
    expect(moverEnCola([1, 2, 3], 2, -1)).toEqual([2, 1, 3]);
    expect(moverEnCola([1, 2, 3], 2, 1)).toEqual([1, 3, 2]);
  });

  it("no hace nada en los bordes", () => {
    expect(moverEnCola([1, 2], 1, -1)).toEqual([1, 2]);
    expect(moverEnCola([1, 2], 2, 1)).toEqual([1, 2]);
  });

  it("no hace nada si la canción no está en la cola", () => {
    expect(moverEnCola([1, 2], 9, 1)).toEqual([1, 2]);
  });
});

describe("limpiarCola", () => {
  it("descarta las canciones que ya no existen", () => {
    expect(limpiarCola([1, 99, 2], existe)).toEqual([1, 2]);
  });

  it("devuelve la misma cola si no hay nada que limpiar", () => {
    const cola = [1, 2];
    expect(limpiarCola(cola, existe)).toBe(cola);
  });
});

describe("sacarSiguiente", () => {
  it("saca la primera y deja el resto", () => {
    expect(sacarSiguiente([1, 2, 3], existe)).toEqual({ id: 1, cola: [2, 3] });
  });

  it("saltea las canciones que ya no existen", () => {
    expect(sacarSiguiente([99, 2, 3], existe)).toEqual({ id: 2, cola: [3] });
  });

  it("devuelve null y la cola vacía cuando no queda nada", () => {
    expect(sacarSiguiente([], existe)).toEqual({ id: null, cola: [] });
    expect(sacarSiguiente([99], existe)).toEqual({ id: null, cola: [] });
  });
});
