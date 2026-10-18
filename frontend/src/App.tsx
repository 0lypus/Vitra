import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  eliminarPista,
  espacioUsado,
  guardarPista,
  leerMetadatos,
  listarPistas,
  obtenerArchivo,
  pedirAlmacenamientoPersistente,
  type Pista,
} from "./biblioteca";

function formato(seg: number) {
  if (!Number.isFinite(seg)) return "0:00";
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function formatoTamano(bytes: number) {
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

function volumenInicial() {
  try {
    const guardado = localStorage.getItem("vitra:volumen");
    if (guardado !== null) return Math.min(1, Math.max(0, Number(guardado) || 0));
  } catch {
    /* sin acceso al almacenamiento */
  }
  return 0.8;
}

function aleatorioInicial() {
  try {
    return localStorage.getItem("vitra:aleatorio") === "1";
  } catch {
    /* sin acceso al almacenamiento */
  }
  return false;
}

type Repetir = "nada" | "todo" | "una";

function repetirInicial(): Repetir {
  try {
    const v = localStorage.getItem("vitra:repetir");
    if (v === "todo" || v === "una") return v;
  } catch {
    /* sin acceso al almacenamiento */
  }
  return "nada";
}

/* Quita tildes y pasa a minúsculas, para buscar sin importar mayúsculas ni acentos */
function normalizar(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/* Íconos SVG: se ven igual en todos los dispositivos */
const Icono = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    {children}
  </svg>
);
const IcPlay = () => (
  <Icono>
    <path d="M8 5v14l11-7z" />
  </Icono>
);
const IcPausa = () => (
  <Icono>
    <rect x="6" y="5" width="4" height="14" rx="1.2" />
    <rect x="14" y="5" width="4" height="14" rx="1.2" />
  </Icono>
);
const IcAnterior = () => (
  <Icono>
    <path d="M6 6h2.2v12H6z" />
    <path d="M18 6v12l-8.5-6z" />
  </Icono>
);
const IcSiguiente = () => (
  <Icono>
    <path d="M15.8 6H18v12h-2.2z" />
    <path d="M6 6v12l8.5-6z" />
  </Icono>
);
const IcVolumen = () => (
  <Icono>
    <path d="M3 10v4h4l5 4V6L7 10H3z" />
    <path d="M15.5 8.5a5 5 0 010 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M18.5 6a9 9 0 010 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Icono>
);
const IcSilencio = () => (
  <Icono>
    <path d="M3 10v4h4l5 4V6L7 10H3z" />
    <path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Icono>
);
const IcNota = () => (
  <Icono>
    <path d="M9 17.5V5l11-2v12.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="6.5" cy="17.5" r="3" />
    <circle cx="17.5" cy="15.5" r="3" />
  </Icono>
);
const IcBasura = () => (
  <Icono>
    <path d="M9 4h6l1 2h4v2H4V6h4l1-2z" />
    <path d="M6 9h12l-1 11H7L6 9z" />
  </Icono>
);
const IcAleatorio = () => (
  <Icono>
    <path d="M16 3h5v5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 20L21 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M21 16v5h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15 15l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M4 4l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Icono>
);
const IcRepetir = () => (
  <Icono>
    <path d="M17 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 11v-1a4 4 0 014-4h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M7 22l-4-4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 13v1a4 4 0 01-4 4H3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Icono>
);
const IcRepetirUna = () => (
  <Icono>
    <path d="M17 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 11v-1a4 4 0 014-4h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M7 22l-4-4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 13v1a4 4 0 01-4 4H3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M11.3 9.8l1.2-.8v5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </Icono>
);
const IcLupa = () => (
  <Icono>
    <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M15.5 15.5L21 21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Icono>
);

/* Muestra una carátula; crea la URL al montarse y la libera al desmontarse */
function Caratula({ blob, className }: { blob?: Blob; className: string }) {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const nueva = URL.createObjectURL(blob);
    setUrl(nueva);
    return () => URL.revokeObjectURL(nueva);
  }, [blob]);

  if (!url) {
    return (
      <div className={`${className} sin-caratula`}>
        <IcNota />
      </div>
    );
  }
  return <img className={className} src={url} alt="" loading="lazy" />;
}

export default function App() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [pistas, setPistas] = useState<Pista[]>([]);
  const [cargando, setCargando] = useState(true);
  const [actualId, setActualId] = useState<number | null>(null);
  const [sonando, setSonando] = useState(false);
  const [tiempo, setTiempo] = useState(0);
  const [duracion, setDuracion] = useState(0);
  const [volumen, setVolumen] = useState(volumenInicial);
  const [silenciado, setSilenciado] = useState(false);
  const [procesando, setProcesando] = useState<{ hechas: number; total: number } | null>(null);
  const [aviso, setAviso] = useState("");
  const [espacio, setEspacio] = useState<number | null>(null);
  const [aleatorio, setAleatorio] = useState(aleatorioInicial);
  const [repetir, setRepetir] = useState<Repetir>(repetirInicial);
  const [busqueda, setBusqueda] = useState("");

  // La lista filtrada por la búsqueda; la navegación (siguiente/anterior) recorre esta
  const textoBusqueda = normalizar(busqueda.trim());
  const pistasVisibles = textoBusqueda
    ? pistas.filter((p) => normalizar(p.titulo).includes(textoBusqueda) || normalizar(p.artista).includes(textoBusqueda))
    : pistas;
  const indice = pistasVisibles.findIndex((p) => p.id === actualId);
  const pista = pistas.find((p) => p.id === actualId);

  const refrescarEspacio = () => {
    espacioUsado().then(setEspacio);
  };

  // Carga la biblioteca guardada (solo los datos de cada tema, no los archivos)
  useEffect(() => {
    listarPistas()
      .then(setPistas)
      .catch(() => setAviso("No se pudo abrir el almacenamiento del navegador."))
      .finally(() => setCargando(false));
    refrescarEspacio();
  }, []);

  // Lee el archivo de la pista actual y libera la URL anterior (ahorra memoria)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || actualId === null) return;
    let cancelado = false;
    let url: string | undefined;

    obtenerArchivo(actualId).then((archivo) => {
      if (cancelado || !archivo) return;
      url = URL.createObjectURL(archivo);
      audio.src = url;
      audio.play().catch(() => {});
    });

    return () => {
      cancelado = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [actualId]);

  // Aplica el volumen y lo recuerda para la próxima vez
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volumen;
      audio.muted = silenciado;
    }
    try {
      localStorage.setItem("vitra:volumen", String(volumen));
    } catch {
      /* sin acceso al almacenamiento */
    }
  }, [volumen, silenciado]);

  // Recuerda aleatorio y repetir para la próxima vez
  useEffect(() => {
    try {
      localStorage.setItem("vitra:aleatorio", aleatorio ? "1" : "0");
      localStorage.setItem("vitra:repetir", repetir);
    } catch {
      /* sin acceso al almacenamiento */
    }
  }, [aleatorio, repetir]);

  // Media Session API: controles en bloqueo, notificaciones y teclas multimedia
  useEffect(() => {
    if (!("mediaSession" in navigator) || !pista) return;
    let artworkUrl: string | undefined;

    const artwork: MediaImage[] = [];
    if (pista.caratula) {
      artworkUrl = URL.createObjectURL(pista.caratula);
      artwork.push({ src: artworkUrl, sizes: "512x512", type: pista.caratula.type || "image/png" });
    }

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: pista.titulo,
        artist: pista.artista,
        album: pista.album || "",
        artwork,
      });
    } catch {
      /* algunos navegadores pueden fallar */
    }

    return () => {
      if (artworkUrl) {
        URL.revokeObjectURL(artworkUrl);
      }
    };
  }, [pista]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    ms.playbackState = sonando ? "playing" : "paused";

    const playHandler = () => {
      const a = audioRef.current;
      if (a) a.play().catch(() => {});
    };
    const pauseHandler = () => {
      const a = audioRef.current;
      if (a) a.pause();
    };

    ms.setActionHandler("play", playHandler);
    ms.setActionHandler("pause", pauseHandler);
    ms.setActionHandler("previoustrack", anterior);
    ms.setActionHandler("nexttrack", () => siguiente());
    ms.setActionHandler("seekto", (e: MediaSessionActionDetails) => {
      const a = audioRef.current;
      if (a && e.seekTime !== undefined && !Number.isNaN(e.seekTime)) {
        a.currentTime = e.seekTime;
      }
    });

    try {
      ms.setPositionState?.({
        duration: duracion || 0,
        playbackRate: 1,
        position: tiempo,
      });
    } catch {
      /* algunos navegadores no soportan esto */
    }

    return () => {
      ms.setActionHandler("play", null);
      ms.setActionHandler("pause", null);
      ms.setActionHandler("previoustrack", null);
      ms.setActionHandler("nexttrack", null);
      ms.setActionHandler("seekto", null);
    };
  }, [sonando, duracion, tiempo, pista, aleatorio, repetir]);

  async function agregar(e: ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (archivos.length === 0) return;

    setAviso("");
    setProcesando({ hechas: 0, total: archivos.length });
    const claves = new Set(pistas.map((p) => `${p.nombreArchivo}|${p.tamano}`));
    let fallidas = 0;

    for (const [i, archivo] of archivos.entries()) {
      const clave = `${archivo.name}|${archivo.size}`;
      if (!claves.has(clave)) {
        claves.add(clave);
        try {
          const nueva = await leerMetadatos(archivo);
          const guardada = await guardarPista(nueva, archivo);
          setPistas((prev) => [...prev, guardada]);
        } catch {
          fallidas++;
        }
      }
      setProcesando({ hechas: i + 1, total: archivos.length });
    }

    setProcesando(null);
    if (fallidas > 0) setAviso(`No se pudieron guardar ${fallidas} archivo(s). ¿Falta espacio?`);
    pedirAlmacenamientoPersistente();
    refrescarEspacio();
  }

  async function quitar(p: Pista) {
    if (p.id === actualId) {
      const audio = audioRef.current;
      audio?.pause();
      audio?.removeAttribute("src");
      audio?.load();
      setActualId(null);
      setSonando(false);
      setTiempo(0);
      setDuracion(0);
    }
    try {
      await eliminarPista(p.id);
      setPistas((prev) => prev.filter((x) => x.id !== p.id));
      refrescarEspacio();
    } catch {
      setAviso("No se pudo quitar la canción.");
    }
  }

  function alternar() {
    const audio = audioRef.current;
    if (!audio || !pista) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }

  function siguiente(automatico = false) {
    const audio = audioRef.current;
    if (pistasVisibles.length === 0) return;
    if (pistasVisibles.length === 1) {
      // Una sola pista: al terminar sola solo se repite si repetir !== "nada"
      if (!automatico || repetir !== "nada") {
        if (audio) {
          audio.currentTime = 0;
          audio.play().catch(() => {});
        }
      }
      return;
    }
    // Fin de la biblioteca: si la repetición está apagada, no seguimos
    if (automatico && repetir === "nada" && indice === pistasVisibles.length - 1) return;
    let i: number;
    if (aleatorio) {
      do {
        i = Math.floor(Math.random() * pistasVisibles.length);
      } while (i === indice);
    } else {
      i = indice >= 0 ? (indice + 1) % pistasVisibles.length : 0;
    }
    setActualId(pistasVisibles[i].id);
  }

  function anterior() {
    const audio = audioRef.current;
    if (pistasVisibles.length === 0 || !audio) return;
    if (audio.currentTime > 3 || pistasVisibles.length === 1) {
      audio.currentTime = 0;
      return;
    }
    let i: number;
    if (aleatorio) {
      do {
        i = Math.floor(Math.random() * pistasVisibles.length);
      } while (i === indice);
    } else {
      i = indice >= 0 ? (indice - 1 + pistasVisibles.length) % pistasVisibles.length : 0;
    }
    setActualId(pistasVisibles[i].id);
  }

  function buscar(e: ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Number(e.target.value);
    setTiempo(audio.currentTime);
  }

  function cambiarVolumen(e: ChangeEvent<HTMLInputElement>) {
    setVolumen(Number(e.target.value));
    setSilenciado(false);
  }

  function alternarSilencio() {
    if (silenciado || volumen === 0) {
      setSilenciado(false);
      if (volumen === 0) setVolumen(0.5);
    } else {
      setSilenciado(true);
    }
  }

  const mudo = silenciado || volumen === 0;

  // Pinta el fondo con el color dominante de la carátula de la pista actual
  useEffect(() => {
    document.documentElement.style.setProperty("--pista-color", pista?.color ?? "rgb(59, 28, 148)");
  }, [pista?.color]);

  return (
    <main className="app">
      <div className="fondo" aria-hidden="true" />
      <header className="brand">
        <img src="/pwa-192x192.png" alt="" />
        <h1>Vitra</h1>
      </header>

      <section className="glass now">
        <div className="now-top">
          <Caratula blob={pista?.caratula} className="cover" />
          <div className="info">
            <h2>{pista ? pista.titulo : "Nada sonando"}</h2>
            <p className="muted">
              {pista ? pista.artista : pistas.length > 0 ? "Elegí una canción de tu biblioteca" : "Agregá música para empezar"}
            </p>
          </div>
        </div>

        <div className="seek">
          <span>{formato(tiempo)}</span>
          <input
            type="range"
            min={0}
            max={duracion || 0}
            step={0.1}
            value={tiempo}
            onChange={buscar}
            disabled={!pista}
            aria-label="Progreso"
          />
          <span>{formato(duracion)}</span>
        </div>

        <div className="controls">
          <button className="btn" onClick={anterior} disabled={!pista} aria-label="Anterior">
            <IcAnterior />
          </button>
          <button className="btn btn-main" onClick={alternar} disabled={!pista} aria-label="Reproducir o pausar">
            {sonando ? <IcPausa /> : <IcPlay />}
          </button>
          <button className="btn" onClick={() => siguiente()} disabled={!pista} aria-label="Siguiente">
            <IcSiguiente />
          </button>
        </div>

        <div className="extras">
          <button
            className={`btn btn-mini ${aleatorio ? "activo" : ""}`}
            onClick={() => setAleatorio((a) => !a)}
            aria-label="Aleatorio"
            aria-pressed={aleatorio}
          >
            <IcAleatorio />
          </button>
          <button
            className={`btn btn-mini ${repetir !== "nada" ? "activo" : ""}`}
            onClick={() => setRepetir((r) => (r === "nada" ? "todo" : r === "todo" ? "una" : "nada"))}
            aria-label={repetir === "nada" ? "Repetir apagado" : repetir === "todo" ? "Repetir todas" : "Repetir una"}
            aria-pressed={repetir !== "nada"}
          >
            {repetir === "una" ? <IcRepetirUna /> : <IcRepetir />}
          </button>
        </div>

        <div className="volume">
          <button className="btn" onClick={alternarSilencio} aria-label={mudo ? "Activar sonido" : "Silenciar"}>
            {mudo ? <IcSilencio /> : <IcVolumen />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={silenciado ? 0 : volumen}
            onChange={cambiarVolumen}
            aria-label="Volumen"
          />
        </div>
      </section>

      <div className="botones">
        <label className="add glass" style={{ padding: "0.85rem" }}>
          {procesando ? `Procesando ${procesando.hechas} de ${procesando.total}...` : "+ Agregar música"}
          <input type="file" accept="audio/*" multiple onChange={agregar} disabled={!!procesando} />
        </label>
        <button
          className="add glass demo"
          onClick={async () => {
            const archivosDemo = ["demo1.mp3", "demo2.mp3", "demo3.mp3"];
            const archivos: File[] = [];
            for (const nombre of archivosDemo) {
              try {
                const res = await fetch(`/demo/${nombre}`);
                if (res.ok) {
                  const blob = await res.blob();
                  archivos.push(new File([blob], nombre, { type: blob.type || "audio/mpeg" }));
                }
              } catch {}
            }
            if (archivos.length === 0) {
              setAviso("No se encontraron canciones de ejemplo en /demo/");
              return;
            }
            const event = { target: { files: archivos } } as unknown as ChangeEvent<HTMLInputElement>;
            await agregar(event);
          }}
          disabled={!!procesando}
        >
          Cargar canciones de ejemplo
        </button>
      </div>

      {aviso && <p className="aviso">{aviso}</p>}

      <section className="glass">
        {!cargando && pistas.length > 0 && (
          <div className="buscador">
            <IcLupa />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por título o artista"
              aria-label="Buscar canciones"
            />
          </div>
        )}
        {cargando ? (
          <p className="empty">Cargando biblioteca...</p>
        ) : pistas.length === 0 ? (
          <p className="empty">Todavía no hay canciones. Agregá archivos de audio de tu dispositivo.</p>
        ) : pistasVisibles.length === 0 ? (
          <p className="empty">No hay canciones que coincidan con “{busqueda}”.</p>
        ) : (
          <ul className="list">
            {pistasVisibles.map((p) => (
              <li key={p.id}>
                <button className={`track ${p.id === actualId ? "on" : ""}`} onClick={() => setActualId(p.id)}>
                  <Caratula blob={p.caratula} className="mini" />
                  <span className="info">
                    <span className="titulo">{p.titulo}</span>
                    <span className="artista">{p.artista}</span>
                  </span>
                  {p.duracion > 0 && <span className="dur">{formato(p.duracion)}</span>}
                </button>
                <button className="btn-icon" onClick={() => quitar(p)} aria-label={`Quitar ${p.titulo}`} title="Quitar de Vitra">
                  <IcBasura />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pistas.length > 0 && (
        <p className="muted pie">
          {pistasVisibles.length === pistas.length
            ? `${pistas.length} ${pistas.length === 1 ? "canción" : "canciones"}`
            : `${pistasVisibles.length} de ${pistas.length} canciones`}
          {espacio !== null && ` · ${formatoTamano(espacio)} usados`}
        </p>
      )}

      <audio
        ref={audioRef}
        onPlay={() => setSonando(true)}
        onPause={() => setSonando(false)}
        onTimeUpdate={(e) => setTiempo(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuracion(e.currentTarget.duration)}
        onEnded={() => siguiente(true)}
      />
    </main>
  );
}