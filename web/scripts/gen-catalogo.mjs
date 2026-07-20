/**
 * Genera los dos artefactos de datos de la web a partir del dataset:
 *
 * - src/data/catalogo.json — índice ligero (categorías → tests, temas del
 *   temario con nº de diapositivas, totales reales). Se importa estático.
 * - public/banco.json — banco completo de preguntas (enunciado, opciones,
 *   correcta, ayuda, imagen) para simulacro y examen aleatorio. Se descarga
 *   bajo demanda al empezar una práctica.
 * - public/precache-manifest.json — lista de todas las rutas del dataset
 *   (JSON + imágenes de tests y temario), para que el service worker pueda
 *   precargarlas sin depender de que el alumno haya visitado cada una.
 *
 * Ejecutar tras cualquier cambio del dataset: `npm run gen`
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const DATASET = resolve(REPO, "dataset");
const TESTS = resolve(DATASET, "tests");
const TEMARIO = resolve(DATASET, "temario");
const CATALOGO_FUENTE = resolve(DATASET, "catalogo.json");

const NOMBRES_TEMAS = [
  "Definiciones y documentación",
  "Señalización de la vía",
  "Señales verticales I. Advertencia de peligro y reglamentación",
  "Señales verticales II. Señales de indicación",
  "Marcas viales",
  "Alumbrado y señalización óptica de los vehículos",
  "Uso de las vías públicas",
  "Velocidad y distancia entre vehículos",
  "Maniobras I. Incorporación al tráfico y adelantamientos",
  "Maniobras II. Cambios de dirección, de sentido y marcha atrás",
  "Maniobras III. Inmovilizaciones",
  "Prioridad de paso",
  "Transporte de personas y mercancías. Señalización de los vehículos",
  "Conocimiento y mantenimiento del automóvil I",
  "Conocimiento y mantenimiento del automóvil II",
  "Estado psicofísico del conductor",
  "La conducción. Situaciones de riesgo",
  "Viajes, civismo vial y accidentes de circulación",
];

const fuente = JSON.parse(readFileSync(CATALOGO_FUENTE, "utf-8"));

const categorias = [];
const banco = [];
const manifiesto = new Set(["banco.json"]);
let totalPreguntas = 0;

for (const cat of fuente.categorias) {
  const tests = [];
  for (const test of cat.tests) {
    const jsonPath = resolve(TESTS, cat.carpeta, `${test.archivo}.json`);
    if (!existsSync(jsonPath)) {
      console.warn(`AVISO: falta ${jsonPath} — se omite del catálogo`);
      continue;
    }
    const data = JSON.parse(readFileSync(jsonPath, "utf-8"));
    tests.push({ id: test.id, nombre: test.nombre, archivo: test.archivo, preguntas: data.preguntas.length });
    totalPreguntas += data.preguntas.length;
    manifiesto.add(`data/tests/${cat.carpeta}/${test.archivo}.json`);

    for (const p of data.preguntas) {
      banco.push({
        t: p.enunciado,
        o: p.opciones.map((op) => op.texto),
        l: p.opciones.map((op) => op.letra),
        c: p.opciones.findIndex((op) => op.letra === p.respuesta_correcta),
        a: p.ayuda ?? null,
        img: p.imagen ? `data/tests/${cat.carpeta}/${p.imagen}` : null,
        src: { cat: cat.id, test: test.id, num: p.numero },
      });
      if (p.imagen) manifiesto.add(`data/tests/${cat.carpeta}/${p.imagen}`);
    }
  }
  categorias.push({ id: cat.id, nombre: cat.nombre, carpeta: cat.carpeta, tests });
}

const temas = NOMBRES_TEMAS.map((nombre, i) => {
  const n = i + 1;
  const dir = resolve(TEMARIO, String(n));
  // Nº de epígrafes del tema: los vídeos con enlace no tienen imagen, así que
  // la cuenta sale de epigrafes.json (las láminas solo como reserva si falta).
  const epigrafesPath = resolve(dir, "epigrafes.json");
  let diapositivas = 0;
  if (existsSync(epigrafesPath)) {
    const epigrafes = JSON.parse(readFileSync(epigrafesPath, "utf-8"));
    diapositivas = epigrafes.length;
    manifiesto.add(`data/temario/${n}/epigrafes.json`);
    for (const e of epigrafes) {
      if (e.tipo !== "video") manifiesto.add(`data/temario/${n}/${String(e.n).padStart(3, "0")}.webp`);
    }
  } else if (existsSync(dir)) {
    diapositivas = readdirSync(dir).filter((f) => f.endsWith(".webp")).length;
  }
  return { numero: n, nombre, diapositivas };
});

const catalogo = {
  categorias,
  temas,
  totales: {
    tests: categorias.reduce((s, c) => s + c.tests.length, 0),
    preguntas: totalPreguntas,
    temas: temas.length,
    diapositivas: temas.reduce((s, t) => s + t.diapositivas, 0),
  },
};

mkdirSync(resolve(HERE, "../src/data"), { recursive: true });
mkdirSync(resolve(HERE, "../public"), { recursive: true });
writeFileSync(resolve(HERE, "../src/data/catalogo.json"), JSON.stringify(catalogo, null, 2), "utf-8");
writeFileSync(resolve(HERE, "../public/banco.json"), JSON.stringify(banco), "utf-8");
writeFileSync(
  resolve(HERE, "../public/precache-manifest.json"),
  JSON.stringify([...manifiesto].sort()),
  "utf-8"
);

console.log(
  `catalogo.json: ${catalogo.totales.tests} tests, ${catalogo.totales.preguntas} preguntas, ` +
    `${catalogo.totales.temas} temas, ${catalogo.totales.diapositivas} diapositivas`
);
console.log(`banco.json: ${banco.length} preguntas`);
console.log(`precache-manifest.json: ${manifiesto.size} rutas`);
