import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";

type Pista = { id: number; nombre: string; archivo: File };

const sinExtension = (nombre: string) => nombre.replace(/\.[^/.]+$/, "");

function formato(seg: number) {
  if (!Number.isFinite(seg)) return "0:00";
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
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
const IcEcualizador = () => (
  <Icono>
    <rect x="4" y="10" width="4" height="10" rx="1" />
    <rect x="10" y="4" width="4" height="16" rx="1" />
    <rect x="16" y="8" width="4" height="12" rx="1" />
  </Icono>
);

export default function App() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const siguienteId = useRef(1);
  const [pistas, setPistas] = useState<Pista[]>([]);
  const [actual, setActual] = useState(-1);
  const [sonando, setSonando] = useState(false);
  const [tiempo, setTiempo] = useState(0);
  const [duracion, setDuracion] = useState(0);
  const [volumen, setVolumen] = useState(volumenInicial);
  const [silenciado, setSilenciado] = useState(false);

  const pista = pistas[actual];
  const archivo = pista?.archivo;

  // Crea la URL solo de la pista actual y la libera al cambiar (ahorra memoria)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !archivo) return;
    const url = URL.createObjectURL(archivo);
    audio.src = url;
    audio.play().catch(() => {});
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

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

  function agregar(e: ChangeEvent<HTMLInputElement>) {
    const nuevas = Array.from(e.target.files ?? []).map((f) => ({
      id: siguienteId.current++,
      nombre: sinExtension(f.name),
      archivo: f,
    }));
    e.target.value = "";
    if (nuevas.length === 0) return;
    setPistas((prev) => [...prev, ...nuevas]);
    if (actual === -1) setActual(0);
  }

  function alternar() {
    const audio = audioRef.current;
    if (!audio || !archivo) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }

  function siguiente() {
    if (pistas.length === 0) return;
    setActual((i) => (i + 1) % pistas.length);
  }

  function anterior() {
    const audio = audioRef.current;
    if (pistas.length === 0 || !audio) return;
    if (audio.currentTime > 3) audio.currentTime = 0;
    else setActual((i) => (i - 1 + pistas.length) % pistas.length);
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

  return (
    <main className="app">
      <header className="brand">
        <img src="/pwa-192x192.png" alt="" />
        <h1>Vitra</h1>
      </header>

      <section className="glass now">
        <h2>{pista ? pista.nombre : "Nada sonando"}</h2>
        <p className="muted">{pista ? `Pista ${actual + 1} de ${pistas.length}` : "Agregá música para empezar"}</p>

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
          <button className="btn" onClick={siguiente} disabled={!pista} aria-label="Siguiente">
            <IcSiguiente />
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

      <label className="add glass" style={{ padding: "0.85rem" }}>
        + Agregar música
        <input type="file" accept="audio/*" multiple onChange={agregar} />
      </label>

      <section className="glass">
        {pistas.length === 0 ? (
          <p className="empty">Todavía no hay canciones.</p>
        ) : (
          <ul className="list">
            {pistas.map((p, i) => (
              <li key={p.id}>
                <button className={`track ${i === actual ? "on" : ""}`} onClick={() => setActual(i)}>
                  <span className="num">{i === actual ? <IcEcualizador /> : i + 1}</span>
                  <span>{p.nombre}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <audio
        ref={audioRef}
        onPlay={() => setSonando(true)}
        onPause={() => setSonando(false)}
        onTimeUpdate={(e) => setTiempo(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuracion(e.currentTarget.duration)}
        onEnded={siguiente}
      />
    </main>
  );
}