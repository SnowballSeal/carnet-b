import { useEffect, useMemo, useRef, useState } from "react";
import {
  cargarTest,
  cargarBanco,
  muestraAleatoria,
  barajar,
  barajarOpciones,
  precargarImagenes,
  clavePregunta,
  catalogo,
  type Pregunta,
} from "../lib/data";
import {
  guardarIntento,
  fallosPendientes,
  historialPorPregunta,
  type ResultadoPregunta,
} from "../lib/progreso";
import Lightbox from "./Lightbox";
import type { Ruta } from "../App";

type Fuente = Extract<Ruta, { vista: "test" | "simulacro" | "aleatorio" | "falladas" }>;

type Carga =
  | { estado: "cargando" }
  | { estado: "error"; mensaje: string }
  | { estado: "vacio"; mensaje: string }
  | { estado: "lista"; nombre: string; preguntas: Pregunta[] };

const DURACION_SIMULACRO = 30 * 60; // segundos, como el examen oficial

function formatoTiempo(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Una tanda al azar de entre las preguntas falladas aún sin dominar. */
async function generarFalladas(n: number): Promise<Pregunta[]> {
  const pendientes = fallosPendientes();
  if (pendientes.length === 0) return [];
  const banco = await cargarBanco();
  const porClave = new Map(banco.map((q) => [q.src ? clavePregunta(q.src) : "", q]));
  const preguntas = pendientes
    .map((r) => porClave.get(r.clave))
    .filter((q): q is Pregunta => q !== undefined);
  return barajar(preguntas).slice(0, n);
}

export default function TestRunner({ fuente }: { fuente: Fuente }) {
  const [carga, setCarga] = useState<Carga>({ estado: "cargando" });
  const [actual, setActual] = useState(0);
  const [respuestas, setRespuestas] = useState<(number | null)[]>([]);
  // Modo estudio: preguntas ya resueltas (corrección inmediata al responder).
  const [resueltas, setResueltas] = useState<boolean[]>([]);
  const [corregido, setCorregido] = useState(false);
  const [confirmando, setConfirmando] = useState<"salir" | "corregir" | null>(null);
  const [segundos, setSegundos] = useState(DURACION_SIMULACRO);
  const [ampliada, setAmpliada] = useState(false);
  const resultadoRef = useRef<HTMLDivElement>(null);
  const ayudaRef = useRef<HTMLDetailsElement>(null);
  const guardadoRef = useRef(false);
  // Fallos/aciertos previos de cada pregunta, congelados al empezar el intento.
  const historialRef = useRef<ReturnType<typeof historialPorPregunta> | null>(null);
  const toqueRef = useRef<{ x: number; y: number } | null>(null);

  const estudio = "estudio" in fuente && fuente.estudio;

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        if (fuente.vista === "test") {
          const { nombre, preguntas } = await cargarTest(fuente.cat, fuente.id);
          // Orden nuevo en cada apertura, para no memorizar la secuencia.
          if (!cancelado) iniciar(nombre, barajar(preguntas));
        } else if (fuente.vista === "falladas") {
          const preguntas = await generarFalladas(fuente.n);
          if (cancelado) return;
          if (preguntas.length === 0) {
            setCarga({
              estado: "vacio",
              mensaje:
                "Aún no hay preguntas falladas registradas. Corrige algún test o simulacro y las que falles irán apareciendo aquí.",
            });
            return;
          }
          iniciar(`Preguntas falladas · ${preguntas.length}`, preguntas);
        } else {
          const banco = await cargarBanco();
          const soloCat = fuente.vista === "aleatorio" ? fuente.soloCat : null;
          const categoria = soloCat !== null ? catalogo.categorias.find((c) => c.id === soloCat) : undefined;
          const elegibles = categoria ? banco.filter((q) => q.src?.cat === categoria.id) : banco;
          const n = fuente.vista === "simulacro" ? 30 : fuente.n;
          const nombre =
            fuente.vista === "simulacro"
              ? "Simulacro de examen"
              : `Examen aleatorio · ${n} preguntas${categoria ? ` · ${categoria.nombre}` : ""}`;
          if (!cancelado) iniciar(nombre, muestraAleatoria(elegibles, n));
        }
      } catch (e) {
        if (!cancelado)
          setCarga({
            estado: "error",
            mensaje:
              e instanceof Error
                ? `${e.message} Comprueba que la web se está sirviendo con su servidor («npm run dev» o el servidor de la copia local).`
                : "Error desconocido al cargar las preguntas.",
          });
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function iniciar(nombre: string, preguntasOrigen: Pregunta[]) {
    // Además del orden de preguntas, se baraja el de las opciones de cada una.
    const preguntas = preguntasOrigen.map(barajarOpciones);
    setCarga({ estado: "lista", nombre, preguntas });
    setRespuestas(Array(preguntas.length).fill(null));
    setResueltas(Array(preguntas.length).fill(false));
    setActual(0);
    setCorregido(false);
    setConfirmando(null);
    setSegundos(DURACION_SIMULACRO);
    guardadoRef.current = false;
    historialRef.current = historialPorPregunta();
    // Calienta todas las ilustraciones del test para que saltar de pregunta
    // no espere a la red.
    precargarImagenes(preguntas.map((p) => p.img));
  }

  const conTiempo = fuente.vista === "simulacro";

  function corregirAhora(restantes?: number) {
    setCorregido(true);
    setConfirmando(null);
    if (carga.estado !== "lista" || guardadoRef.current) return;
    guardadoRef.current = true;
    let aciertos = 0;
    let fallos = 0;
    const porPregunta: ResultadoPregunta[] = [];
    carga.preguntas.forEach((p, i) => {
      const r = respuestas[i];
      if (r === null) return;
      const acertada = r === p.c;
      if (acertada) aciertos += 1;
      else fallos += 1;
      if (p.src) porPregunta.push({ src: p.src, acertada });
    });
    const intento = {
      fecha: new Date().toISOString(),
      aciertos,
      fallos,
      blanco: carga.preguntas.length - aciertos - fallos,
      total: carga.preguntas.length,
      ...(conTiempo ? { segundos: DURACION_SIMULACRO - (restantes ?? segundos) } : {}),
    };
    guardarIntento(
      fuente.vista === "test" ? { tipo: "test", cat: fuente.cat, id: fuente.id } : { tipo: fuente.vista },
      intento,
      porPregunta
    );
  }

  // Cronómetro del simulacro: al agotarse, se corrige solo.
  useEffect(() => {
    if (!conTiempo || corregido || carga.estado !== "lista") return;
    const id = setInterval(() => {
      setSegundos((s) => {
        if (s <= 1) {
          clearInterval(id);
          corregirAhora(0);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conTiempo, corregido, carga.estado]);

  useEffect(() => {
    if (corregido) resultadoRef.current?.focus();
  }, [corregido]);

  // Al cambiar de pregunta, la imagen ampliada (si la había) se cierra.
  useEffect(() => {
    setAmpliada(false);
  }, [actual]);

  function responder(opcion: number) {
    if (corregido) return;
    // En modo estudio la primera respuesta revela la corrección y queda fijada.
    if (estudio) {
      if (resueltas[actual]) return;
      setRespuestas((rs) => {
        const nuevo = [...rs];
        nuevo[actual] = opcion;
        return nuevo;
      });
      setResueltas((vs) => {
        const nuevo = [...vs];
        nuevo[actual] = true;
        return nuevo;
      });
      return;
    }
    setRespuestas((rs) => {
      const nuevo = [...rs];
      nuevo[actual] = nuevo[actual] === opcion ? null : opcion;
      return nuevo;
    });
  }

  // Atajos de teclado (PC): flechas para cambiar de pregunta; la letra de la
  // opción o su número (1-3) para marcarla/desmarcarla.
  useEffect(() => {
    if (carga.estado !== "lista") return;
    const { preguntas } = carga;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const origen = e.target as HTMLElement | null;
      if (origen && (["INPUT", "TEXTAREA", "SELECT"].includes(origen.tagName) || origen.isContentEditable)) return;
      if (e.key === "ArrowRight") {
        setActual((a) => Math.min(a + 1, preguntas.length - 1));
        return;
      }
      if (e.key === "ArrowLeft") {
        setActual((a) => Math.max(a - 1, 0));
        return;
      }
      if (e.key.toLowerCase() === "h" && ayudaRef.current) {
        ayudaRef.current.open = !ayudaRef.current.open;
        return;
      }
      if (corregido) return;
      const p = preguntas[actual];
      const opcion = /^[1-9]$/.test(e.key)
        ? Number(e.key) - 1
        : p.l.findIndex((l) => l.toLowerCase() === e.key.toLowerCase());
      if (opcion >= 0 && opcion < p.o.length) responder(opcion);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carga, actual, corregido]);

  const resumen = useMemo(() => {
    if (carga.estado !== "lista") return null;
    let aciertos = 0;
    let fallos = 0;
    let blanco = 0;
    carga.preguntas.forEach((p, i) => {
      if (respuestas[i] === null) blanco += 1;
      else if (respuestas[i] === p.c) aciertos += 1;
      else fallos += 1;
    });
    return { aciertos, fallos, blanco };
  }, [carga, respuestas]);

  if (carga.estado === "cargando") {
    return (
      <div className="estado" aria-busy="true">
        <p>Cargando preguntas…</p>
      </div>
    );
  }

  if (carga.estado === "error" || carga.estado === "vacio") {
    return (
      <div className="estado">
        <p>
          {carga.estado === "error" ? "No se pudieron cargar las preguntas. " : ""}
          {carga.mensaje}
        </p>
        <a className="chip" href="#">Volver al índice</a>
      </div>
    );
  }

  const { nombre, preguntas } = carga;
  const p = preguntas[actual];
  const esExamenCompleto = preguntas.length === 30;
  const sinResponder = respuestas.filter((r) => r === null).length;
  // La corrección de la pregunta visible: al corregir todo o, en modo estudio, al responderla.
  const reveladaActual = corregido || (estudio && resueltas[actual]);
  const fallosPrevios = p.src ? historialRef.current?.fallos[clavePregunta(p.src)] ?? 0 : 0;

  function pedirCorreccion() {
    if (sinResponder > 0 && confirmando !== "corregir") {
      setConfirmando("corregir");
      return;
    }
    corregirAhora();
  }

  function salir(e: React.MouseEvent) {
    if (!corregido && respuestas.some((r) => r !== null) && confirmando !== "salir") {
      e.preventDefault();
      setConfirmando("salir");
    }
  }

  function repetir() {
    setRespuestas(Array(preguntas.length).fill(null));
    setResueltas(Array(preguntas.length).fill(false));
    setActual(0);
    setCorregido(false);
    setConfirmando(null);
    setSegundos(DURACION_SIMULACRO);
    guardadoRef.current = false;
    historialRef.current = historialPorPregunta();
    window.scrollTo(0, 0);
  }

  const categoria = fuente.vista === "test" ? catalogo.categorias.find((c) => c.id === fuente.cat) : null;

  return (
    <>
      <header className="viewhead">
        <a className="back" href="#" onClick={salir}>← Índice</a>
        <h1>{nombre}</h1>
        {estudio && <span className="counter">modo estudio</span>}
        {conTiempo && !corregido && (
          <span className="counter tnum" aria-live="off">{formatoTiempo(segundos)}</span>
        )}
        <span className="counter tnum">
          {actual + 1} / {preguntas.length}
        </span>
      </header>

      {confirmando === "salir" && (
        <div className="resultado" role="alertdialog" aria-label="Confirmar salida">
          <p className="aviso">Si sales ahora se perderá el progreso de este intento.</p>
          <div className="runner__nav">
            <a className="chip" href="#">Salir igualmente</a>
            <button className="chip chip--quiet" onClick={() => setConfirmando(null)}>Seguir con el test</button>
          </div>
        </div>
      )}

      {corregido && resumen && (
        <div className="resultado" ref={resultadoRef} tabIndex={-1} aria-live="polite">
          {esExamenCompleto ? (
            <p className="resultado__veredicto" data-apto={resumen.fallos <= 3}>
              {resumen.fallos <= 3 ? "✓ Apto" : "✗ No apto"} — {resumen.fallos}{" "}
              {resumen.fallos === 1 ? "error" : "errores"} (máximo 3)
            </p>
          ) : (
            <p className="resultado__veredicto">
              {resumen.aciertos} de {preguntas.length}
            </p>
          )}
          <div className="resultado__cifras tnum">
            <div><b>{resumen.aciertos}</b><span>aciertos</span></div>
            <div><b>{resumen.fallos}</b><span>fallos</span></div>
            <div><b>{resumen.blanco}</b><span>en blanco</span></div>
            {conTiempo && <div><b>{formatoTiempo(DURACION_SIMULACRO - segundos)}</b><span>tiempo</span></div>}
          </div>
          <div className="runner__nav">
            <button className="chip" onClick={repetir}>Repetir en blanco</button>
            <a className="chip chip--quiet" href="#/progreso">Ver progreso</a>
            <a className="chip chip--quiet" href="#">Volver al índice</a>
          </div>
        </div>
      )}

      <div
        className="runner"
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
          setActual((a) => (dx < 0 ? Math.min(a + 1, preguntas.length - 1) : Math.max(a - 1, 0)));
        }}
      >
        <p className="enunciado">{p.t}</p>

        {p.img && (
          <figure className="pregunta__img">
            <button className="zoomable" onClick={() => setAmpliada(true)} aria-label="Ampliar ilustración">
              <img
                src={p.img}
                alt={`Ilustración de la pregunta ${actual + 1}`}
                width={600}
                height={450}
                fetchPriority="high"
                decoding="async"
              />
            </button>
          </figure>
        )}
        {ampliada && p.img && (
          <Lightbox src={p.img} alt={`Ilustración de la pregunta ${actual + 1}`} onClose={() => setAmpliada(false)} />
        )}

        <ul className="opciones">
          {p.o.map((texto, i) => {
            const elegida = respuestas[actual] === i;
            let estado: string | undefined;
            let simbolo = "";
            if (reveladaActual) {
              if (i === p.c) {
                estado = "correcta";
                simbolo = " ✓";
              } else if (elegida) {
                estado = "elegida-mal";
                simbolo = " ✗";
              }
            }
            return (
              <li key={i}>
                <button
                  className="opcion"
                  aria-pressed={elegida}
                  data-estado={estado}
                  onClick={() => responder(i)}
                  disabled={reveladaActual}
                >
                  <span className="letra">{p.l[i]}</span>
                  <span>
                    {texto}
                    <span className="simbolo" aria-hidden="true">{simbolo}</span>
                    {reveladaActual && i === p.c && <span className="visually-hidden"> (respuesta correcta)</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {reveladaActual && fallosPrevios > 0 && (
          <p className="aviso" role="status" style={{ marginTop: "var(--space-sm)" }}>
            Ya habías fallado esta pregunta {fallosPrevios} {fallosPrevios === 1 ? "vez" : "veces"} antes de este intento.
          </p>
        )}

        {p.a && (corregido || !conTiempo) && (
          <details className="ayuda" ref={ayudaRef}>
            <summary>Ayuda de la pregunta</summary>
            <p>{p.a}</p>
          </details>
        )}

        <div className="runner__nav">
          <button
            className="chip chip--quiet"
            onClick={() => setActual((a) => a - 1)}
            disabled={actual === 0}
            aria-disabled={actual === 0}
          >
            ← Anterior
          </button>
          <button
            className="chip chip--quiet"
            onClick={() => setActual((a) => a + 1)}
            disabled={actual === preguntas.length - 1}
            aria-disabled={actual === preguntas.length - 1}
          >
            Siguiente →
          </button>
          {!corregido && (
            <button className="chip chip--accent" onClick={pedirCorreccion}>
              Corregir
            </button>
          )}
        </div>

        <p className="runner__hint">
          También con el teclado: ← → cambian de pregunta; {p.l.join(", ")} o{" "}
          {p.o.map((_, i) => i + 1).join(", ")} marcan la respuesta
          {p.a && (corregido || !conTiempo) ? "; H abre la ayuda" : ""}.
        </p>

        {confirmando === "corregir" && !corregido && (
          <p className="aviso" style={{ marginTop: "var(--space-sm)" }} role="status">
            {sinResponder === 1 ? "Queda 1 pregunta sin responder." : `Quedan ${sinResponder} preguntas sin responder.`}{" "}
            Pulsa «Corregir» otra vez para corregir igualmente.
          </p>
        )}

        <nav className="mapa" aria-label="Mapa de preguntas">
          {preguntas.map((q, i) => {
            let resultado: string | undefined;
            if (corregido || (estudio && resueltas[i])) {
              if (respuestas[i] !== null) resultado = respuestas[i] === q.c ? "bien" : "mal";
            }
            return (
              <button
                key={i}
                aria-current={i === actual}
                aria-label={`Pregunta ${i + 1}${respuestas[i] !== null ? ", respondida" : ""}`}
                data-respondida={respuestas[i] !== null}
                data-resultado={resultado}
                onClick={() => setActual(i)}
              >
                {i + 1}
              </button>
            );
          })}
        </nav>

        {categoria && (
          <p className="aviso" style={{ marginTop: "var(--space-lg)" }}>
            {categoria.nombre}
          </p>
        )}
      </div>
    </>
  );
}
