import { defineConfig, type Plugin, type Connect } from "vite";
import react from "@vitejs/plugin-react";
import { createReadStream, existsSync, statSync } from "node:fs";
import { resolve, normalize, sep } from "node:path";
import { copiaLocalMiddleware } from "./scripts/copia-local";

/**
 * El dataset (~200 MB de imágenes + JSON) vive en la carpeta hermana
 * ../dataset (tests/ + temario/). Copiarlo dentro de la web lo duplicaría
 * en disco, así que se sirve por referencia con este middleware, tanto en
 * `vite dev` como en `vite preview`.
 */
const DATASET_ROOTS: Record<string, string> = {
  "/data/": resolve(__dirname, "../dataset"),
};

const MIME: Record<string, string> = {
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
};

function datasetMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = decodeURIComponent((req.url ?? "").split("?")[0]);
    for (const [prefix, root] of Object.entries(DATASET_ROOTS)) {
      if (!url.startsWith(prefix)) continue;
      const filePath = normalize(resolve(root, url.slice(prefix.length)));
      // Nunca servir nada fuera de la carpeta del dataset (path traversal).
      if (!filePath.startsWith(root + sep)) break;
      const ext = filePath.slice(filePath.lastIndexOf("."));
      if (!(ext in MIME) || !existsSync(filePath) || !statSync(filePath).isFile()) break;
      res.setHeader("Content-Type", MIME[ext]);
      res.setHeader("Cache-Control", "max-age=3600");
      createReadStream(filePath).pipe(res);
      return;
    }
    next();
  };
}

function datasetPlugin(): Plugin {
  return {
    name: "serve-dataset",
    configureServer(server) {
      server.middlewares.use(datasetMiddleware());
      server.middlewares.use(copiaLocalMiddleware(resolve(__dirname, "..")));
    },
    configurePreviewServer(server) {
      server.middlewares.use(datasetMiddleware());
      server.middlewares.use(copiaLocalMiddleware(resolve(__dirname, "..")));
    },
  };
}

export default defineConfig({
  // Rutas relativas: la web funciona igual en la raíz (dev, copia local) que
  // bajo una subruta (GitHub Pages sirve en /nombre-del-repo/).
  base: "./",
  plugins: [react(), datasetPlugin()],
});
