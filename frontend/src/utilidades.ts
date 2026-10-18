/* Funciones puras sin dependencias de la interfaz, para poder testearlas */

/* Segundos a "m:ss" */
export function formato(seg: number) {
  if (!Number.isFinite(seg)) return "0:00";
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/* Bytes a "MB" o "GB" */
export function formatoTamano(bytes: number) {
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

/* Quita tildes y pasa a minúsculas, para buscar sin importar mayúsculas ni acentos */
export function normalizar(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
