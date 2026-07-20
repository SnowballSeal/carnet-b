import { useEffect, useState } from "react";
import Rail from "./components/Rail";
import Indice from "./components/Indice";
import TemarioViewer from "./components/TemarioViewer";
import TestRunner from "./components/TestRunner";
import Progreso from "./components/Progreso";
import Falladas from "./components/Falladas";
import Buscador, { precalentarIndice } from "./components/Buscador";

export type Ruta =
  | { vista: "indice" }
  | { vista: "tema"; numero: number; lamina?: number }
  | { vista: "test"; cat: number; id: number; estudio: boolean }
  | { vista: "simulacro" }
  | { vista: "aleatorio"; n: number; estudio: boolean; soloCat: number | null }
  | { vista: "falladas"; n: number; estudio: boolean }
  | { vista: "falladasLista" }
  | { vista: "buscar" }
  | { vista: "progreso" };

/**
 * Rutas con hash `#/…`; los anclajes normales (`#tests`) siguen siendo del
 * navegador. Tras `?` van las opciones (`#/aleatorio/10?modo=estudio&cat=2`).
 */
function parseHash(): Ruta {
  const h = location.hash;
  if (!h.startsWith("#/")) return { vista: "indice" };
  const [camino, consulta] = h.slice(2).split("?");
  const partes = camino.split("/");
  const opciones = new URLSearchParams(consulta);
  const estudio = opciones.get("modo") === "estudio";
  if (partes[0] === "tema" && Number(partes[1]) >= 1)
    return {
      vista: "tema",
      numero: Number(partes[1]),
      ...(Number(partes[2]) >= 1 ? { lamina: Number(partes[2]) } : {}),
    };
  if (partes[0] === "test" && partes.length === 3)
    return { vista: "test", cat: Number(partes[1]), id: Number(partes[2]), estudio };
  if (partes[0] === "simulacro") return { vista: "simulacro" };
  if (partes[0] === "aleatorio")
    return {
      vista: "aleatorio",
      n: Number(partes[1]) || 10,
      estudio,
      soloCat: Number(opciones.get("cat")) >= 1 ? Number(opciones.get("cat")) : null,
    };
  if (partes[0] === "falladas")
    return partes.length > 1 ? { vista: "falladas", n: Number(partes[1]) || 10, estudio } : { vista: "falladasLista" };
  if (partes[0] === "buscar") return { vista: "buscar" };
  if (partes[0] === "progreso") return { vista: "progreso" };
  return { vista: "indice" };
}

export default function App() {
  const [ruta, setRuta] = useState<Ruta>(parseHash);

  useEffect(() => {
    const onHash = () => {
      const r = parseHash();
      setRuta(r);
      if (r.vista !== "indice" || !location.hash.startsWith("#")) window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Precalienta el índice de búsqueda en un rato libre, para que abrir
  // Buscar sea instantáneo (si falla por red, Buscar reintenta al abrirse).
  useEffect(() => {
    const calentar = () => void precalentarIndice().catch(() => {});
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(calentar, { timeout: 4000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(calentar, 2500);
    return () => clearTimeout(id);
  }, []);

  return (
    <>
      <Rail />
      <main className="page">
        {ruta.vista === "indice" && <Indice />}
        {ruta.vista === "tema" && (
          <TemarioViewer numero={ruta.numero} laminaInicial={ruta.lamina} key={`${ruta.numero}-${ruta.lamina ?? 0}`} />
        )}
        {ruta.vista === "test" && <TestRunner fuente={ruta} key={`t-${ruta.cat}-${ruta.id}-${ruta.estudio}`} />}
        {ruta.vista === "simulacro" && <TestRunner fuente={ruta} key="simulacro" />}
        {ruta.vista === "aleatorio" && (
          <TestRunner fuente={ruta} key={`a-${ruta.n}-${ruta.estudio}-${ruta.soloCat ?? 0}`} />
        )}
        {ruta.vista === "falladas" && <TestRunner fuente={ruta} key={`f-${ruta.n}-${ruta.estudio}`} />}
        {ruta.vista === "falladasLista" && <Falladas />}
        {ruta.vista === "buscar" && <Buscador />}
        {ruta.vista === "progreso" && <Progreso />}
      </main>
    </>
  );
}
