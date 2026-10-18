/* Parser propio de letras sincronizadas en formato .lrc */

export type LineaLetra = { t: number; texto: string };

/* [mm:ss], [mm:ss.x], [mm:ss.xx] o [mm:ss.xxx]; admite varias marcas en una línea */
const RE_MARCA = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

/* Convierte un archivo .lrc en líneas ordenadas por tiempo. Devuelve [] si no hay marcas */
export function parsearLrc(texto: string): LineaLetra[] {
  // [offset:±ms] adelanta o atrasa toda la letra
  const mOffset = texto.match(/\[offset:([+-]?\d+)\]/i);
  const desfase = mOffset ? Number(mOffset[1]) / 1000 : 0;

  const lineas: LineaLetra[] = [];
  for (const cruda of texto.split(/\r?\n/)) {
    const marcas = [...cruda.matchAll(RE_MARCA)];
    if (marcas.length === 0) continue; // metadatos [ar:...] o texto sin sincronizar
    const contenido = cruda.replace(RE_MARCA, "").trim();
    for (const m of marcas) {
      const min = Number(m[1]);
      const seg = Number(m[2]);
      const decimal = m[3] !== undefined ? Number(`0.${m[3]}`) : 0;
      const t = min * 60 + seg + decimal - desfase;
      lineas.push({ t: Math.max(0, t), texto: contenido });
    }
  }
  lineas.sort((a, b) => a.t - b.t);
  return lineas;
}

/* Convierte líneas parseadas de vuelta a texto .lrc (para subirlas al backend) */
export function serializarLrc(lineas: LineaLetra[]): string {
  return lineas
    .map((l) => {
      const m = Math.floor(l.t / 60);
      const s = (l.t % 60).toFixed(2).padStart(5, "0");
      return `[${String(m).padStart(2, "0")}:${s}]${l.texto}`;
    })
    .join("\n");
}
