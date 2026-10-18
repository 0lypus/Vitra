/* Clave de acceso del backend: que viaje en el encabezado X-Clave y que un 401
   se distinga del resto de los errores. */

import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { guardarPista } from "./biblioteca";
import { ENCABEZADO_CLAVE, ErrorHttp, sincronizar } from "./sinc";

/* Servidor de mentira que anota con qué encabezados le llegó cada pedido */
function servidorFalso(estado = 200) {
  const pedidos: { url: string; metodo: string; clave: string | null }[] = [];
  globalThis.fetch = vi.fn(async (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    pedidos.push({
      url: String(entrada),
      metodo: opciones?.method ?? "GET",
      clave: new Headers(opciones?.headers).get(ENCABEZADO_CLAVE),
    });
    if (estado !== 200) return new Response(null, { status: estado });
    if (String(entrada).endsWith("/api/sinc")) {
      return new Response(JSON.stringify({ pistas: [], listas: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(null, { status: 200 });
  }) as unknown as typeof fetch;
  return pedidos;
}

async function agregar(n: number) {
  return guardarPista(
    {
      titulo: `Clave ${n}`,
      artista: "Alguien",
      album: "Demo",
      duracion: 5,
      nombreArchivo: `clave${n}.mp3`,
      tamano: 5000 + n,
    },
    new Blob([new Uint8Array([n])]),
  );
}

describe("clave de acceso del backend", () => {
  it("manda el encabezado X-Clave en cada pedido cuando hay clave", async () => {
    await agregar(1);
    const pedidos = servidorFalso();

    await sincronizar("http://servidor", "secreta");

    expect(pedidos.some((p) => p.metodo === "PUT")).toBe(true); // hubo algo para subir
    expect(pedidos.every((p) => p.clave === "secreta")).toBe(true);
  });

  it("no manda el encabezado cuando no hay clave", async () => {
    const pedidos = servidorFalso();

    await sincronizar("http://servidor");

    expect(pedidos.length).toBeGreaterThan(0);
    expect(pedidos.every((p) => p.clave === null)).toBe(true);
  });

  it("recorta los espacios de la clave", async () => {
    const pedidos = servidorFalso();

    await sincronizar("http://servidor", "  secreta  ");

    expect(pedidos[0].clave).toBe("secreta");
  });

  it("un 401 llega como ErrorHttp con el código, para avisar de la clave", async () => {
    servidorFalso(401);

    const error = await sincronizar("http://servidor", "mala").then(
      () => null,
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ErrorHttp);
    expect((error as ErrorHttp).status).toBe(401);
  });
});
