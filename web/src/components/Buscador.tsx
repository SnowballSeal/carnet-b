import { useEffect, useMemo, useState } from "react";
import { cargarBanco, cargarEpigrafes, catalogo, normalizarTexto, type Pregunta } from "../lib/data";

const MIN_LETRAS = 3;
const MAX_RESULTADOS = 40;

interface EpigrafeIndexado {
  tema: number;
  temaNombre: string;
  lamina: number;
  titulo: string | null;
  texto: string | null;
  buscable: string;
}

interface Indice {
  preguntas: { pregunta: Pregunta; buscable: string }[];
  epigrafes: EpigrafeIndexado[];
}

/** Carga banco + epígrafes de todos los temas y deja el texto prenormalizado. */
async function construirIndice(): Promise<Indice> {
  const [banco, porTema] = await Promise.all([
    cargarBanco(),
    Promise.all(catalogo.temas.map(async (t) => ({ tema: t, epigrafes: await cargarEpigrafes(t.numero) }))),
  ]);
  return {
    preguntas: banco.map((pregunta) => ({
      pregunta,
      buscable: normalizarTexto([pregunta.t, ...pregunta.o, pregunta.a ?? ""].join(" ")),
    })),
    epigrafes: porTema.flatMap(({ tema, epigrafes }) =>
      (epigrafes ?? []).map((e) => ({
        tema: tema.numero,
        temaNombre: tema.nombre,
        lamina: e.n,
        titulo: e.titulo,
        texto: e.texto,
        buscable: normalizarTexto([e.titulo ?? "", e.texto ?? ""].join(" ")),
      }))
    ),
  };
}

/* El índice se construye una sola vez por sesión y se comparte entre visitas.
   Si la carga falla (sin red), se descarta para reintentarla la próxima vez. */
let indicePromesa: Promise<Indice> | null = null;

export function precalentarIndice(): Promise<Indice> {
  indicePromesa ??= construirIndice().catch((e) => {
    indicePromesa = null;
    throw e;
  });
  return indicePromesa;
}

/** Recorte del texto alrededor de la primera aparición del término. */
function extracto(texto: string, termino: string): string {
  const donde = normalizarTexto(texto).indexOf(termino);
  if (donde < 0) return texto.slice(0, 140);
  const inicio = Math.max(0, donde - 60);
  return `${inicio > 0 ? "…" : ""}${texto.slice(inicio, donde + 100)}…`;
}

export default function Buscador() {
  const [indice, setIndice] = useState<Indice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consulta, setConsulta] = useState("");

  useEffect(() => {
    precalentarIndice()
      .then(setIndice)
      .catch((e) =>
        setError(
          e instanceof Error
            ? `${e.message} Comprueba que la web se está sirviendo con su servidor.`
            : "Error desconocido al cargar los datos."
        )
      );
  }, []);

  const termino = normalizarTexto(consulta.trim());

  const resultados = useMemo(() => {
    if (!indice || termino.length < MIN_LETRAS) return null;
    return {
      preguntas: indice.preguntas.filter((p) => p.buscable.includes(termino)),
      epigrafes: indice.epigrafes.filter((e) => e.buscable.includes(termino)),
    };
  }, [indice, termino]);

  return (
    <>
      <header className="viewhead">
        <a className="back" href="#">← Índice</a>
        <h1>Buscar</h1>
      </header>

      <div className="buscador">
        <p className="aviso">
          Busca en las {new Intl.NumberFormat("es-ES").format(catalogo.totales.preguntas)} preguntas del banco y en el
          texto del temario. Sin distinguir mayúsculas ni tildes.
        </p>
        <input
          className="buscador__campo"
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="glorieta, tasa de alcohol, ceda el paso…"
          aria-label="Texto a buscar"
          autoFocus
        />

        {error && <p className="aviso" role="alert">No se pudo cargar el índice de búsqueda. {error}</p>}
        {!error && !indice && <p className="aviso" aria-busy="true">Cargando el índice de búsqueda…</p>}
        {indice && termino.length > 0 && termino.length < MIN_LETRAS && (
          <p className="aviso">Escribe al menos {MIN_LETRAS} letras.</p>
        )}

        {resultados && (
          <>
            <section className="section section--tight" aria-labelledby="bus-preg">
              <header>
                <h2 id="bus-preg">Preguntas · {resultados.preguntas.length}</h2>
                {resultados.preguntas.length > MAX_RESULTADOS && (
                  <p>Se muestran las {MAX_RESULTADOS} primeras — afina la búsqueda.</p>
                )}
              </header>
              {resultados.preguntas.length === 0 && <p className="aviso">Ninguna pregunta contiene «{consulta.trim()}».</p>}
              {resultados.preguntas.slice(0, MAX_RESULTADOS).map(({ pregunta }, i) => (
                <details className="buscador__pregunta" key={i}>
                  <summary>{pregunta.t}</summary>
                  <div className="buscador__detalle">
                    {pregunta.img && <img src={pregunta.img} alt="Ilustración de la pregunta" loading="lazy" />}
                    <ul>
                      {pregunta.o.map((texto, j) => (
                        <li key={j} data-correcta={j === pregunta.c}>
                          <b>{pregunta.l[j]}</b> {texto} {j === pregunta.c ? "✓" : ""}
                        </li>
                      ))}
                    </ul>
                    {pregunta.a && <p>{pregunta.a}</p>}
                  </div>
                </details>
              ))}
            </section>

            <section className="section section--tight" aria-labelledby="bus-tem">
              <header>
                <h2 id="bus-tem">Temario · {resultados.epigrafes.length}</h2>
                {resultados.epigrafes.length > MAX_RESULTADOS && (
                  <p>Se muestran los {MAX_RESULTADOS} primeros — afina la búsqueda.</p>
                )}
              </header>
              {resultados.epigrafes.length === 0 && <p className="aviso">Ningún epígrafe contiene «{consulta.trim()}».</p>}
              <ul className="buscador__epigrafes">
                {resultados.epigrafes.slice(0, MAX_RESULTADOS).map((e, i) => (
                  <li key={i}>
                    <a className="testrow" href={`#/tema/${e.tema}/${e.lamina}`}>
                      <span>
                        <b>{e.titulo ?? `Lámina ${e.lamina}`}</b>
                        <span className="buscador__extracto">{e.texto ? extracto(e.texto, termino) : ""}</span>
                      </span>
                      <span className="cnt tnum">
                        tema {e.tema} · lámina {e.lamina}
                      </span>
                      <span className="go">Abrir →</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </>
  );
}
