import { useEffect, useMemo, useState } from "react";
import { cargarBanco, clavePregunta, type Pregunta } from "../lib/data";
import { rankingFallos, RACHA_DOMINADA } from "../lib/progreso";

/** Apartado de preguntas falladas: la lista completa y un test aleatorio con ellas. */
export default function Falladas() {
  const [banco, setBanco] = useState<Map<string, Pregunta> | null>(null);
  const [nTest, setNTest] = useState(10);
  const [estudio, setEstudio] = useState(false);
  const ranking = useMemo(() => rankingFallos(), []);
  const pendientes = ranking.filter((r) => !r.dominada);
  const dominadas = ranking.length - pendientes.length;

  useEffect(() => {
    if (ranking.length === 0) return;
    cargarBanco().then((b) =>
      setBanco(new Map(b.filter((q) => q.src).map((q) => [clavePregunta(q.src!), q])))
    );
  }, [ranking.length]);

  if (ranking.length === 0) {
    return (
      <>
        <header className="viewhead">
          <a className="back" href="#">← Índice</a>
          <h1>Preguntas falladas</h1>
        </header>
        <div className="estado">
          <p>Sin fallos registrados todavía.</p>
          <p>
            Cuando corrijas un test o un simulacro, cada pregunta que falles queda
            registrada en este navegador y aparecerá aquí para repasarla.
          </p>
          <a className="chip chip--accent" href="#/simulacro">Empezar simulacro</a>
        </div>
      </>
    );
  }

  const tandas = [10, 20, 30].filter((n) => n <= pendientes.length);

  return (
    <>
      <header className="viewhead">
        <a className="back" href="#">← Índice</a>
        <h1>Preguntas falladas</h1>
      </header>

      <section className="section section--tight" aria-labelledby="fall-test">
        <header>
          <h2 id="fall-test">Repasarlas en un test</h2>
          <p>
            {pendientes.length === 0
              ? "Ninguna pendiente: las tienes todas dominadas."
              : `${pendientes.length} ${pendientes.length === 1 ? "pendiente" : "pendientes"} — el test se monta al azar con ellas.`}{" "}
            Una pregunta se da por dominada al acertarla {RACHA_DOMINADA} veces seguidas desde el último fallo, y deja
            de entrar en estos tests.
          </p>
        </header>
        {pendientes.length > 0 && (
          <div className="acciones">
            {tandas.length > 1 && (
              <fieldset className="n-preguntas">
                <legend>Nº de preguntas</legend>
                {tandas.map((n) => (
                  <label key={n}>
                    <input
                      type="radio"
                      name="n-falladas"
                      value={n}
                      checked={nTest === n}
                      onChange={() => setNTest(n)}
                    />
                    {n}
                  </label>
                ))}
              </fieldset>
            )}
            <fieldset className="n-preguntas modo-correccion">
              <legend>Corrección</legend>
              <label>
                <input type="radio" name="modo-falladas" checked={!estudio} onChange={() => setEstudio(false)} />
                Al final
              </label>
              <label>
                <input type="radio" name="modo-falladas" checked={estudio} onChange={() => setEstudio(true)} />
                Inmediata (estudio)
              </label>
            </fieldset>
            <a
              className="chip chip--accent"
              href={`#/falladas/${tandas.length > 1 ? nTest : pendientes.length}${estudio ? "?modo=estudio" : ""}`}
            >
              {tandas.length > 1 ? "Generar test" : `Hacer test con las ${pendientes.length}`}
            </a>
          </div>
        )}
      </section>

      <section className="section section--tight" aria-labelledby="fall-lista">
        <header>
          <h2 id="fall-lista">Todas tus falladas</h2>
          <p>
            De más a menos veces fallada{dominadas > 0 ? ` · ${dominadas} ya ${dominadas === 1 ? "dominada" : "dominadas"}` : ""}.
          </p>
        </header>
        <table className="viz-fallos tnum">
          <thead>
            <tr>
              <th scope="col">Pregunta</th>
              <th scope="col">Fallada</th>
              <th scope="col">Acertada</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((r) => (
              <tr key={r.clave}>
                <td>{banco?.get(r.clave)?.t ?? "…"}</td>
                <td>{r.fallos}</td>
                <td>{r.aciertos}</td>
                <td data-dominada={r.dominada}>{r.dominada ? "Dominada" : "Pendiente"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
