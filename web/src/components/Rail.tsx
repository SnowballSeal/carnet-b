import { useState } from "react";
import { alternarTema, temaActual } from "../lib/tema";

const enlaces = [
  { href: "#temario", texto: "Temario" },
  { href: "#tests", texto: "Tests" },
  { href: "#practica", texto: "Práctica" },
  { href: "#/buscar", texto: "Buscar" },
  { href: "#/progreso", texto: "Progreso" },
];

/** Navega al índice y desplaza hasta la sección una vez pintada. */
function irASeccion(e: React.MouseEvent, href: string) {
  if (href.startsWith("#/")) return; // ruta propia: el hash router se encarga
  e.preventDefault();
  if (location.hash.startsWith("#/")) location.hash = "";
  requestAnimationFrame(() => {
    document.querySelector(href)?.scrollIntoView({ behavior: "auto", block: "start" });
  });
}

/* Iconos propios en SVG (currentColor): un glifo unicode puede faltar o salir
   como emoji de color según la fuente del sistema. */
const IconoSol = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <circle cx="10" cy="10" r="4" />
    <path d="M10 1v2.5M10 16.5V19M1 10h2.5M16.5 10H19M3.6 3.6l1.8 1.8M14.6 14.6l1.8 1.8M16.4 3.6l-1.8 1.8M5.4 14.6l-1.8 1.8" />
  </svg>
);

const IconoLuna = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M16.5 12.5A7 7 0 0 1 7.5 3.5a7 7 0 1 0 9 9Z" />
  </svg>
);

function BotonTema({ className }: { className: string }) {
  const [tema, setTema] = useState(temaActual);
  return (
    <button
      className={className}
      onClick={() => setTema(alternarTema())}
      aria-label={tema === "oscuro" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      title={tema === "oscuro" ? "Tema claro" : "Tema oscuro"}
    >
      {tema === "oscuro" ? <IconoSol /> : <IconoLuna />}
    </button>
  );
}

export default function Rail() {
  return (
    <>
      <nav className="rail" aria-label="Secciones">
        <a className="rail__wordmark" href="#" onClick={(e) => { e.preventDefault(); location.hash = ""; window.scrollTo(0, 0); }}>
          Carnet B
        </a>
        <ul className="rail__links">
          {enlaces.map((l) => (
            <li key={l.href}>
              <a className="rail__link" href={l.href} onClick={(e) => irASeccion(e, l.href)}>
                {l.texto}
              </a>
            </li>
          ))}
        </ul>
        <BotonTema className="rail__tema" />
      </nav>
      <nav className="topbar" aria-label="Secciones">
        <a className="topbar__wordmark" href="#" onClick={(e) => { e.preventDefault(); location.hash = ""; window.scrollTo(0, 0); }}>
          Carnet B
        </a>
        {enlaces.map((l) => (
          <a key={l.href} className="topbar__link" href={l.href} onClick={(e) => irASeccion(e, l.href)}>
            {l.texto}
          </a>
        ))}
        <BotonTema className="topbar__tema" />
      </nav>
    </>
  );
}
