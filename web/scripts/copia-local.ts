/**
 * Copia local descargable: un ZIP con la web compilada (dist/) y el dataset
 * completo, listo para usar sin este servidor. Se genera y se envía en
 * streaming al pedir /descargar/carnet-b-local.zip — sin dependencias: el ZIP
 * se escribe a mano en modo "almacenado" (las imágenes PNG ya van comprimidas,
 * volver a comprimirlas no aporta nada).
 *
 * El navegador no puede leer el dataset desde file://, así que la copia
 * incluye su propio servidor (servidor.py, solo biblioteca estándar) con dos
 * arrancadores que instalan Python si falta: "Iniciar web.bat" (Windows,
 * winget) e "iniciar-web.sh" (Linux/macOS/Android-Termux, gestor del
 * sistema). El servidor de la copia también regenera y ofrece este mismo ZIP,
 * de modo que cualquier copia puede compartirse a su vez. LEEME.txt explica
 * el uso y cómo llevar el progreso (exportar/importar en #/progreso).
 * Los cuatro archivos viven en copia-local-recursos/.
 */
import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Connect } from "vite";

interface Entrada {
  /** Ruta dentro del ZIP, con "/" */
  nombre: string;
  /** Archivo en disco o contenido literal */
  origen: string | Buffer;
  tamano: number;
}

function listarArchivos(raiz: string, prefijo: string): Entrada[] {
  const salida: Entrada[] = [];
  const recorrer = (dir: string, rel: string) => {
    for (const nombre of readdirSync(dir).sort()) {
      const ruta = join(dir, nombre);
      const info = statSync(ruta);
      const relHijo = rel ? `${rel}/${nombre}` : nombre;
      if (info.isDirectory()) recorrer(ruta, relHijo);
      else salida.push({ nombre: `${prefijo}${relHijo}`, origen: ruta, tamano: info.size });
    }
  };
  recorrer(raiz, "");
  return salida;
}

/* ---------- Escritura ZIP (método "almacenado", sin compresión) ---------- */

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

function crc32(datos: Buffer, previo = 0xffffffff): number {
  let c = previo;
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8);
  return c;
}

function fechaDos(fecha: Date): { hora: number; dia: number } {
  return {
    hora: (fecha.getHours() << 11) | (fecha.getMinutes() << 5) | (fecha.getSeconds() >> 1),
    dia: (((fecha.getFullYear() - 1980) & 0x7f) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate(),
  };
}

function cabeceraLocal(e: Entrada, crc: number, { hora, dia }: ReturnType<typeof fechaDos>): Buffer {
  const nombre = Buffer.from(e.nombre, "utf-8");
  const b = Buffer.alloc(30 + nombre.length);
  b.writeUInt32LE(0x04034b50, 0);
  b.writeUInt16LE(20, 4); // versión necesaria
  b.writeUInt16LE(0x0800, 6); // nombres en UTF-8
  b.writeUInt16LE(0, 8); // método: almacenado
  b.writeUInt16LE(hora, 10);
  b.writeUInt16LE(dia, 12);
  b.writeUInt32LE(crc >>> 0, 14);
  b.writeUInt32LE(e.tamano, 18);
  b.writeUInt32LE(e.tamano, 22);
  b.writeUInt16LE(nombre.length, 26);
  b.writeUInt16LE(0, 28);
  nombre.copy(b, 30);
  return b;
}

function entradaCentral(
  e: Entrada,
  crc: number,
  desplazamiento: number,
  { hora, dia }: ReturnType<typeof fechaDos>
): Buffer {
  const nombre = Buffer.from(e.nombre, "utf-8");
  const b = Buffer.alloc(46 + nombre.length);
  b.writeUInt32LE(0x02014b50, 0);
  b.writeUInt16LE(20, 4);
  b.writeUInt16LE(20, 6);
  b.writeUInt16LE(0x0800, 8);
  b.writeUInt16LE(0, 10);
  b.writeUInt16LE(hora, 12);
  b.writeUInt16LE(dia, 14);
  b.writeUInt32LE(crc >>> 0, 16);
  b.writeUInt32LE(e.tamano, 20);
  b.writeUInt32LE(e.tamano, 24);
  b.writeUInt16LE(nombre.length, 28);
  b.writeUInt32LE(desplazamiento, 42);
  nombre.copy(b, 46);
  return b;
}

function finCentral(nEntradas: number, tamanoCentral: number, inicioCentral: number): Buffer {
  const b = Buffer.alloc(22);
  b.writeUInt32LE(0x06054b50, 0);
  b.writeUInt16LE(nEntradas, 8);
  b.writeUInt16LE(nEntradas, 10);
  b.writeUInt32LE(tamanoCentral, 12);
  b.writeUInt32LE(inicioCentral, 16);
  return b;
}

/* ---------- Middleware ---------- */

export function copiaLocalMiddleware(raizRepo: string): Connect.NextHandleFunction {
  const DIST = resolve(raizRepo, "web/dist");
  const DATASET = resolve(raizRepo, "dataset");
  const RECURSOS = resolve(raizRepo, "web/scripts/copia-local-recursos");

  return (req, res, next) => {
    const url = (req.url ?? "").split("?")[0];

    // Sonda que usa la web para mostrar el botón solo donde tiene sentido.
    if (url === "/descargar/disponible") {
      res.statusCode = existsSync(join(DIST, "index.html")) ? 204 : 503;
      res.end();
      return;
    }

    if (url !== "/descargar/carnet-b-local.zip") {
      next();
      return;
    }
    if (!existsSync(join(DIST, "index.html"))) {
      res.statusCode = 503;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("La copia local necesita la web compilada: ejecuta antes `npm run build` en web/.");
      return;
    }

    const recurso = (nombre: string): Entrada => {
      const contenido = readFileSync(join(RECURSOS, nombre));
      return { nombre, origen: contenido, tamano: contenido.length };
    };
    const entradas: Entrada[] = [
      ...listarArchivos(DIST, ""),
      ...listarArchivos(join(DATASET, "tests"), "data/tests/"),
      ...listarArchivos(join(DATASET, "temario"), "data/temario/"),
      recurso("servidor.py"),
      recurso("Iniciar web.bat"),
      recurso("iniciar-web.sh"),
      recurso("LEEME.txt"),
    ];
    const marca = fechaDos(new Date());

    // Tamaño total exacto, para que el navegador muestre el avance real.
    const bytesNombres = entradas.reduce((s, e) => s + Buffer.byteLength(e.nombre, "utf-8"), 0);
    const total =
      entradas.reduce((s, e) => s + e.tamano, 0) + bytesNombres * 2 + entradas.length * (30 + 46) + 22;

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Length", total);
    res.setHeader("Content-Disposition", 'attachment; filename="carnet-b-local.zip"');

    const escribir = (b: Buffer) =>
      new Promise<void>((listo, fallo) => {
        if (res.write(b)) listo();
        else {
          res.once("drain", listo);
          res.once("error", fallo);
        }
      });

    (async () => {
      const central: Buffer[] = [];
      let desplazamiento = 0;
      for (const e of entradas) {
        let crc = 0xffffffff;
        const trozos: Buffer[] = [];
        if (Buffer.isBuffer(e.origen)) {
          crc = crc32(e.origen);
          trozos.push(e.origen);
        } else {
          await new Promise<void>((listo, fallo) => {
            createReadStream(e.origen as string)
              .on("data", (trozo) => {
                const b = trozo as Buffer;
                crc = crc32(b, crc);
                trozos.push(b);
              })
              .on("end", listo)
              .on("error", fallo);
          });
        }
        crc = (crc ^ 0xffffffff) >>> 0;
        const cabecera = cabeceraLocal(e, crc, marca);
        await escribir(cabecera);
        for (const t of trozos) await escribir(t);
        central.push(entradaCentral(e, crc, desplazamiento, marca));
        desplazamiento += cabecera.length + e.tamano;
      }
      const tamanoCentral = central.reduce((s, b) => s + b.length, 0);
      for (const b of central) await escribir(b);
      await escribir(finCentral(entradas.length, tamanoCentral, desplazamiento));
      res.end();
    })().catch(() => {
      // Descarga cancelada o error de lectura: cortar la respuesta a medias
      // es la única señal de error posible una vez enviadas las cabeceras.
      res.destroy();
    });
  };
}
