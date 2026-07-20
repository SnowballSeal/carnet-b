/**
 * Tema claro/oscuro. Sin preferencia guardada manda el sistema
 * (prefers-color-scheme); el conmutador fija la elección en localStorage y la
 * aplica con `data-tema` en <html> (ver tokens.css). Al arrancar, un script
 * en index.html aplica la preferencia guardada antes de pintar.
 */
const CLAVE = "carnetb.tema";

export type Tema = "claro" | "oscuro";

function preferido(): Tema | null {
  try {
    const valor = localStorage.getItem(CLAVE);
    return valor === "claro" || valor === "oscuro" ? valor : null;
  } catch {
    return null;
  }
}

export function temaActual(): Tema {
  return preferido() ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro");
}

export function alternarTema(): Tema {
  const nuevo: Tema = temaActual() === "oscuro" ? "claro" : "oscuro";
  document.documentElement.dataset.tema = nuevo;
  try {
    localStorage.setItem(CLAVE, nuevo);
  } catch {
    // Sin almacenamiento: el cambio vale solo para esta sesión.
  }
  return nuevo;
}
