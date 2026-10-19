import { describe, expect, it } from "vitest";
import { leerMetadatos } from "./biblioteca";

/* Arma un WAV mínimo y válido: 44 bytes de cabecera y un décimo de segundo de
   silencio (8 bits, 8000 Hz). Sirve para probar el camino "sí es audio". */
function wav(frames = 800) {
  const datos = new Uint8Array(frames).fill(128);
  const cabecera = new ArrayBuffer(44);
  const v = new DataView(cabecera);
  const texto = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(pos + i, s.charCodeAt(i));
  };
  texto(0, "RIFF");
  v.setUint32(4, 36 + datos.length, true);
  texto(8, "WAVE");
  texto(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true); // un byte por muestra
  v.setUint16(34, 8, true);
  texto(36, "data");
  v.setUint32(40, datos.length, true);
  return new File([cabecera, datos], "silencio.wav", { type: "audio/wav" });
}

describe("leerMetadatos", () => {
  it("lee un audio válido y saca el título del nombre si no hay etiquetas", async () => {
    const { pista, legible } = await leerMetadatos(wav());
    expect(legible).toBe(true);
    expect(pista.titulo).toBe("silencio");
    expect(pista.duracion).toBeGreaterThan(0);
  });

  it("marca como ilegible un archivo que no es audio", async () => {
    const basura = new File([new Uint8Array(1000)], "roto.mp3", { type: "audio/mpeg" });
    const { pista, legible } = await leerMetadatos(basura);
    expect(legible).toBe(false);
    expect(pista.titulo).toBe("roto"); // de todos modos queda el nombre a mano
  });

  it("un .lrc no es audio", async () => {
    const lrc = new File(["[00:01.00] una linea"], "letra.lrc", { type: "text/plain" });
    expect((await leerMetadatos(lrc)).legible).toBe(false);
  });

  it("un archivo vacío tampoco", async () => {
    expect((await leerMetadatos(new File([], "vacio.mp3", { type: "audio/mpeg" }))).legible).toBe(false);
  });
});
