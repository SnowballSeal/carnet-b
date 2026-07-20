import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// La web compilada funciona sin conexión: el service worker cachea lo que se
// va usando. En desarrollo no se registra (interferiría con el servidor de Vite).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((registro) => {
        // Precarga de todo el dataset (temario + tests) en un rato libre del
        // navegador, para no competir por red/CPU con la carga de la página.
        const avisar = () => registro.active?.postMessage({ tipo: "precargar-dataset" });
        if ("requestIdleCallback" in window) requestIdleCallback(avisar, { timeout: 10000 });
        else setTimeout(avisar, 5000);
      })
      .catch(() => {
        // Sin contexto seguro (http por red local): la web funciona igual, con red.
      });
  });
}
