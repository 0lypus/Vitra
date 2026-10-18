import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import {
  alternarFavorito,
  baseNombre,
  crearLista,
  eliminarLista,
  eliminarPista,
  espacioUsado,
  guardarLetra,
  guardarLista,
  guardarMetadatos,
  guardarPista,
  leerMetadatos,
  listarListas,
  listarPistas,
  obtenerArchivo,
  pedirAlmacenamientoPersistente,
  type Lista,
  type Pista,
} from "./biblioteca";
import { agregarAlFinal, limpiarCola, moverEnCola, quitarDeCola, reproducirAContinuacion, sacarSiguiente } from "./cola";
import { parsearLrc, type LineaLetra } from "./letras";
import { altoBarra, barrasLogaritmicas, valorBarra } from "./visualizador";
import { aplicarRespaldo, crearRespaldo, leerRespaldo, nombreArchivoRespaldo } from "./respaldo";
import { ErrorHttp, servidorSugerido, sincronizar } from "./sinc";
import { formato, formatoTamano, normalizar } from "./utilidades";

/* Altura fija (px) de cada fila de la biblioteca: permite virtualizar la lista */
const ALTO_FILA = 64;

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

function verVisualizadorInicial() {
  try {
    return localStorage.getItem("vitra:visualizador") === "1";
  } catch {
    /* sin acceso al almacenamiento */
  }
  return false;
}

function servidorInicial() {
  try {
    const guardado = localStorage.getItem("vitra:servidor");
    if (guardado) return guardado;
  } catch {
    /* sin acceso al almacenamiento */
  }
  // Sin nada guardado: en la compu localhost; desde el celular, la IP de la red
  return servidorSugerido(window.location.hostname);
}

function claveInicial() {
  try {
    return localStorage.getItem("vitra:clave") ?? "";
  } catch {
    /* sin acceso al almacenamiento */
  }
  return "";
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
const IcMas = () => (
  <Icono>
    <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z" />
  </Icono>
);
const IcLapiz = () => (
  <Icono>
    <path d="M4 20l4-1 10-10-3-3L5 16l-1 4z" />
    <path d="M14.5 5.5l3 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </Icono>
);
const IcSubir = () => (
  <Icono>
    <path d="M6 14l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </Icono>
);
const IcBajar = () => (
  <Icono>
    <path d="M6 10l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </Icono>
);
const IcSinc = () => (
  <Icono>
    <path d="M20 12a8 8 0 01-13.7 5.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M4 12a8 8 0 0113.7-5.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M3.5 16.5v-4h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20.5 7.5v4h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Icono>
);
const IcRespaldo = () => (
  <Icono>
    <path d="M12 3v9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M8 8.5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 14.5v3a2 2 0 002 2h10a2 2 0 002-2v-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Icono>
);
const IcCola = () => (
  <Icono>
    <path d="M3.5 7h8M3.5 12h6M3.5 17h5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    <path d="M14 11.5l6 3.2-6 3.2v-6.4z" />
  </Icono>
);
const IcOndas = () => (
  <Icono>
    <path
      d="M3 12h2.5l2-6 3 12 2.5-9 2 5H21"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
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
  const [verVisualizador, setVerVisualizador] = useState(verVisualizadorInicial);
  const [busqueda, setBusqueda] = useState("");
  const [soloFavoritas, setSoloFavoritas] = useState(false);
  const [listas, setListas] = useState<Lista[]>([]);
  const [listaActiva, setListaActiva] = useState<number | null>(null);
  const [agregandoA, setAgregandoA] = useState<number | null>(null); // pista elegida en el diálogo "agregar a lista"
  const [editando, setEditando] = useState<Pista | null>(null); // pista en el diálogo "editar metadatos"
  const [borrador, setBorrador] = useState({ titulo: "", artista: "", album: "" });
  const [servidor, setServidor] = useState(servidorInicial); // URL del backend de sincronización
  const [clave, setClave] = useState(claveInicial); // clave de acceso del backend (si tiene)
  const [verSync, setVerSync] = useState(false); // diálogo de sincronización abierto
  const [sincronizando, setSincronizando] = useState(false);
  const [verRespaldo, setVerRespaldo] = useState(false); // diálogo de respaldo abierto
  const [cola, setCola] = useState<number[]>([]); // cola de reproducción (ids, en orden)
  const [colaPara, setColaPara] = useState<number | null>(null); // pista elegida para encolar
  const [verCola, setVerCola] = useState(false); // panel de la cola abierto
  const [sobre, setSobre] = useState(false); // hay archivos arrastrados sobre la ventana
  const letraRef = useRef<HTMLDivElement>(null); // contenedor de la letra, para auto-centrar
  const listaRef = useRef<HTMLUListElement>(null); // contenedor scrolleable de la biblioteca
  const canvasRef = useRef<HTMLCanvasElement>(null); // canvas del visualizador
  const ctxAudioRef = useRef<AudioContext | null>(null); // contexto de Web Audio (uno solo por elemento audio)
  const analizadorRef = useRef<AnalyserNode | null>(null);
  const [scrollLista, setScrollLista] = useState(0);
  const [altoLista, setAltoLista] = useState(0); // altura visible del contenedor de la lista

  // La lista filtrada; la navegación (siguiente/anterior) recorre esta
  const textoBusqueda = normalizar(busqueda.trim());
  const lista = listaActiva !== null ? (listas.find((l) => l.id === listaActiva) ?? null) : null;
  const porId = useMemo(() => new Map(pistas.map((p) => [p.id, p])), [pistas]);
  // Con lista activa se respeta el orden guardado (se puede reordenar a mano)
  const base = lista
    ? lista.pistas.map((id) => porId.get(id)).filter((p): p is Pista => p !== undefined)
    : soloFavoritas
      ? pistas.filter((p) => p.favorito)
      : pistas;
  const pistasVisibles = textoBusqueda
    ? base.filter((p) => normalizar(p.titulo).includes(textoBusqueda) || normalizar(p.artista).includes(textoBusqueda))
    : base;
  const indice = pistasVisibles.findIndex((p) => p.id === actualId);
  const pista = pistas.find((p) => p.id === actualId);
  const pistaCola = colaPara !== null ? porId.get(colaPara) : undefined; // canción del diálogo "encolar"
  const favoritasCount = useMemo(() => pistas.filter((p) => p.favorito).length, [pistas]);

  /* Virtualización: solo se pintan las filas que caben en pantalla (más un margen) */
  useEffect(() => {
    const medir = () => setAltoLista(listaRef.current?.clientHeight ?? 0);
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [pistasVisibles.length]);

  // Vuelve arriba al cambiar de vista (lista, favoritas o búsqueda)
  useEffect(() => {
    listaRef.current?.scrollTo({ top: 0 });
    setScrollLista(0);
  }, [listaActiva, soloFavoritas, busqueda]);

  const primero = Math.min(
    Math.max(0, Math.floor(scrollLista / ALTO_FILA) - 4),
    Math.max(0, pistasVisibles.length - 1),
  );
  const ultimo = Math.min(pistasVisibles.length, Math.ceil((scrollLista + altoLista) / ALTO_FILA) + 4);

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
    listarListas()
      .then(setListas)
      .catch(() => setAviso("No se pudieron cargar las listas."));
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

  // Recuerda aleatorio, repetir y visualizador para la próxima vez
  useEffect(() => {
    try {
      localStorage.setItem("vitra:aleatorio", aleatorio ? "1" : "0");
      localStorage.setItem("vitra:repetir", repetir);
      localStorage.setItem("vitra:visualizador", verVisualizador ? "1" : "0");
    } catch {
      /* sin acceso al almacenamiento */
    }
  }, [aleatorio, repetir, verVisualizador]);

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
    setCola((prev) => quitarDeCola(prev, p.id)); // ya no puede sonar: la saco de la cola
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
      return;
    }
    // Quita el id de las listas que lo tuvieran, para no dejar números sueltos
    const afectadas = listas
      .filter((l) => l.pistas.includes(p.id))
      .map((l) => ({ ...l, pistas: l.pistas.filter((x) => x !== p.id) }));
    if (afectadas.length > 0) {
      try {
        for (const l of afectadas) await guardarLista(l);
        setListas((prev) => prev.map((x) => afectadas.find((a) => a.id === x.id) ?? x));
      } catch {
        setAviso("La canción se quitó, pero no pude actualizar una lista.");
      }
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

  /* Cola de reproducción: la canción suena apenas termina la actual */
  function encolarAcontinuacion(p: Pista) {
    setCola((c) => reproducirAContinuacion(c, p.id));
    setColaPara(null);
    setAviso(`“${p.titulo}” suena a continuación.`);
  }

  /* Cola de reproducción: la canción queda al final de lo encolado */
  function encolarAlFinal(p: Pista) {
    setCola((c) => agregarAlFinal(c, p.id));
    setColaPara(null);
    setAviso(`“${p.titulo}” quedó al final de la cola.`);
  }

  /* Abre el panel de la cola, descartando las canciones que ya no existen */
  function abrirCola() {
    setCola((c) => limpiarCola(c, (id) => porId.has(id)));
    setVerCola(true);
  }

  function activarLista(id: number) {
    setListaActiva((prev) => (prev === id ? null : id));
    setSoloFavoritas(false);
  }

  async function nuevaLista() {
    const nombre = window.prompt("Nombre de la nueva lista:");
    if (!nombre?.trim()) return;
    try {
      const listaCreada = await crearLista(nombre);
      setListas((prev) => [...prev, listaCreada]);
    } catch {
      setAviso("No se pudo crear la lista.");
    }
  }

  async function borrarLista(l: Lista) {
    if (!window.confirm(`¿Eliminar la lista “${l.nombre}”? Las canciones no se borran de Vitra.`)) return;
    try {
      await eliminarLista(l.id);
      setListas((prev) => prev.filter((x) => x.id !== l.id));
      if (listaActiva === l.id) setListaActiva(null);
    } catch {
      setAviso("No se pudo eliminar la lista.");
    }
  }

  async function renombrarLista(l: Lista) {
    const nombre = window.prompt("Nuevo nombre de la lista:", l.nombre);
    if (!nombre?.trim() || nombre.trim() === l.nombre) return;
    const nueva: Lista = { ...l, nombre: nombre.trim() };
    setListas((prev) => prev.map((x) => (x.id === l.id ? nueva : x)));
    try {
      await guardarLista(nueva);
    } catch {
      setAviso("No se pudo renombrar la lista.");
    }
  }

  /* Mueve una pista arriba o abajo dentro de la lista activa */
  async function moverEnLista(l: Lista, pistaId: number, delta: number) {
    const i = l.pistas.indexOf(pistaId);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= l.pistas.length) return;
    const ids = [...l.pistas];
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const nueva: Lista = { ...l, pistas: ids };
    setListas((prev) => prev.map((x) => (x.id === nueva.id ? nueva : x)));
    try {
      await guardarLista(nueva);
    } catch {
      setAviso("No se pudo reordenar la lista.");
    }
  }

  /* Quita o agrega una pista a una lista (el diálogo queda abierto para varias listas) */
  async function alternarEnLista(l: Lista, pistaId: number) {
    const nueva: Lista = {
      ...l,
      pistas: l.pistas.includes(pistaId) ? l.pistas.filter((x) => x !== pistaId) : [...l.pistas, pistaId],
    };
    setListas((prev) => prev.map((x) => (x.id === nueva.id ? nueva : x)));
    try {
      await guardarLista(nueva);
    } catch {
      setAviso("No se pudo actualizar la lista.");
    }
  }

  async function crearListaYAgregar(nombre: string, pistaId: number) {
    if (!nombre.trim()) return;
    try {
      const creada = await crearLista(nombre);
      const conPista: Lista = { ...creada, pistas: [pistaId] };
      await guardarLista(conPista);
      setListas((prev) => [...prev, conPista]);
    } catch {
      setAviso("No se pudo crear la lista.");
    }
  }

  function abrirEdicion(p: Pista) {
    setBorrador({ titulo: p.titulo, artista: p.artista, album: p.album });
    setEditando(p);
  }

  async function guardarEdicion() {
    if (!editando) return;
    const cambios = {
      titulo: borrador.titulo.trim() || editando.nombreArchivo,
      artista: borrador.artista.trim() || "Artista desconocido",
      album: borrador.album.trim(),
    };
    setPistas((prev) => prev.map((x) => (x.id === editando.id ? { ...x, ...cambios } : x)));
    setEditando(null);
    try {
      await guardarMetadatos(editando.id, cambios);
    } catch {
      setAviso("No se pudieron guardar los cambios.");
    }
  }

  // Escape cierra los diálogos abiertos
  useEffect(() => {
    if (agregandoA === null && editando === null && !verSync && !verRespaldo && colaPara === null && !verCola) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAgregandoA(null);
        setEditando(null);
        setVerSync(false);
        setVerRespaldo(false);
        setColaPara(null);
        setVerCola(false);
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [agregandoA, editando, verSync, verRespaldo, colaPara, verCola]);

  // Recuerda la URL del backend para la próxima vez
  useEffect(() => {
    try {
      localStorage.setItem("vitra:servidor", servidor);
    } catch {
      /* sin acceso al almacenamiento */
    }
  }, [servidor]);

  // Recuerda la clave del backend para la próxima vez
  useEffect(() => {
    try {
      localStorage.setItem("vitra:clave", clave);
    } catch {
      /* sin acceso al almacenamiento */
    }
  }, [clave]);

  /* Sube y baja metadatos, favoritos, letras y listas con el backend */
  async function sincronizarAhora() {
    if (!servidor.trim()) return;
    setSincronizando(true);
    setAviso("");
    try {
      const r = await sincronizar(servidor, clave);
      // Recarga el estado desde IndexedDB, que ya quedó actualizado
      setPistas(await listarPistas());
      setListas(await listarListas());
      const partes = [
        r.pistasSubidas > 0 && `${r.pistasSubidas} ${r.pistasSubidas === 1 ? "canción subida" : "canciones subidas"}`,
        r.pistasActualizadas > 0 &&
          `${r.pistasActualizadas} ${r.pistasActualizadas === 1 ? "actualizada" : "actualizadas"} desde el servidor`,
        r.listasSubidas > 0 && `${r.listasSubidas} ${r.listasSubidas === 1 ? "lista subida" : "listas subidas"}`,
        r.listasActualizadas > 0 &&
          `${r.listasActualizadas} ${r.listasActualizadas === 1 ? "lista actualizada" : "listas actualizadas"}`,
        r.borradosSubidos > 0 && `${r.borradosSubidos} ${r.borradosSubidos === 1 ? "borrado subido" : "borrados subidos"}`,
        r.borradosAplicados > 0 &&
          `${r.borradosAplicados} ${r.borradosAplicados === 1 ? "borrado aplicado" : "borrados aplicados"} desde el servidor`,
      ].filter(Boolean);
      if (partes.length === 0) partes.push("todo estaba al día");
      setAviso(`Sincronización lista: ${partes.join(", ")}.`);
      if (r.sinAudio > 0) {
        setAviso(
          `Sincronización lista: ${partes.join(", ")}. El servidor conoce ${r.sinAudio} ${
            r.sinAudio === 1 ? "canción que no tenés" : "canciones que no tenés"
          }: importá esos archivos para completarlas.`,
        );
      }
    } catch (e) {
      if (e instanceof ErrorHttp && e.status === 401) {
        setAviso("El servidor pide una clave de acceso y la que mandé no coincide. Revisala en el diálogo de Sincronizar.");
      } else {
        setAviso("No se pudo sincronizar. ¿Está corriendo el backend y bien escrita la URL?");
      }
    } finally {
      setSincronizando(false);
    }
  }

  /* Baja un archivo .json con los datos de la biblioteca (sin el audio) */
  function descargarRespaldo() {
    if (pistas.length === 0 && listas.length === 0) {
      setAviso("Todavía no hay nada para respaldar.");
      return;
    }
    const texto = crearRespaldo(pistas, listas);
    const url = URL.createObjectURL(new Blob([texto], { type: "application/json" }));
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombreArchivoRespaldo();
    enlace.click();
    // Se libera el blob un rato después, para no cortar la descarga
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    setAviso(`Respaldo descargado: ${pistas.length} canciones y ${listas.length} listas.`);
    setVerRespaldo(false);
  }

  /* Lee un archivo de respaldo y lo aplica sobre la biblioteca */
  async function importarRespaldo(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // así se puede volver a elegir el mismo archivo
    if (!archivo) return;
    try {
      const r = leerRespaldo(await archivo.text());
      const res = await aplicarRespaldo(r);
      setPistas(await listarPistas());
      setListas(await listarListas());
      const partes = [
        `${res.pistasAplicadas} ${res.pistasAplicadas === 1 ? "canción actualizada" : "canciones actualizadas"}`,
        `${res.listasAplicadas} ${res.listasAplicadas === 1 ? "lista aplicada" : "listas aplicadas"}`,
      ];
      let mensaje = `Respaldo importado: ${partes.join(" y ")}.`;
      if (res.sinAudio > 0) {
        mensaje += ` Quedaron ${res.sinAudio} ${
          res.sinAudio === 1 ? "canción sin audio" : "canciones sin audio"
        }: agregá esos archivos y volvé a importar el respaldo para completarlas.`;
      }
      setAviso(mensaje);
      setVerRespaldo(false);
    } catch (err) {
      setAviso(err instanceof Error ? err.message : "No se pudo leer el respaldo.");
    }
  }

  /* Conecta el audio al analizador de Web Audio.
     Hay que llamarlo con un gesto del usuario: el contexto arranca suspendido. */
  function prepararAnalizador() {
    const audio = audioRef.current;
    if (!audio || ctxAudioRef.current) {
      void ctxAudioRef.current?.resume();
      return;
    }
    try {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      const fuente = ctx.createMediaElementSource(audio);
      const analizador = ctx.createAnalyser();
      analizador.fftSize = 256; // 128 barras de frecuencia
      analizador.smoothingTimeConstant = 0.82;
      fuente.connect(analizador);
      analizador.connect(ctx.destination); // sin esto el audio no se escucha
      ctxAudioRef.current = ctx;
      analizadorRef.current = analizador;
      void ctx.resume();
    } catch {
      /* Web Audio no disponible */
    }
  }

  function alternar() {
    const audio = audioRef.current;
    if (!audio || !pista) return;
    prepararAnalizador();
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }

  // Visualizador: dibuja el espectro en el canvas a ~30 fps mientras esté encendido
  useEffect(() => {
    if (!verVisualizador) return;
    const canvas = canvasRef.current;
    const ctx2d = canvas?.getContext("2d");
    if (!canvas || !ctx2d) return;

    // El degradado depende del alto del canvas, que ajustar() acaba de cambiar
    let grad: CanvasGradient | undefined;
    const ajustar = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      const estilo = getComputedStyle(document.documentElement);
      grad = ctx2d.createLinearGradient(0, canvas.height, 0, 0);
      grad.addColorStop(0, estilo.getPropertyValue("--accent").trim() || "#c4a8ff");
      grad.addColorStop(1, estilo.getPropertyValue("--gold").trim() || "#ffb86b");
    };
    ajustar();
    window.addEventListener("resize", ajustar);

    const datos = new Uint8Array(analizadorRef.current?.frequencyBinCount ?? 128);
    // Bins agrupados con escala logarítmica: así se mueve todo el ancho del
    // canvas y no solo la franja izquierda de los graves
    const rangos = barrasLogaritmicas(datos.length, 64);
    let ultimo = 0;
    let raf = 0;
    const dibujar = (ahora: number) => {
      raf = requestAnimationFrame(dibujar);
      if (ahora - ultimo < 33) return; // ~30 fps: suficiente y barato
      ultimo = ahora;
      analizadorRef.current?.getByteFrequencyData(datos);
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      if (grad) ctx2d.fillStyle = grad;
      const n = rangos.length;
      const ancho = canvas.width / n;
      const hueco = Math.min(2 * (window.devicePixelRatio || 1), ancho * 0.35);
      for (let i = 0; i < n; i++) {
        const alto = altoBarra(valorBarra(datos, rangos[i]), canvas.height);
        ctx2d.fillRect(i * ancho + hueco / 2, canvas.height - alto, ancho - hueco, alto);
      }
    };
    raf = requestAnimationFrame(dibujar);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", ajustar);
    };
  }, [verVisualizador]);

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

    const reiniciar = () => {
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    };

    // La cola manual manda: si hay algo encolado, va eso (aunque esté en repetir una)
    const deCola = sacarSiguiente(cola, (id) => porId.has(id));
    if (deCola.id !== null) {
      setCola(deCola.cola);
      // Si encolaste la que ya está sonando, hay que darle play de nuevo
      if (deCola.id === actualId) reiniciar();
      else setActualId(deCola.id);
      return;
    }
    if (deCola.cola !== cola) setCola(deCola.cola); // limpia las que ya no existen

    if (pistasVisibles.length === 0) return;

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
          <button
            className={`btn btn-mini ${verVisualizador ? "activo" : ""}`}
            onClick={() => {
              if (!verVisualizador) prepararAnalizador();
              setVerVisualizador((v) => !v);
            }}
            aria-label="Visualizador de audio"
            aria-pressed={verVisualizador}
            title={verVisualizador ? "Ocultar visualizador" : "Mostrar visualizador"}
          >
            <IcOndas />
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

        {verVisualizador && <canvas ref={canvasRef} className="visualizador" aria-hidden="true" />}
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
        <div className="acciones-fila">
          <button
            className="add glass demo"
            onClick={() => setVerSync(true)}
            disabled={sincronizando}
            title="Subir y bajar tus datos con el backend"
          >
            <IcSinc />
            {sincronizando ? "Sincronizando..." : "Sincronizar"}
          </button>
          <button
            className="add glass demo"
            onClick={() => setVerRespaldo(true)}
            title="Guardar o restaurar tus datos en un archivo"
          >
            <IcRespaldo />
            Respaldo
          </button>
        </div>
      </div>

      {aviso && <p className="aviso">{aviso}</p>}

      <section className="glass">
        {!cargando && pistas.length > 0 && (
          <>
            <div className="filtros">
              <button
                className={`chip ${!soloFavoritas && listaActiva === null ? "on" : ""}`}
                onClick={() => {
                  setSoloFavoritas(false);
                  setListaActiva(null);
                }}
                aria-pressed={!soloFavoritas && listaActiva === null}
              >
                Todas ({pistas.length})
              </button>
              <button
                className={`chip ${soloFavoritas ? "on" : ""}`}
                onClick={() => {
                  setSoloFavoritas(true);
                  setListaActiva(null);
                }}
                aria-pressed={soloFavoritas}
              >
                Favoritas ({favoritasCount})
              </button>
              {listas.map((l) => (
                <span key={l.id} className={`grupo-chip ${listaActiva === l.id ? "on" : ""}`}>
                  <button
                    className="chip"
                    onClick={() => activarLista(l.id)}
                    aria-pressed={listaActiva === l.id}
                    title={`Ver la lista ${l.nombre}`}
                  >
                    {l.nombre} ({l.pistas.length})
                  </button>
                  <button
                    className="q-chip"
                    onClick={() => renombrarLista(l)}
                    aria-label={`Renombrar la lista ${l.nombre}`}
                    title="Renombrar lista"
                  >
                    <IcLapiz />
                  </button>
                  <button
                    className="q-chip"
                    onClick={() => borrarLista(l)}
                    aria-label={`Eliminar la lista ${l.nombre}`}
                    title="Eliminar lista"
                  >
                    ×
                  </button>
                </span>
              ))}
              <button className="chip nuevo" onClick={nuevaLista} title="Crear una lista nueva">
                + Lista
              </button>
              {cola.length > 0 && (
                <button
                  className={`chip cola ${verCola ? "on" : ""}`}
                  onClick={abrirCola}
                  title="Ver la cola de reproducción"
                >
                  Cola ({cola.length})
                </button>
              )}
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
            {lista
              ? `La lista “${lista.nombre}” todavía no tiene canciones. Tocá el + de cualquier canción para sumarla.`
              : soloFavoritas
                ? "Todavía no marcaste ninguna favorita. Tocá el corazón de una canción."
                : `No hay canciones que coincidan con “${busqueda}”.`}
          </p>
        ) : (
          <ul className="list" ref={listaRef} onScroll={(e) => setScrollLista(e.currentTarget.scrollTop)}>
            <li className="renglon-total" style={{ height: pistasVisibles.length * ALTO_FILA }} aria-hidden="true" />
            {pistasVisibles.slice(primero, ultimo).map((p, k) => (
              <li
                key={p.id}
                className={`fila${primero + k === pistasVisibles.length - 1 ? " sin-borde" : ""}`}
                style={{ top: (primero + k) * ALTO_FILA }}
              >
                <button
                  className={`track ${p.id === actualId ? "on" : ""}`}
                  onClick={() => {
                    prepararAnalizador();
                    setActualId(p.id);
                  }}
                >
                  <Caratula blob={p.caratula} className="mini" />
                  <span className="info">
                    <span className="titulo">{p.titulo}</span>
                    <span className="artista">{p.artista}</span>
                  </span>
                  {p.duracion > 0 && <span className="dur">{formato(p.duracion)}</span>}
                </button>
                {lista && (
                  <>
                    <button
                      className="btn-icon"
                      onClick={() => moverEnLista(lista, p.id, -1)}
                      disabled={lista.pistas[0] === p.id}
                      aria-label={`Subir ${p.titulo} en la lista`}
                      title="Subir en la lista"
                    >
                      <IcSubir />
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => moverEnLista(lista, p.id, 1)}
                      disabled={lista.pistas[lista.pistas.length - 1] === p.id}
                      aria-label={`Bajar ${p.titulo} en la lista`}
                      title="Bajar en la lista"
                    >
                      <IcBajar />
                    </button>
                  </>
                )}
                <button
                  className={`btn-icon ${cola.includes(p.id) ? "en-cola" : ""}`}
                  onClick={() => setColaPara(p.id)}
                  aria-label={`Encolar ${p.titulo}`}
                  title="Cola de reproducción"
                >
                  <IcCola />
                </button>
                <button
                  className="btn-icon"
                  onClick={() => setAgregandoA(p.id)}
                  aria-label={`Agregar ${p.titulo} a una lista`}
                  title="Agregar a una lista"
                >
                  <IcMas />
                </button>
                <button
                  className="btn-icon"
                  onClick={() => abrirEdicion(p)}
                  aria-label={`Editar los datos de ${p.titulo}`}
                  title="Editar datos"
                >
                  <IcLapiz />
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
          {lista && ` en “${lista.nombre}”`}
          {espacio !== null && ` · ${formatoTamano(espacio)} usados`}
        </p>
      )}

      {agregandoA !== null && (
        <div className="modal-fondo" onClick={() => setAgregandoA(null)}>
          <div
            className="modal glass"
            role="dialog"
            aria-modal="true"
            aria-label="Agregar a una lista"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-titulo">
              <h3>¿A qué lista?</h3>
              <button className="btn-icon" onClick={() => setAgregandoA(null)} aria-label="Cerrar">
                ×
              </button>
            </div>
            {listas.length === 0 && <p className="muted">No tenés listas todavía. Creá una acá abajo.</p>}
            {listas.map((l) => (
              <button key={l.id} className="menu-linea" onClick={() => alternarEnLista(l, agregandoA)}>
                <span className="check">{l.pistas.includes(agregandoA) ? "✓" : ""}</span>
                <span className="nombre-lista">{l.nombre}</span>
                <span className="cuenta-lista">{l.pistas.length}</span>
              </button>
            ))}
            <form
              className="menu-nueva"
              onSubmit={(e) => {
                e.preventDefault();
                const nombre = (e.currentTarget.elements.namedItem("nombre") as HTMLInputElement).value;
                void crearListaYAgregar(nombre, agregandoA);
                e.currentTarget.reset();
              }}
            >
              <input name="nombre" placeholder="Nueva lista..." maxLength={40} aria-label="Nombre de la nueva lista" />
              <button type="submit" className="add-lista">
                Crear y agregar
              </button>
            </form>
          </div>
        </div>
      )}

      {editando && (
        <div className="modal-fondo" onClick={() => setEditando(null)}>
          <form
            className="modal glass"
            role="dialog"
            aria-modal="true"
            aria-label="Editar datos de la canción"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              void guardarEdicion();
            }}
          >
            <div className="modal-titulo">
              <h3>Editar datos</h3>
              <button type="button" className="btn-icon" onClick={() => setEditando(null)} aria-label="Cerrar">
                ×
              </button>
            </div>
            <label className="campo-editar">
              Título
              <input
                value={borrador.titulo}
                onChange={(e) => setBorrador((b) => ({ ...b, titulo: e.target.value }))}
                maxLength={200}
                autoFocus
              />
            </label>
            <label className="campo-editar">
              Artista
              <input
                value={borrador.artista}
                onChange={(e) => setBorrador((b) => ({ ...b, artista: e.target.value }))}
                maxLength={200}
              />
            </label>
            <label className="campo-editar">
              Álbum
              <input
                value={borrador.album}
                onChange={(e) => setBorrador((b) => ({ ...b, album: e.target.value }))}
                maxLength={200}
              />
            </label>
            <p className="muted pie-edicion">
              Se guarda solo en Vitra; el archivo de audio no se toca. Nombre del archivo: {editando.nombreArchivo}
            </p>
            <button type="submit" className="add-lista">
              Guardar
            </button>
          </form>
        </div>
      )}

      {verSync && (
        <div className="modal-fondo" onClick={() => setVerSync(false)}>
          <div
            className="modal glass"
            role="dialog"
            aria-modal="true"
            aria-label="Sincronizar con el backend"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-titulo">
              <h3>Sincronizar</h3>
              <button className="btn-icon" onClick={() => setVerSync(false)} aria-label="Cerrar">
                ×
              </button>
            </div>
            <label className="campo-editar">
              Dirección del servidor
              <input
                value={servidor}
                onChange={(e) => setServidor(e.target.value)}
                placeholder="http://localhost:5041"
                autoFocus
                spellCheck={false}
              />
            </label>
            <label className="campo-editar">
              Clave de acceso (si el backend tiene una)
              <input
                type="password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder="La misma que configuraste en el backend"
                spellCheck={false}
                autoComplete="off"
              />
            </label>
            <p className="muted pie-edicion">
              Sube metadatos, favoritos, letras y listas; y baja lo que esté más nuevo en el servidor. Los archivos de
              audio no se suben: importá los mismos archivos en el otro dispositivo para que se emparejen por nombre y
              tamaño. Si el servidor no pide clave, dejá el campo vacío.
            </p>
            <button className="add-lista" onClick={() => void sincronizarAhora()} disabled={sincronizando || !servidor.trim()}>
              {sincronizando ? "Sincronizando..." : "Sincronizar ahora"}
            </button>
          </div>
        </div>
      )}

      {verRespaldo && (
        <div className="modal-fondo" onClick={() => setVerRespaldo(false)}>
          <div
            className="modal glass"
            role="dialog"
            aria-modal="true"
            aria-label="Respaldo de la biblioteca"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-titulo">
              <h3>Respaldo</h3>
              <button className="btn-icon" onClick={() => setVerRespaldo(false)} aria-label="Cerrar">
                ×
              </button>
            </div>
            <p className="muted pie-edicion">
              Descarga un archivo .json con tus canciones (título, artista, álbum, favoritos y letras) y tus listas. Los
              archivos de audio no entran: sirve para guardar una copia o pasar los datos a otro dispositivo, y después
              hay que volver a agregar los mismos audios.
            </p>
            <button className="add-lista" onClick={descargarRespaldo}>
              Descargar respaldo
            </button>
            <label className="add glass demo">
              Importar respaldo...
              <input type="file" accept=".json,application/json" onChange={importarRespaldo} />
            </label>
            <p className="muted pie-edicion">
              Al importar solo se pisan los datos más viejos que los que ya tenés, y las canciones cuyo audio no esté
              agregado quedan para cuando lo agregues.
            </p>
          </div>
        </div>
      )}

      {colaPara !== null && pistaCola && (
        <div className="modal-fondo" onClick={() => setColaPara(null)}>
          <div
            className="modal glass"
            role="dialog"
            aria-modal="true"
            aria-label="Encolar canción"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-titulo">
              <h3>Cola</h3>
              <button className="btn-icon" onClick={() => setColaPara(null)} aria-label="Cerrar">
                ×
              </button>
            </div>
            <p className="muted pie-edicion">{pistaCola.titulo}</p>
            <button className="menu-linea" onClick={() => encolarAcontinuacion(pistaCola)}>
              <span className="check">⇥</span>
              <span className="nombre-lista">Reproducir a continuación</span>
            </button>
            <button className="menu-linea" onClick={() => encolarAlFinal(pistaCola)}>
              <span className="check">⇥</span>
              <span className="nombre-lista">Agregar al final de la cola</span>
            </button>
            {cola.includes(pistaCola.id) && (
              <button
                className="menu-linea"
                onClick={() => {
                  setCola((c) => quitarDeCola(c, pistaCola.id));
                  setColaPara(null);
                }}
              >
                <span className="check">×</span>
                <span className="nombre-lista">Quitar de la cola</span>
              </button>
            )}
            {cola.length > 0 && (
              <button
                className="add-lista"
                onClick={() => {
                  abrirCola();
                  setColaPara(null);
                }}
              >
                Ver la cola ({cola.length})
              </button>
            )}
          </div>
        </div>
      )}

      {verCola && (
        <div className="modal-fondo" onClick={() => setVerCola(false)}>
          <div
            className="modal glass"
            role="dialog"
            aria-modal="true"
            aria-label="Cola de reproducción"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-titulo">
              <h3>Cola</h3>
              <button className="btn-icon" onClick={() => setVerCola(false)} aria-label="Cerrar">
                ×
              </button>
            </div>
            {cola.length === 0 ? (
              <p className="muted pie-edicion">
                No hay nada encolado. Con el botón de cola de cada canción podés ponerla “a continuación” o al final.
              </p>
            ) : (
              <>
                <p className="muted pie-edicion">Suenan antes que el resto de la biblioteca, en este orden.</p>
                {cola.map((id, i) => {
                  const p = porId.get(id);
                  if (!p) return null;
                  return (
                    <div key={id} className="menu-linea">
                      <span className="cola-num">{i + 1}</span>
                      <button
                        className="cola-tema"
                        onClick={() => {
                          prepararAnalizador();
                          setActualId(id);
                          setCola((c) => quitarDeCola(c, id)); // ahora es la que suena
                          setVerCola(false);
                        }}
                        title="Reproducir ahora"
                      >
                        {p.titulo}
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => setCola((c) => moverEnCola(c, id, -1))}
                        disabled={i === 0}
                        aria-label={`Subir ${p.titulo} en la cola`}
                        title="Subir en la cola"
                      >
                        <IcSubir />
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => setCola((c) => moverEnCola(c, id, 1))}
                        disabled={i === cola.length - 1}
                        aria-label={`Bajar ${p.titulo} en la cola`}
                        title="Bajar en la cola"
                      >
                        <IcBajar />
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => setCola((c) => quitarDeCola(c, id))}
                        aria-label={`Quitar ${p.titulo} de la cola`}
                        title="Quitar de la cola"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                <button className="add-lista" onClick={() => setCola([])}>
                  Vaciar la cola
                </button>
              </>
            )}
          </div>
        </div>
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