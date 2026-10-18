import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import {
  alternarFavorito,
  baseNombre,
  eliminarPista,
  espacioUsado,
  guardarLetra,
  guardarPista,
  leerMetadatos,
  listarPistas,
  obtenerArchivo,
  pedirAlmacenamientoPersistente,
  type Pista,
} from "./biblioteca";
import { parsearLrc, type LineaLetra } from "./letras";

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
const IcCorazon = ({ lleno }: { lleno: boolean }) => (
  <Icono>
    <path
      d="M12 20.3l-1.3-1.2C5.5 14.5 2.7 12 2.7 8.8 2.7 6.1 4.8 4 7.4 4c1.6 0 3.1.8 4.1 2 1-1.2 2.5-2 4.1-2 2.6 0 4.7 2.1 4.7 4.8 0 3.2-2.8 5.7-8 10.3L12 20.3z"
      fill={lleno ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
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
  const [soloFavoritas, setSoloFavoritas] = useState(false);
  const [sobre, setSobre] = useState(false); // hay archivos arrastrados sobre la ventana
  const letraRef = useRef<HTMLDivElement>(null); // contenedor de la letra, para auto-centrar

  // La lista filtrada por la búsqueda; la navegación (siguiente/anterior) recorre esta
  const textoBusqueda = normalizar(busqueda.trim());
  const base = soloFavoritas ? pistas.filter((p) => p.favorito) : pistas;
  const pistasVisibles = textoBusqueda
    ? base.filter((p) => normalizar(p.titulo).includes(textoBusqueda) || normalizar(p.artista).includes(textoBusqueda))
    : base;
  const indice = pistasVisibles.findIndex((p) => p.id === actualId);
  const pista = pistas.find((p) => p.id === actualId);
  const favoritasCount = useMemo(() => pistas.filter((p) => p.favorito).length, [pistas]);

  /* Índice de la línea de la letra que corresponde al tiempo actual (búsqueda binaria) */
  const idxLetra = useMemo(() => {
    const l = pista?.letra;
    if (!l || l.length === 0) return -1;
    let lo = 0;
    let hi = l.length - 1;
    let res = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (l[mid].t <= tiempo) {
        res = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return res;
  }, [pista?.letra, tiempo]);

  // Centra la línea actual en el panel de letra mientras suena
  useEffect(() => {
    const cont = letraRef.current;
    if (!cont || idxLetra < 0) return;
    const linea = cont.children[idxLetra] as HTMLElement | undefined;
    if (!linea) return;
    cont.scrollTo({
      top: linea.offsetTop - cont.clientHeight / 2 + linea.clientHeight / 2,
      behavior: "smooth",
    });
  }, [idxLetra]);

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

    // La pista nueva empieza de cero (evita que la barra y la letra muestren el tiempo viejo)
    setTiempo(0);
    setDuracion(0);

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

  /* Importa archivos de audio y letras .lrc (del input, de la demo o soltados en la ventana) */
  async function importarArchivos(entradas: File[]) {
    if (entradas.length === 0) return;

    // Lee los .lrc y los empareja con el audio por nombre de archivo (sin extensión)
    const letras = new Map<string, LineaLetra[]>();
    for (const archivo of entradas) {
      if (!archivo.name.toLowerCase().endsWith(".lrc")) continue;
      try {
        const lineas = parsearLrc(await archivo.text());
        if (lineas.length > 0) letras.set(normalizar(baseNombre(archivo.name)), lineas);
      } catch {
        /* .lrc ilegible */
      }
    }
    const audios = entradas.filter((a) => !a.name.toLowerCase().endsWith(".lrc"));

    const mensajes: string[] = [];

    if (audios.length > 0) {
      setAviso("");
      setProcesando({ hechas: 0, total: audios.length });
      const claves = new Set(pistas.map((p) => `${p.nombreArchivo}|${p.tamano}`));
      let fallidas = 0;

      for (const [i, archivo] of audios.entries()) {
        const clave = `${archivo.name}|${archivo.size}`;
        if (!claves.has(clave)) {
          claves.add(clave);
          try {
            const nueva = await leerMetadatos(archivo);
            const guardada = await guardarPista(
              { ...nueva, letra: letras.get(normalizar(baseNombre(archivo.name))) },
              archivo,
            );
            setPistas((prev) => [...prev, guardada]);
          } catch {
            fallidas++;
          }
        }
        setProcesando({ hechas: i + 1, total: audios.length });
      }

      setProcesando(null);
      if (fallidas > 0) mensajes.push(`No se pudieron guardar ${fallidas} archivo(s). ¿Falta espacio?`);
      pedirAlmacenamientoPersistente();
      refrescarEspacio();
    }

    // Aplica las letras a canciones que ya estaban en la biblioteca (o a las recién sumadas)
    if (letras.size > 0) {
      let aplicadas = 0;
      let conLetraYa = 0;
      for (const p of pistas) {
        const l = letras.get(normalizar(baseNombre(p.nombreArchivo)));
        if (!l) continue;
        if (p.letra) {
          conLetraYa++;
          continue;
        }
        try {
          await guardarLetra(p.id, l);
          setPistas((prev) => prev.map((x) => (x.id === p.id ? { ...x, letra: l } : x)));
          aplicadas++;
        } catch {
          /* sin acceso al almacenamiento */
        }
      }
      if (aplicadas > 0) {
        mensajes.push(`Letra aplicada a ${aplicadas} ${aplicadas === 1 ? "canción" : "canciones"}.`);
      } else if (audios.length === 0) {
        mensajes.push(
          conLetraYa > 0 ? "Esas canciones ya tenían letra." : "No encontré ninguna canción que coincida con ese archivo .lrc.",
        );
      }
    }

    setAviso(mensajes.join(" "));
  }

  async function agregar(e: ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    e.target.value = "";
    await importarArchivos(archivos);
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

  async function toggleFavorito(p: Pista) {
    const nuevo = !p.favorito;
    setPistas((prev) => prev.map((x) => (x.id === p.id ? { ...x, favorito: nuevo } : x)));
    try {
      await alternarFavorito(p.id, nuevo);
    } catch {
      setAviso("No se pudo marcar la canción como favorita.");
    }
  }

  function alternar() {
    const audio = audioRef.current;
    if (!audio || !pista) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }

  /* Mueve la reproducción delta segundos (atajos de teclado) */
  function saltar(delta: number) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.min(Math.max(0, audio.currentTime + delta), audio.duration);
    setTiempo(audio.currentTime);
  }

  /* Atajos: espacio = play/pausa, ← → = 5 s (con Shift = pista), ↑ ↓ = volumen, S = aleatorio, R = repetir */
  useEffect(() => {
    function pulsar(e: KeyboardEvent) {
      const destino = e.target as HTMLElement | null;
      if (
        destino &&
        (destino.tagName === "INPUT" ||
          destino.tagName === "TEXTAREA" ||
          destino.tagName === "SELECT" ||
          destino.isContentEditable)
      ) {
        return; // escribiendo en un campo: no interferimos
      }
      switch (e.key) {
        case " ":
          e.preventDefault();
          alternar();
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) siguiente();
          else saltar(5);
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) anterior();
          else saltar(-5);
          break;
        case "ArrowUp":
          e.preventDefault();
          setVolumen((v) => Math.min(1, Math.round((v + 0.05) * 100) / 100));
          setSilenciado(false);
          break;
        case "ArrowDown":
          e.preventDefault();
          setVolumen((v) => Math.max(0, Math.round((v - 0.05) * 100) / 100));
          break;
        case "s":
        case "S":
          setAleatorio((a) => !a);
          break;
        case "r":
        case "R":
          setRepetir((r) => (r === "nada" ? "todo" : r === "todo" ? "una" : "nada"));
          break;
      }
    }
    window.addEventListener("keydown", pulsar);
    return () => window.removeEventListener("keydown", pulsar);
    // Se re-suscribe en cada render para usar siempre los últimos estados
  });

  function siguiente(automatico = false) {
    const audio = audioRef.current;
    if (pistasVisibles.length === 0) return;

    const reiniciar = () => {
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    };

    // Repetir una: cuando termina sola, vuelve a empezar la misma pista
    if (automatico && repetir === "una") {
      reiniciar();
      return;
    }
    if (pistasVisibles.length === 1) {
      // Una sola pista: al terminar sola solo se repite si repetir !== "nada"
      if (!automatico || repetir === "todo") reiniciar();
      return;
    }
    // Fin de la biblioteca: si la repetición está apagada, no seguimos
    if (automatico && repetir === "nada" && indice === pistasVisibles.length - 1) return;
    let i: number;
    if (aleatorio) {
      // Con menos de dos pistas elegirías siempre la misma y el bucle no terminaría
      do {
        i = Math.floor(Math.random() * pistasVisibles.length);
      } while (i === indice && pistasVisibles.length > 1);
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
      } while (i === indice && pistasVisibles.length > 1);
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

  // Si sueltan un archivo fuera de la zona, que el navegador no intente abrirlo en una pestaña nueva
  useEffect(() => {
    const evitar = (e: globalThis.DragEvent) => e.preventDefault();
    window.addEventListener("dragover", evitar);
    window.addEventListener("drop", evitar);
    return () => {
      window.removeEventListener("dragover", evitar);
      window.removeEventListener("drop", evitar);
    };
  }, []);

  function soltar(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setSobre(false);
    const archivos = Array.from(e.dataTransfer?.files ?? []).filter(
      (f) => f.type.startsWith("audio/") || /\.(mp3|m4a|aac|ogg|opus|wav|flac|webm|mp4|lrc)$/i.test(f.name),
    );
    void importarArchivos(archivos);
  }

  return (
    <main
      className="app"
      onDragOver={(e) => {
        e.preventDefault();
        setSobre(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSobre(false);
      }}
      onDrop={soltar}
    >
      <div className="fondo" aria-hidden="true" />
      {sobre && (
        <div className="drop-overlay" aria-hidden="true">
          Soltá tus canciones acá
        </div>
      )}
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
            title={aleatorio ? "Aleatorio: activado" : "Aleatorio: apagado"}
          >
            <IcAleatorio />
          </button>
          <button
            className={`btn btn-mini ${repetir !== "nada" ? "activo" : ""}`}
            onClick={() => setRepetir((r) => (r === "nada" ? "todo" : r === "todo" ? "una" : "nada"))}
            aria-label={repetir === "nada" ? "Repetir apagado" : repetir === "todo" ? "Repetir todas" : "Repetir una"}
            aria-pressed={repetir !== "nada"}
            title={repetir === "nada" ? "Repetir: apagado" : repetir === "todo" ? "Repetir: todas" : "Repetir: una"}
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

      {pista?.letra && pista.letra.length > 0 && (
        <section className="glass letra" aria-label="Letra sincronizada">
          <div className="letra-scroll" ref={letraRef}>
            {pista.letra.map((l, i) => (
              <button
                key={`${l.t}-${i}`}
                type="button"
                className={`linea-letra${i === idxLetra ? " actual" : ""}`}
                onClick={() => {
                  const audio = audioRef.current;
                  if (audio) {
                    audio.currentTime = l.t;
                    setTiempo(l.t);
                  }
                }}
                title={`Ir a ${formato(l.t)}`}
              >
                {l.texto || "♪"}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="botones">
        <label className="add glass" style={{ padding: "0.85rem" }}>
          {procesando ? `Procesando ${procesando.hechas} de ${procesando.total}...` : "+ Agregar música"}
          <input type="file" accept="audio/*,.lrc" multiple onChange={agregar} disabled={!!procesando} />
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
                // Trae también la letra .lrc si existe junto al archivo de ejemplo
                const base = nombre.replace(/\.mp3$/i, "");
                const resLrc = await fetch(`/demo/${base}.lrc`);
                if (resLrc.ok) {
                  archivos.push(new File([await resLrc.blob()], `${base}.lrc`, { type: "text/plain" }));
                }
              } catch {}
            }
            if (archivos.filter((a) => a.name.endsWith(".mp3")).length === 0) {
              setAviso("No se encontraron canciones de ejemplo en /demo/");
              return;
            }
            await importarArchivos(archivos);
          }}
          disabled={!!procesando}
        >
          Cargar canciones de ejemplo
        </button>
      </div>

      {aviso && <p className="aviso">{aviso}</p>}

      <section className="glass">
        {!cargando && pistas.length > 0 && (
          <>
            <div className="filtros">
              <button
                className={`chip ${!soloFavoritas ? "on" : ""}`}
                onClick={() => setSoloFavoritas(false)}
                aria-pressed={!soloFavoritas}
              >
                Todas ({pistas.length})
              </button>
              <button
                className={`chip ${soloFavoritas ? "on" : ""}`}
                onClick={() => setSoloFavoritas(true)}
                aria-pressed={soloFavoritas}
              >
                Favoritas ({favoritasCount})
              </button>
            </div>
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
          </>
        )}
        {cargando ? (
          <p className="empty">Cargando biblioteca...</p>
        ) : pistas.length === 0 ? (
          <p className="empty">Todavía no hay canciones. Agregá archivos de audio de tu dispositivo.</p>
        ) : pistasVisibles.length === 0 ? (
          <p className="empty">
            {soloFavoritas
              ? "Todavía no marcaste ninguna favorita. Tocá el corazón de una canción."
              : `No hay canciones que coincidan con “${busqueda}”.`}
          </p>
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
                <button
                  className={`btn-icon ${p.favorito ? "fav" : ""}`}
                  onClick={() => toggleFavorito(p)}
                  aria-label={p.favorito ? `Quitar ${p.titulo} de favoritas` : `Marcar ${p.titulo} como favorita`}
                  aria-pressed={!!p.favorito}
                  title={p.favorito ? "Quitar de favoritas" : "Marcar como favorita"}
                >
                  <IcCorazon lleno={!!p.favorito} />
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