import { useEffect, useState } from "react";
import { catalogo } from "../lib/data";
import { fallosPendientes } from "../lib/progreso";

const nf = new Intl.NumberFormat("es-ES");

function Categoria({ cat, abierta, onToggle, sufijo }: {
  cat: (typeof catalogo.categorias)[number];
  abierta: boolean;
  onToggle: () => void;
  sufijo: string;
}) {
  return (
    <div className="cat" data-open={abierta}>
      <button className="cat__head" onClick={onToggle} aria-expanded={abierta}>
        <span className="marker" aria-hidden="true">›</span>
        <h3>{cat.nombre}</h3>
        <span className="cnt tnum">{cat.tests.length} tests</span>
      </button>
      <div className="cat__body">
        <div>
          <ul>
            {cat.tests.map((t) => (
              <li key={t.id}>
                <a className="testrow" href={`#/test/${cat.id}/${t.id}${sufijo}`}>
                  <span>{t.nombre}</span>
                  <span className="cnt tnum">{t.preguntas} preguntas</span>
                  <span className="go">Empezar →</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function Indice() {
  const [abierta, setAbierta] = useState<number | null>(null);
  const [nAleatorio, setNAleatorio] = useState(10);
  const [catAleatorio, setCatAleatorio] = useState<number | null>(null);
  const [estudioTests, setEstudioTests] = useState(false);
  const [estudioAleatorio, setEstudioAleatorio] = useState(false);
  const [copiaDisponible, setCopiaDisponible] = useState(false);
  const { totales, temas, categorias } = catalogo;
  const nFalladas = fallosPendientes().length;

  const consultaAleatorio = [
    ...(estudioAleatorio ? ["modo=estudio"] : []),
    ...(catAleatorio !== null ? [`cat=${catAleatorio}`] : []),
  ];
  const enlaceAleatorio = `#/aleatorio/${nAleatorio}${consultaAleatorio.length ? `?${consultaAleatorio.join("&")}` : ""}`;

  // El botón de descarga solo aparece si este servidor sabe generar el
  // paquete (en la propia copia local descargada, no).
  useEffect(() => {
    fetch("descargar/disponible")
      .then((r) => setCopiaDisponible(r.ok))
      .catch(() => setCopiaDisponible(false));
  }, []);

  return (
    <>
      <header className="masthead">
        <h1>Carnet B — cuaderno de estudio</h1>
        <p>
          Web de estudio para el carnet tipo B: el temario teórico completo y un banco
          de exámenes con corrección y ayuda en cada pregunta.
        </p>
      </header>

      <section className="stats tnum" aria-label="Contenido disponible">
        <div><b>{nf.format(totales.tests)}</b><span>tests</span></div>
        <div><b>{nf.format(totales.preguntas)}</b><span>preguntas</span></div>
        <div><b>{nf.format(totales.temas)}</b><span>temas</span></div>
        <div><b>{nf.format(totales.diapositivas)}</b><span>diapositivas</span></div>
      </section>

      <section className="section" id="temario" aria-labelledby="temario-h">
        <header>
          <h2 id="temario-h">Temario</h2>
          <p>Las lecciones del profesor, tema a tema.</p>
        </header>
        <div className="temario">
          {temas.map((t) => (
            <a key={t.numero} href={`#/tema/${t.numero}`}>
              <span className="num tnum">{String(t.numero).padStart(2, "0")}</span>
              <span>{t.nombre}</span>
              <span className="cnt tnum">{t.diapositivas} láminas</span>
            </a>
          ))}
        </div>
      </section>

      <section className="section" id="tests" aria-labelledby="tests-h">
        <header>
          <h2 id="tests-h">Tests</h2>
          <p>El catálogo completo, con su corrección.</p>
        </header>
        <fieldset className="n-preguntas modo-correccion modo-correccion--suelto">
          <legend>Corrección</legend>
          <label>
            <input
              type="radio"
              name="modo-tests"
              checked={!estudioTests}
              onChange={() => setEstudioTests(false)}
            />
            Al final
          </label>
          <label>
            <input
              type="radio"
              name="modo-tests"
              checked={estudioTests}
              onChange={() => setEstudioTests(true)}
            />
            Inmediata (estudio)
          </label>
        </fieldset>
        {categorias.map((cat) => (
          <Categoria
            key={cat.id}
            cat={cat}
            abierta={abierta === cat.id}
            onToggle={() => setAbierta(abierta === cat.id ? null : cat.id)}
            sufijo={estudioTests ? "?modo=estudio" : ""}
          />
        ))}
      </section>

      <section className="section section--tight" id="practica" aria-labelledby="practica-h">
        <header>
          <h2 id="practica-h">Práctica</h2>
        </header>
        <div className="practica">
          <div>
            <h3>Simulacro de examen</h3>
            <p>
              30 preguntas al azar de todo el banco, 30 minutos de tiempo y el criterio
              de la DGT: apto con un máximo de 3 errores.
            </p>
            <div className="acciones">
              <a className="chip chip--accent" href="#/simulacro">Empezar simulacro</a>
            </div>
          </div>
          <div>
            <h3>Examen aleatorio</h3>
            <p>Una tanda corta sin cronómetro, para repasar entre horas.</p>
            <div className="acciones">
              <fieldset className="n-preguntas">
                <legend>Nº de preguntas</legend>
                {[10, 20, 30].map((n) => (
                  <label key={n}>
                    <input
                      type="radio"
                      name="n-aleatorio"
                      value={n}
                      checked={nAleatorio === n}
                      onChange={() => setNAleatorio(n)}
                    />
                    {n}
                  </label>
                ))}
              </fieldset>
            </div>
            <div className="acciones">
              <fieldset className="n-preguntas modo-correccion">
                <legend>Preguntas de</legend>
                <label>
                  <input
                    type="radio"
                    name="cat-aleatorio"
                    checked={catAleatorio === null}
                    onChange={() => setCatAleatorio(null)}
                  />
                  Todo el banco
                </label>
                {categorias.map((c) => (
                  <label key={c.id}>
                    <input
                      type="radio"
                      name="cat-aleatorio"
                      checked={catAleatorio === c.id}
                      onChange={() => setCatAleatorio(c.id)}
                    />
                    {c.nombre}
                  </label>
                ))}
              </fieldset>
            </div>
            <div className="acciones">
              <fieldset className="n-preguntas modo-correccion">
                <legend>Corrección</legend>
                <label>
                  <input
                    type="radio"
                    name="modo-aleatorio"
                    checked={!estudioAleatorio}
                    onChange={() => setEstudioAleatorio(false)}
                  />
                  Al final
                </label>
                <label>
                  <input
                    type="radio"
                    name="modo-aleatorio"
                    checked={estudioAleatorio}
                    onChange={() => setEstudioAleatorio(true)}
                  />
                  Inmediata (estudio)
                </label>
              </fieldset>
            </div>
            <div className="acciones">
              <a className="chip" href={enlaceAleatorio}>Generar examen</a>
            </div>
          </div>
          <div>
            <h3>Preguntas falladas</h3>
            <p>
              {nFalladas === 0
                ? "Cuando corrijas tests, tus fallos se registran y aquí podrás repasarlos."
                : `Tu lista de fallos y un test aleatorio con ellos — llevas ${nFalladas} ${nFalladas === 1 ? "pregunta fallada" : "preguntas falladas"} registradas.`}
            </p>
            <div className="acciones">
              {nFalladas > 0 ? (
                <a className="chip" href="#/falladas">Ver tus falladas</a>
              ) : (
                <a className="chip chip--quiet" href="#/progreso">Ver progreso</a>
              )}
            </div>
          </div>
        </div>
      </section>

      {copiaDisponible && (
        <section className="section section--tight" id="copia" aria-labelledby="copia-h">
          <header>
            <h2 id="copia-h">Copia local</h2>
            <p>
              Descarga la web completa con todos sus datos (~220 MB) en un ZIP. No hay
              que instalar nada: el arrancador incluido pone en marcha la web (e instala
              Python solo si falta) en Windows, Linux, macOS o Android (Termux). En
              iPhone/iPad no se puede arrancar el servidor, pero sí abrir en Safari la
              copia arrancada en otro dispositivo de la misma red (el LEEME lo explica).
              Cada copia puede a su vez compartirse desde este mismo apartado; tu
              progreso se lleva aparte con «Exportar progreso» en el panel de progreso.
            </p>
          </header>
          <div className="acciones">
            <a className="chip" href="descargar/carnet-b-local.zip" download>
              Descargar copia local (.zip)
            </a>
          </div>
        </section>
      )}

      <footer className="foot">
        <p>Carnet B · cuaderno de estudio personal · 2026</p>
        <p>
          Recopilación de material de estudio para el examen teórico del permiso B,
          elaborada sin ánimo de lucro y con fines exclusivamente educativos.
        </p>
      </footer>
    </>
  );
}
