/* Puente de la Media Session.
 *
 * En el navegador usa la Media Session API del navegador.
 * En la app de Android usa el plugin @capgo/capacitor-media-session, que además
 * levanta un servicio de primer plano: es lo que hace que el audio siga sonando
 * con la pantalla apagada o la app en segundo plano.
 *
 * El plugin se carga solo cuando corre en la app (import diferido), así la
 * versión web no lo baja.
 */

import { Capacitor } from "@capacitor/core";

export interface ImagenSesion {
  src: string;
  sizes?: string;
  type?: string;
}

export interface MetadatosSesion {
  title: string;
  artist: string;
  album: string;
  artwork: ImagenSesion[];
}

export type EstadoSesion = "none" | "paused" | "playing";
export type AccionSesion = "play" | "pause" | "previoustrack" | "nexttrack" | "seekto" | "stop";

type Manejador = (detalles: { seekTime?: number | null }) => void;

interface PluginSesion {
  setMetadata(datos: MetadatosSesion): Promise<void>;
  setPlaybackState(estado: { playbackState: EstadoSesion }): Promise<void>;
  setActionHandler(opciones: { action: AccionSesion }, manejador: Manejador | null): Promise<void>;
  setPositionState(posicion: { duration: number; position: number; playbackRate: number }): Promise<void>;
}

const enLaApp = Capacitor.isNativePlatform();

let carga: Promise<PluginSesion | null> | null = null;

function plugin(): Promise<PluginSesion | null> {
  if (!carga) {
    carga = import("@capgo/capacitor-media-session")
      .then((modulo) => (modulo as unknown as { MediaSession: PluginSesion }).MediaSession)
      .catch(() => null);
  }
  return carga;
}

/** ¿Hay con qué manejar la sesión en esta plataforma? */
export function haySesion(): boolean {
  return enLaApp || (typeof navigator !== "undefined" && "mediaSession" in navigator);
}

export function ponerMetadatos(datos: MetadatosSesion): void {
  if (enLaApp) {
    void plugin().then((p) => p?.setMetadata(datos).catch(() => {}));
    return;
  }
  try {
    navigator.mediaSession.metadata = new MediaMetadata(datos);
  } catch {
    /* algunos navegadores pueden fallar */
  }
}

export function ponerEstado(estado: EstadoSesion): void {
  if (enLaApp) {
    void plugin().then((p) => p?.setPlaybackState({ playbackState: estado }).catch(() => {}));
    return;
  }
  try {
    navigator.mediaSession.playbackState = estado;
  } catch {
    /* algunos navegadores pueden fallar */
  }
}

export function ponerAccion(accion: AccionSesion, manejador: Manejador | null): void {
  if (enLaApp) {
    void plugin().then((p) => p?.setActionHandler({ action: accion }, manejador).catch(() => {}));
    return;
  }
  try {
    navigator.mediaSession.setActionHandler(
      accion as MediaSessionAction,
      manejador as unknown as MediaSessionActionHandler | null,
    );
  } catch {
    /* algunos navegadores pueden fallar */
  }
}

export function ponerPosicion(duration: number, position: number, playbackRate = 1): void {
  if (enLaApp) {
    void plugin().then((p) => p?.setPositionState({ duration, position, playbackRate }).catch(() => {}));
    return;
  }
  try {
    navigator.mediaSession.setPositionState?.({ duration, position, playbackRate });
  } catch {
    /* algunos navegadores no soportan esto */
  }
}
