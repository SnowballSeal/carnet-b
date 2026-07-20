import { useCallback, useEffect, useRef, useState } from "react";
import { catalogo, cargarEpigrafes, precargarImagenes, type Epigrafe } from "../lib/data";
import { marcarLaminaVista } from "../lib/progreso";
import Lightbox from "./Lightbox";

const src = (tema: number, n: number) => `data/temario/${tema}/${String(n).padStart(3, "0")}.webp`;

/** URL de embebido de YouTube a partir del enlace guardado en el dataset. */
const embed = (url: string) => {
  const id = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{6,})/)?.[1];
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : url;
};

/** Números de lámina cuyo vídeo es embebido (sin PNG que precargar). */
const laminasEmbebidas = (epigrafes: Epigrafe[] | null) =>
  new Set((epigrafes ?? []).filter((e) => e.tipo === "video" && e.video_url).map((e) => e.n));

export default function TemarioViewer({ numero, laminaInicial }: { numero: number; laminaInicial?: number }) {
  const tema = catalogo.temas.find((t) => t.numero === numero);
  const [lamina, setLamina] = useState(laminaInicial ?? 1);
  const [cargando, setCargando] = useState(true);
  // true en cuanto la primera lámina visible termina de cargar: hasta entonces
  // no se lanza ninguna precarga, para no competir con ella por la red.
  const [primeraLista, setPrimeraLista] = useState(false);
  const [epigrafes, setEpigrafes] = useState<Epigrafe[] | null | undefined>(undefined);
  const [ampliada, setAmpliada] = useState(false);
  const toqueRef = useRef<{ x: number; y: number } | null>(null);

  const total = tema?.diapositivas ?? 0;

  const ir = useCallback(
    (destino: number) => {
      if (destino < 1 || destino > total) return;
      setCargando(true);
      setAmpliada(false);
      setLamina(destino);
      // La URL refleja la lámina (recargar o compartir vuelve a ella) sin
      // disparar hashchange: replaceState no re-enruta.
      history.replaceState(null, "", `#/tema/${numero}/${destino}`);
    },
    [total, numero]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Alt/Ctrl+flecha son atajos del navegador (historial): no interceptarlos.
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight") ir(lamina + 1);
      if (e.key === "ArrowLeft") ir(lamina - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lamina, ir]);

  // Texto de los epígrafes del tema (si está disponible).
  useEffect(() => {
    if (tema) cargarEpigrafes(tema.numero).then(setEpigrafes);
  }, [tema]);

  // Registro de progreso del estudio.
  useEffect(() => {
    if (tema) marcarLaminaVista(tema.numero, lamina);
  }, [tema, lamina]);

  // Precarga tras cargar la lámina visible: la ventana ±3 en cada salto y,
  // una vez, el resto del tema en segundo plano para que saltar no espere.
  // Espera a los epígrafes para saltarse los vídeos embebidos (sin PNG).
  useEffect(() => {
    if (!tema || !primeraLista || epigrafes === undefined) return;
    const embebidas = laminasEmbebidas(epigrafes);
    const ventana = [1, 2, 3, -1, -2, -3]
      .map((d) => lamina + d)
      .filter((n) => n >= 1 && n <= total && !embebidas.has(n))
      .map((n) => src(tema.numero, n));
    precargarImagenes(ventana, 2);
  }, [tema, lamina, total, primeraLista, epigrafes]);

  useEffect(() => {
    if (!tema || !primeraLista || epigrafes === undefined) return;
    const embebidas = laminasEmbebidas(epigrafes);
    const resto = Array.from({ length: total }, (_, i) => i + 1)
      .filter((n) => !embebidas.has(n))
      .map((n) => src(tema.numero, n));
    precargarImagenes(resto);
  }, [tema, total, primeraLista, epigrafes]);

  if (!tema) {
    return (
      <div className="estado">
        <p>No existe el tema {numero}.</p>
        <a className="chip" href="#">Volver al índice</a>
      </div>
    );
  }

  const epigrafe = epigrafes?.find((e) => e.n === lamina) ?? null;
  const videoUrl = epigrafe?.tipo === "video" ? epigrafe.video_url ?? null : null;

  const alLlegarLamina = () => {
    setCargando(false);
    setPrimeraLista(true);
  };

  return (
    <>
      <header className="viewhead">
        <a className="back" href="#">← Índice</a>
        <h1>
          Tema {tema.numero} — {tema.nombre}
        </h1>
        <span className="counter tnum" aria-live="polite">
          {lamina} / {total}
        </span>
      </header>

      <div className="visor">
        <div
          className="visor__lamina"
          data-cargando={cargando}
          onTouchStart={(e) => {
            toqueRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          }}
          onTouchEnd={(e) => {
            const inicio = toqueRef.current;
            toqueRef.current = null;
            if (!inicio) return;
            const dx = e.changedTouches[0].clientX - inicio.x;
            const dy = e.changedTouches[0].clientY - inicio.y;
            // Solo deslizamientos claramente horizontales; lo demás es scroll.
            if (Math.abs(dx) < 60 || Math.abs(dx) < 2 * Math.abs(dy)) return;
            ir(dx < 0 ? lamina + 1 : lamina - 1);
          }}
        >
          {videoUrl ? (
            <iframe
              className="visor__video"
              src={embed(videoUrl)}
              title={
                epigrafe?.video_titulo ?? epigrafe?.titulo ?? `Vídeo de la lámina ${lamina}`
              }
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              data-cargando={cargando}
              onLoad={alLlegarLamina}
            />
          ) : (
            <button className="zoomable" onClick={() => setAmpliada(true)} aria-label="Ampliar lámina">
              <img
                src={src(tema.numero, lamina)}
                alt={
                  epigrafe?.titulo
                    ? `Lámina ${lamina}: ${epigrafe.titulo}`
                    : `Lámina ${lamina} del tema ${tema.numero}: ${tema.nombre}`
                }
                width={897}
                height={668}
                data-cargando={cargando}
                fetchPriority="high"
                decoding="async"
                onLoad={alLlegarLamina}
                onError={alLlegarLamina}
              />
            </button>
          )}
        </div>
        {ampliada && !videoUrl && (
          <Lightbox
            src={src(tema.numero, lamina)}
            alt={epigrafe?.titulo ? `Lámina ${lamina}: ${epigrafe.titulo}` : `Lámina ${lamina}`}
            onClose={() => setAmpliada(false)}
          />
        )}

        {epigrafe && (epigrafe.titulo || epigrafe.texto) && (
          <div className="visor__texto">
            {epigrafe.titulo && <h2>{epigrafe.titulo}</h2>}
            {epigrafe.texto &&
              epigrafe.texto.split("\n\n").map((parrafo, i) => <p key={i}>{parrafo}</p>)}
          </div>
        )}

        <div className="visor__controles">
          <button className="chip chip--quiet" onClick={() => ir(lamina - 1)} disabled={lamina <= 1} aria-disabled={lamina <= 1}>
            ← Anterior
          </button>
          <button className="chip" onClick={() => ir(lamina + 1)} disabled={lamina >= total} aria-disabled={lamina >= total}>
            Siguiente →
          </button>
        </div>
        <p className="visor__hint">También con las flechas del teclado.</p>
      </div>
    </>
  );
}
