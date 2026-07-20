import { useMemo, useRef, useState } from "react";
import { catalogo } from "../lib/data";
import {
  progreso,
  mejorIntento,
  borrarProgreso,
  claveTest,
  claveDia,
  actividadDiaria,
  rachaDias,
  rankingFallos,
  exportarProgreso,
  importarProgreso,
  type Intento,
} from "../lib/progreso";

const nf = new Intl.NumberFormat("es-ES");
const df = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });

/** Nivel 1–4 de la rampa secuencial según la fracción de aciertos. */
function nivelRampa(fraccion: number): 1 | 2 | 3 | 4 {
  if (fraccion > 0.9) return 4;
  if (fraccion > 0.75) return 3;
  if (fraccion > 0.5) return 2;
  return 1;
}

/** Nivel 1–4 de la rampa según las preguntas respondidas ese día. */
function nivelDia(preguntas: number): 1 | 2 | 3 | 4 {
  if (preguntas >= 120) return 4;
  if (preguntas >= 60) return 3;
  if (preguntas >= 30) return 2;
  return 1;
}

const DIAS_TIRA = 42; // 6 semanas

/** Racha de días y tira de actividad de las últimas semanas. */
function Constancia() {
  const porDia = actividadDiaria();
  const racha = rachaDias(porDia);
  const dias = Array.from({ length: DIAS_TIRA }, (_, i) => {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - (DIAS_TIRA - 1 - i));
    const clave = claveDia(fecha);
    return { clave, preguntas: porDia.get(clave) ?? 0 };
  });
  return (
    <>
      <p className="aviso">
        {racha > 0
          ? `Racha actual: ${racha} ${racha === 1 ? "día" : "días"} seguidos estudiando.`
          : "Sin racha activa — responde alguna pregunta hoy y empieza una."}
      </p>
      <div className="viz-dias" role="img" aria-label={`Actividad de los últimos ${DIAS_TIRA} días`}>
        {dias.map((d) => (
          <span
            key={d.clave}
            className="viz-dia"
            data-nivel={d.preguntas > 0 ? nivelDia(d.preguntas) : undefined}
            title={`${d.clave}: ${d.preguntas} ${d.preguntas === 1 ? "pregunta" : "preguntas"}`}
          />
        ))}
      </div>
    </>
  );
}

interface TooltipEstado {
  x: number;
  y: number;
  lineas: string[];
}

function Tooltip({ estado }: { estado: TooltipEstado | null }) {
  if (!estado) return null;
  return (
    <div className="viz-tooltip" style={{ left: `${estado.x}%`, top: `${estado.y}%` }} role="status">
      {estado.lineas.map((l, i) => (
        <span key={i}>{l}</span>
      ))}
    </div>
  );
}

/** Evolución de errores por simulacro, con la línea del límite de apto. */
function GraficoSimulacros({ intentos }: { intentos: Intento[] }) {
  const [tooltip, setTooltip] = useState<TooltipEstado | null>(null);
  const ANCHO = 640;
  const ALTO = 220;
  const M = { arriba: 12, abajo: 28, izq: 30, dcha: 12 };
  const maxErrores = Math.max(6, ...intentos.map((i) => i.fallos));
  const x = (i: number) =>
    intentos.length === 1
      ? M.izq + (ANCHO - M.izq - M.dcha) / 2
      : M.izq + (i * (ANCHO - M.izq - M.dcha)) / (intentos.length - 1);
  const y = (fallos: number) => M.arriba + (1 - fallos / maxErrores) * (ALTO - M.arriba - M.abajo);
  const ticks = Array.from({ length: Math.floor(maxErrores / 3) + 1 }, (_, i) => i * 3);

  const mostrar = (i: number, cx: number, cy: number) => {
    const s = intentos[i];
    setTooltip({
      x: (cx / ANCHO) * 100,
      y: (cy / ALTO) * 100,
      lineas: [
        df.format(new Date(s.fecha)),
        `${s.fallos} ${s.fallos === 1 ? "error" : "errores"} · ${s.aciertos} aciertos · ${s.blanco} en blanco`,
        s.fallos <= 3 ? "Apto" : "No apto",
      ],
    });
  };

  return (
    <div className="viz-lienzo">
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label={`Errores por simulacro, ${intentos.length} intentos`}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="viz-grid" x1={M.izq} x2={ANCHO - M.dcha} y1={y(t)} y2={y(t)} />
            <text className="viz-tick" x={M.izq - 8} y={y(t)} dy="0.32em" textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        <line className="viz-limite" x1={M.izq} x2={ANCHO - M.dcha} y1={y(3)} y2={y(3)} />
        <text className="viz-tick viz-tick--limite" x={ANCHO - M.dcha} y={y(3) - 6} textAnchor="end">
          límite de apto (3)
        </text>
        {intentos.length > 1 && (
          <polyline
            className="viz-linea"
            points={intentos.map((s, i) => `${x(i)},${y(s.fallos)}`).join(" ")}
          />
        )}
        {intentos.map((s, i) => (
          <g key={i}>
            <circle className="viz-punto" cx={x(i)} cy={y(s.fallos)} r={5} />
            <rect
              className="viz-hit"
              x={x(i) - 14}
              y={M.arriba}
              width={28}
              height={ALTO - M.arriba - M.abajo}
              tabIndex={0}
              role="button"
              aria-label={`Simulacro ${i + 1}, ${df.format(new Date(s.fecha))}: ${s.fallos} errores, ${
                s.fallos <= 3 ? "apto" : "no apto"
              }`}
              onMouseEnter={() => mostrar(i, x(i), y(s.fallos))}
              onFocus={() => mostrar(i, x(i), y(s.fallos))}
              onMouseLeave={() => setTooltip(null)}
              onBlur={() => setTooltip(null)}
            />
            {i === intentos.length - 1 && (
              <text className="viz-etiqueta" x={x(i)} y={y(s.fallos) - 12} textAnchor="middle">
                {s.fallos}
              </text>
            )}
          </g>
        ))}
        <text className="viz-tick" x={x(0)} y={ALTO - 8} textAnchor="middle">
          {df.format(new Date(intentos[0].fecha))}
        </text>
        {intentos.length > 1 && (
          <text className="viz-tick" x={ANCHO - M.dcha} y={ALTO - 8} textAnchor="end">
            {df.format(new Date(intentos[intentos.length - 1].fecha))}
          </text>
        )}
      </svg>
      <Tooltip estado={tooltip} />
    </div>
  );
}

export default function Progreso() {
  const [tick, setTick] = useState(0);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [tooltipMapa, setTooltipMapa] = useState<TooltipEstado | null>(null);
  const [avisoImportar, setAvisoImportar] = useState<string | null>(null);
  const selectorArchivo = useRef<HTMLInputElement>(null);
  const datos = useMemo(() => progreso(), [tick]);

  function exportar() {
    const blob = new Blob([exportarProgreso()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `carnet-b-progreso-${new Date().toISOString().slice(0, 10)}.json`;
    enlace.click();
    URL.revokeObjectURL(url);
  }

  async function importar(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    try {
      importarProgreso(await archivo.text());
      setAvisoImportar("Progreso importado correctamente.");
      setTick((t) => t + 1);
    } catch (err) {
      setAvisoImportar(
        `No se pudo importar: ${err instanceof Error ? err.message : "error desconocido."}`
      );
    }
  }

  const copiaSeguridad = (
    <div className="acciones">
      <button className="chip chip--quiet" onClick={exportar}>Exportar progreso</button>
      <button className="chip chip--quiet" onClick={() => selectorArchivo.current?.click()}>
        Importar progreso
      </button>
      <input
        ref={selectorArchivo}
        type="file"
        accept=".json,application/json"
        onChange={importar}
        hidden
      />
      {avisoImportar && <span role="status">{avisoImportar}</span>}
    </div>
  );

  const resumen = useMemo(() => {
    const testsHechos = Object.keys(datos.tests).length;
    const totalAciertos = Object.values(datos.aciertos).reduce((s, n) => s + n, 0);
    const totalFallos = Object.values(datos.fallos).reduce((s, n) => s + n, 0);
    const respondidas = totalAciertos + totalFallos;
    const laminas = Object.values(datos.temario).reduce((s, v) => s + v.length, 0);
    const simulacros = datos.practicas.simulacro;
    const aptos = simulacros.filter((s) => s.fallos <= 3).length;
    return { testsHechos, totalAciertos, respondidas, laminas, simulacros: simulacros.length, aptos };
  }, [datos]);

  const hayAlgo =
    resumen.testsHechos > 0 || resumen.respondidas > 0 || resumen.laminas > 0 || resumen.simulacros > 0;

  function borrar() {
    borrarProgreso();
    setConfirmandoBorrado(false);
    setTick((t) => t + 1);
  }

  if (!hayAlgo) {
    return (
      <>
        <header className="viewhead">
          <a className="back" href="#">← Índice</a>
          <h1>Progreso</h1>
        </header>
        <div className="estado">
          <p>Aún no hay actividad registrada.</p>
          <p>
            El progreso se guarda en este navegador, sin cuentas: corrige un test, haz un
            simulacro o abre un tema del temario y este panel empezará a llenarse. Si
            tienes un progreso exportado de otro navegador, impórtalo aquí.
          </p>
          <a className="chip chip--accent" href="#/simulacro">Empezar simulacro</a>
          {copiaSeguridad}
        </div>
      </>
    );
  }

  return (
    <>
      <header className="viewhead">
        <a className="back" href="#">← Índice</a>
        <h1>Progreso</h1>
      </header>

      <section className="kpis" aria-label="Resumen">
        <div>
          <span className="kpi-label">Tests hechos</span>
          <b>{resumen.testsHechos}</b>
          <span className="kpi-pie">de {nf.format(catalogo.totales.tests)}</span>
        </div>
        <div>
          <span className="kpi-label">Acierto global</span>
          <b>{resumen.respondidas > 0 ? Math.round((resumen.totalAciertos / resumen.respondidas) * 100) : 0}%</b>
          <span className="kpi-pie">de {nf.format(resumen.respondidas)} respondidas</span>
        </div>
        <div>
          <span className="kpi-label">Láminas vistas</span>
          <b>{nf.format(resumen.laminas)}</b>
          <span className="kpi-pie">de {nf.format(catalogo.totales.diapositivas)}</span>
        </div>
        <div>
          <span className="kpi-label">Simulacros aptos</span>
          <b>{resumen.aptos}</b>
          <span className="kpi-pie">de {resumen.simulacros} hechos</span>
        </div>
      </section>

      <section className="section section--tight" aria-labelledby="prg-con">
        <header>
          <h2 id="prg-con">Constancia</h2>
          <p>Preguntas respondidas cada día, últimas 6 semanas.</p>
        </header>
        <Constancia key={tick} />
      </section>

      <section className="section section--tight" aria-labelledby="prg-sim">
        <header>
          <h2 id="prg-sim">Errores por simulacro</h2>
          <p>Por debajo de la línea, apto.</p>
        </header>
        {datos.practicas.simulacro.length === 0 ? (
          <p className="aviso">Todavía no hay simulacros corregidos.</p>
        ) : (
          <GraficoSimulacros intentos={datos.practicas.simulacro} />
        )}
      </section>

      <section className="section section--tight" aria-labelledby="prg-cat">
        <header>
          <h2 id="prg-cat">Tests por categoría</h2>
        </header>
        <div className="viz-metros">
          {catalogo.categorias.map((cat) => {
            const hechos = cat.tests.filter((t) => datos.tests[claveTest(cat.id, t.id)]?.length).length;
            const pct = cat.tests.length > 0 ? hechos / cat.tests.length : 0;
            return (
              <div key={cat.id} className="viz-metro">
                <span className="viz-metro__nombre">{cat.nombre}</span>
                <div
                  className="viz-metro__pista"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={cat.tests.length}
                  aria-valuenow={hechos}
                  aria-label={`${cat.nombre}: ${hechos} de ${cat.tests.length} tests hechos`}
                >
                  <div className="viz-metro__lleno" style={{ width: `${pct * 100}%` }} />
                </div>
                <span className="viz-metro__cifra tnum">
                  {hechos}/{cat.tests.length}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section section--tight" aria-labelledby="prg-mapa">
        <header>
          <h2 id="prg-mapa">Mapa de tests</h2>
          <p>Cada celda, un test — más oscuro, mejor resultado. Pulsa para abrirlo.</p>
        </header>
        <div className="viz-lienzo">
          <div className="viz-mapa">
            {catalogo.categorias.flatMap((cat) =>
              cat.tests.map((t) => {
                const intentos = datos.tests[claveTest(cat.id, t.id)];
                const mejor = intentos ? mejorIntento(intentos) : null;
                const nivel = mejor ? nivelRampa(mejor.aciertos / mejor.total) : null;
                return (
                  <button
                    key={`${cat.id}-${t.id}`}
                    className="viz-celda"
                    style={nivel ? { background: `var(--viz-seq-${nivel})` } : undefined}
                    data-hecho={nivel !== null}
                    aria-label={`${t.nombre}: ${
                      mejor ? `mejor ${mejor.aciertos} de ${mejor.total}, ${intentos!.length} intentos` : "sin hacer"
                    }`}
                    onClick={() => {
                      location.hash = `#/test/${cat.id}/${t.id}`;
                    }}
                    onMouseEnter={(e) => {
                      const celda = e.currentTarget.getBoundingClientRect();
                      const marco = e.currentTarget.parentElement!.getBoundingClientRect();
                      setTooltipMapa({
                        x: ((celda.left - marco.left + celda.width / 2) / marco.width) * 100,
                        y: ((celda.top - marco.top) / marco.height) * 100,
                        lineas: [
                          t.nombre,
                          mejor
                            ? `mejor: ${mejor.aciertos}/${mejor.total} · ${intentos!.length} ${
                                intentos!.length === 1 ? "intento" : "intentos"
                              }`
                            : "sin hacer",
                        ],
                      });
                    }}
                    onMouseLeave={() => setTooltipMapa(null)}
                  />
                );
              })
            )}
            <Tooltip estado={tooltipMapa} />
          </div>
        </div>
        <details className="viz-tabla">
          <summary>Ver como tabla</summary>
          <table className="tnum">
            <thead>
              <tr>
                <th scope="col">Test</th>
                <th scope="col">Intentos</th>
                <th scope="col">Mejor</th>
              </tr>
            </thead>
            <tbody>
              {catalogo.categorias.flatMap((cat) =>
                cat.tests
                  .filter((t) => datos.tests[claveTest(cat.id, t.id)]?.length)
                  .map((t) => {
                    const intentos = datos.tests[claveTest(cat.id, t.id)]!;
                    const mejor = mejorIntento(intentos)!;
                    return (
                      <tr key={`${cat.id}-${t.id}`}>
                        <td>{t.nombre}</td>
                        <td>{intentos.length}</td>
                        <td>
                          {mejor.aciertos}/{mejor.total}
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </details>
      </section>

      <section className="section section--tight" aria-labelledby="prg-tem">
        <header>
          <h2 id="prg-tem">Temario</h2>
        </header>
        <div className="viz-metros viz-metros--dos">
          {catalogo.temas.map((tema) => {
            const vistas = datos.temario[String(tema.numero)]?.length ?? 0;
            const pct = tema.diapositivas > 0 ? vistas / tema.diapositivas : 0;
            return (
              <div key={tema.numero} className="viz-metro">
                <span className="viz-metro__nombre">
                  {String(tema.numero).padStart(2, "0")} · {tema.nombre}
                </span>
                <div
                  className="viz-metro__pista"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={tema.diapositivas}
                  aria-valuenow={vistas}
                  aria-label={`Tema ${tema.numero}: ${vistas} de ${tema.diapositivas} láminas vistas`}
                >
                  <div className="viz-metro__lleno" style={{ width: `${pct * 100}%` }} />
                </div>
                <span className="viz-metro__cifra tnum">
                  {vistas}/{tema.diapositivas}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section section--tight" aria-labelledby="prg-fall">
        <header>
          <h2 id="prg-fall">Preguntas falladas</h2>
        </header>
        {(() => {
          const ranking = rankingFallos();
          const pendientes = ranking.filter((r) => !r.dominada).length;
          const dominadas = ranking.length - pendientes;
          if (ranking.length === 0)
            return <p className="aviso">Sin fallos registrados todavía — cuando corrijas tests, se registrarán aquí.</p>;
          return (
            <div className="acciones">
              <p className="aviso">
                Llevas {pendientes} {pendientes === 1 ? "pendiente" : "pendientes"} y {dominadas}{" "}
                {dominadas === 1 ? "dominada" : "dominadas"}; tienen su propio apartado.
              </p>
              <a className="chip chip--accent" href="#/falladas">Ver preguntas falladas</a>
            </div>
          );
        })()}
      </section>

      <section className="section section--tight" aria-labelledby="prg-copia">
        <header>
          <h2 id="prg-copia">Copia de seguridad</h2>
          <p>
            Descarga tu progreso como archivo, o restáuralo en otro navegador o en la
            copia local de la web.
          </p>
        </header>
        {copiaSeguridad}
      </section>

      <div className="foot" style={{ marginTop: "var(--space-2xl)" }}>
        {confirmandoBorrado ? (
          <span role="alert">
            Se borrará todo el progreso guardado en este navegador.{" "}
            <button className="chip chip--quiet" onClick={borrar}>Borrar definitivamente</button>{" "}
            <button className="chip chip--quiet" onClick={() => setConfirmandoBorrado(false)}>Cancelar</button>
          </span>
        ) : (
          <button className="chip chip--quiet" onClick={() => setConfirmandoBorrado(true)}>
            Borrar progreso
          </button>
        )}
      </div>
    </>
  );
}
