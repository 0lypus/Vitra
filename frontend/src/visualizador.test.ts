import { describe, expect, it } from "vitest";
import { altoBarra, barrasLogaritmicas, valorBarra, type Barra } from "./visualizador";

describe("barrasLogaritmicas", () => {
  it("cubre todos los bins sin huecos ni solapes", () => {
    const barras = barrasLogaritmicas(128, 64);
    const cubiertos = barras.flatMap((b) => Array.from({ length: b.hasta - b.desde }, (_, i) => b.desde + i));

    expect(barras[0].desde).toBe(0);
    expect(barras[barras.length - 1].hasta).toBe(128);
    expect(cubiertos).toEqual(Array.from({ length: 128 }, (_, i) => i));
  });

  it("hace tantas barras como se le piden", () => {
    expect(barrasLogaritmicas(128, 64)).toHaveLength(64);
    expect(barrasLogaritmicas(128, 16)).toHaveLength(16);
  });

  it("da un bin entero a los primeros graves", () => {
    const barras = barrasLogaritmicas(128, 64);

    // Cada barra inicial toma un solo bin: ahí está el movimiento de los graves
    expect(barras[0]).toEqual({ desde: 0, hasta: 1 });
    expect(barras[1]).toEqual({ desde: 1, hasta: 2 });
  });

  it("agrupa varios bins en los agudos, donde hay menos energía", () => {
    const barras = barrasLogaritmicas(128, 64);

    const primera = barras[0].hasta - barras[0].desde;
    const ultima = barras[barras.length - 1].hasta - barras[barras.length - 1].desde;
    expect(ultima).toBeGreaterThan(primera);
  });

  it("no se pasa del total ni se queda corta si le piden más barras que bins", () => {
    const barras = barrasLogaritmicas(4, 10);

    expect(barras).toHaveLength(10);
    expect(barras.every((b) => b.hasta <= 4)).toBe(true);
    expect(barras.some((b) => b.hasta === b.desde)).toBe(true); // las últimas quedan vacías
  });

  it("aguanta bins o barras en cero sin partirse", () => {
    expect(barrasLogaritmicas(0, 4).every((b) => b.desde === 0 && b.hasta === 0)).toBe(true);
    expect(barrasLogaritmicas(128, 0)).toHaveLength(1);
  });
});

describe("valorBarra", () => {
  it("toma el máximo del rango", () => {
    const datos = [10, 200, 5, 30];
    expect(valorBarra(datos, { desde: 0, hasta: 4 })).toBe(200);
    expect(valorBarra(datos, { desde: 2, hasta: 4 })).toBe(30);
    expect(valorBarra(datos, { desde: 3, hasta: 3 })).toBe(0);
  });
});

describe("altoBarra", () => {
  it("en silencio queda en el mínimo, para que se vea la línea", () => {
    expect(altoBarra(0, 100)).toBe(2);
  });

  it("al máximo llena el canvas", () => {
    expect(altoBarra(255, 100)).toBe(100);
  });

  it("levanta los valores chicos (así se mueven también los agudos)", () => {
    // Un valor flojo tiene que dibujar más alto que si fuera lineal
    expect(altoBarra(80, 100)).toBeGreaterThan((80 / 255) * 100);
  });

  it("crece con el valor y no se va del canvas", () => {
    const altos = [0, 30, 80, 150, 200, 255].map((v) => altoBarra(v, 100));
    expect(altos).toEqual([...altos].sort((a, b) => a - b));
    expect(altos[altos.length - 1]).toBeLessThanOrEqual(100);

    expect(altoBarra(999, 100)).toBe(100);
    expect(altoBarra(-5, 100)).toBe(2);
  });
});

describe("el reparto completo", () => {
  it("el máximo de la última barra de agudos sigue siendo sonido", () => {
    // Con reparto lineal esta barra se quedaría en el mínimo: ese es el bug
    const datos: number[] = new Array(128).fill(0);
    datos[0] = 255; // un golpe de bombo
    datos[127] = 60; // un golpecito de agudos

    const barras = barrasLogaritmicas(128, 64);
    const ultima: Barra = barras[barras.length - 1];

    expect(valorBarra(datos, ultima)).toBe(60);
    expect(altoBarra(valorBarra(datos, ultima), 100)).toBeGreaterThan(20);
  });
});
