/* Puente de la Media Session: en el navegador tiene que escribir en la Media
   Session API del navegador. (El camino nativo lo cubre el plugin de Android,
   que no se puede probar en Node.) */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* Media Session de mentira, que anota lo que le pide la app */
function sesionFalsa() {
  const acciones = new Map<string, unknown>();
  const estado = {
    metadata: null as unknown,
    playbackState: "none",
    posicion: null as unknown,
    setActionHandler(accion: string, manejador: unknown) {
      acciones.set(accion, manejador);
    },
    setPositionState(datos: unknown) {
      estado.posicion = datos;
    },
  };
  return { acciones, estado };
}

describe("sesión de multimedia", () => {
  let falso: ReturnType<typeof sesionFalsa>;

  beforeEach(() => {
    falso = sesionFalsa();
    vi.stubGlobal("navigator", { mediaSession: falso.estado });
    vi.stubGlobal(
      "MediaMetadata",
      class {
        datos: unknown;
        constructor(datos: unknown) {
          this.datos = datos;
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sin Media Session no hay con qué trabajar", async () => {
    vi.stubGlobal("navigator", {});
    const { haySesion } = await import("./sesion");
    expect(haySesion()).toBe(false);
  });

  it("escribe los metadatos, el estado y la posición", async () => {
    const { haySesion, ponerEstado, ponerMetadatos, ponerPosicion } = await import("./sesion");

    expect(haySesion()).toBe(true);

    ponerMetadatos({ title: "Tema", artist: "Alguien", album: "Demo", artwork: [] });
    expect((falso.estado.metadata as { datos: unknown }).datos).toEqual({
      title: "Tema",
      artist: "Alguien",
      album: "Demo",
      artwork: [],
    });

    ponerEstado("playing");
    expect(falso.estado.playbackState).toBe("playing");

    ponerPosicion(90, 12);
    expect(falso.estado.posicion).toEqual({ duration: 90, position: 12, playbackRate: 1 });
  });

  it("engancha y suelta los controles", async () => {
    const { ponerAccion } = await import("./sesion");
    const manejador = () => {};

    ponerAccion("play", manejador);
    expect(falso.acciones.get("play")).toBe(manejador);

    ponerAccion("play", null);
    expect(falso.acciones.get("play")).toBe(null);
  });
});
