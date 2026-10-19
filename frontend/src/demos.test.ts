import { describe, expect, it } from "vitest";
import { archivosDeEjemplo, traerDemo } from "./demos";

/* Respuestas como las del servidor de la app */
const audio = (bytes = 2000) =>
  new Response(new Uint8Array(bytes), { status: 200, headers: { "content-type": "audio/mpeg" } });
const letra = (texto: string) =>
  new Response(texto, { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
/* Cuando el archivo no existe, la SPA contesta index.html con un 200 */
const paginaHtml = () =>
  new Response("<!doctype html><title>Vitra</title>", { status: 200, headers: { "content-type": "text/html" } });
const noEsta = () => new Response("", { status: 404 });

describe("traerDemo", () => {
  it("devuelve el blob cuando el archivo es audio", async () => {
    const blob = await traerDemo("/demo/demo1.mp3", async () => audio());
    expect(blob?.type).toBe("audio/mpeg");
  });

  it("descarta el HTML que el servidor devuelve cuando el archivo no existe", async () => {
    expect(await traerDemo("/demo/demo2.mp3", async () => paginaHtml())).toBeNull();
  });

  it("descarta las respuestas vacías", async () => {
    expect(await traerDemo("/demo/demo1.mp3", async () => audio(0))).toBeNull();
  });

  it("descarta los 404", async () => {
    expect(await traerDemo("/demo/demo1.mp3", async () => noEsta())).toBeNull();
  });

  it("descarta los errores de red", async () => {
    const sinRed = async () => {
      throw new Error("sin red");
    };
    expect(await traerDemo("/demo/demo1.mp3", sinRed)).toBeNull();
  });
});

describe("archivosDeEjemplo", () => {
  /** Solo existe demo1 con su letra; lo demás cae en el index.html de la SPA */
  const servidor = async (ruta: string) => {
    if (ruta === "/demo/demo1.mp3") return audio();
    if (ruta === "/demo/demo1.lrc") return letra("[00:01.00] primera linea");
    return paginaHtml();
  };

  it("trae solo los demos que existen, con su letra", async () => {
    const archivos = await archivosDeEjemplo(servidor, ["demo1.mp3", "demo2.mp3", "demo3.mp3"]);
    expect(archivos.map((a) => a.name)).toEqual(["demo1.mp3", "demo1.lrc"]);
  });

  it("no inventa canciones cuando no hay ninguna (el bug de las 3 fantasma)", async () => {
    const archivos = await archivosDeEjemplo(async () => paginaHtml(), ["demo1.mp3", "demo2.mp3", "demo3.mp3"]);
    expect(archivos).toEqual([]);
  });

  it("pide la letra que acompaña a cada canción", async () => {
    const pedidas: string[] = [];
    await archivosDeEjemplo(async (ruta) => {
      pedidas.push(ruta);
      return paginaHtml();
    }, ["demo1.mp3"]);
    expect(pedidas).toEqual(["/demo/demo1.mp3", "/demo/demo1.lrc"]);
  });

  it("marca el audio como audio y la letra como texto", async () => {
    const archivos = await archivosDeEjemplo(servidor, ["demo1.mp3"]);
    expect(archivos.map((a) => a.type)).toEqual(["audio/mpeg", "text/plain"]);
  });

  it("con todos los demos presentes trae los tres y solo la letra que existe", async () => {
    const completo = async (ruta: string) => {
      if (ruta.endsWith(".mp3")) return audio();
      if (ruta === "/demo/demo2.lrc") return letra("[00:02.00] hola");
      return paginaHtml();
    };
    const archivos = await archivosDeEjemplo(completo, ["demo1.mp3", "demo2.mp3", "demo3.mp3"]);
    expect(archivos.map((a) => a.name)).toEqual(["demo1.mp3", "demo2.mp3", "demo2.lrc", "demo3.mp3"]);
  });
});
