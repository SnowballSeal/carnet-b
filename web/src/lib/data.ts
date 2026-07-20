import catalogo from "../data/catalogo.json";

export { catalogo };

export interface FuentePregunta {
  cat: number;
  test: number;
  num: number;
}

export interface Pregunta {
  /** Enunciado */
  t: string;
  /** Textos de las opciones */
  o: string[];
  /** Letras de las opciones (A, B, C…) */
  l: string[];
  /** Índice de la opción correcta dentro de `o` */
  c: number;
  /** Texto de ayuda */
  a: string | null;
  /** Ruta de la imagen ilustrativa, si la hay */
  img: string | null;
  /** Origen de la pregunta (para el registro de fallos) */
  src?: FuentePregunta;
}

export const clavePregunta = (src: FuentePregunta) => `${src.cat}/${src.test}/${src.num}`;

interface TestJson {
  nombre: string;
  preguntas: {
    numero: number;
    enunciado: string;
    /** Ruta relativa a la carpeta de la categoría, p. ej. "examen-01_images/3.png" */
    imagen: string | null;
    opciones: { letra: string; texto: string }[];
    ayuda: string | null;
    respuesta_correcta: string;
  }[];
}

export async function cargarTest(cat: number, id: number): Promise<{ nombre: string; preguntas: Pregunta[] }> {
  const categoria = catalogo.categorias.find((c) => c.id === cat);
  const test = categoria?.tests.find((t) => t.id === id);
  if (!categoria || !test) throw new Error(`No existe el test ${cat}/${id} en el catálogo.`);
  const res = await fetch(`data/tests/${categoria.carpeta}/${test.archivo}.json`);
  if (!res.ok) throw new Error(`El servidor respondió ${res.status} al pedir «${test.nombre}».`);
  const data: TestJson = await res.json();
  return {
    nombre: data.nombre,
    preguntas: data.preguntas.map((p) => ({
      t: p.enunciado,
      o: p.opciones.map((op) => op.texto),
      l: p.opciones.map((op) => op.letra),
      c: p.opciones.findIndex((op) => op.letra === p.respuesta_correcta),
      a: p.ayuda,
      img: p.imagen ? `data/tests/${categoria.carpeta}/${p.imagen}` : null,
      src: { cat, test: id, num: p.numero },
    })),
  };
}

let bancoCache: Pregunta[] | null = null;

export async function cargarBanco(): Promise<Pregunta[]> {
  if (bancoCache) return bancoCache;
  const res = await fetch("banco.json");
  if (!res.ok) throw new Error(`El servidor respondió ${res.status} al pedir el banco de preguntas.`);
  bancoCache = (await res.json()) as Pregunta[];
  return bancoCache;
}

export function barajar<T>(items: T[]): T[] {
  const copia = [...items];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export function muestraAleatoria(banco: Pregunta[], n: number): Pregunta[] {
  return barajar(banco).slice(0, n);
}

/**
 * Baraja el orden de las opciones de una pregunta (las letras A/B/C son
 * etiquetas de posición y no cambian). Evita memorizar "la correcta era la B".
 */
export function barajarOpciones(p: Pregunta): Pregunta {
  const orden = barajar(p.o.map((_, i) => i));
  return { ...p, o: orden.map((i) => p.o[i]), c: orden.indexOf(p.c) };
}

/** Minúsculas y sin tildes, para comparar texto tecleado con el del dataset. */
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Calienta la caché del navegador con las imágenes indicadas, en orden. */
export function precargarImagenes(urls: (string | null)[], concurrencia = 3): void {
  const cola = urls.filter((u): u is string => u !== null);
  let siguiente = 0;
  const lanzar = () => {
    if (siguiente >= cola.length) return;
    const img = new Image();
    const avanzar = () => lanzar();
    img.onload = avanzar;
    img.onerror = avanzar;
    img.src = cola[siguiente++];
  };
  for (let i = 0; i < concurrencia; i++) lanzar();
}

export interface Epigrafe {
  n: number;
  tipo: "imagen" | "video";
  titulo: string | null;
  texto: string | null;
  /** Título del vídeo de YouTube embebido (solo tipo "video") */
  video_titulo?: string | null;
  /** Enlace al vídeo de YouTube (solo tipo "video"; si falta, queda el póster) */
  video_url?: string;
}

const epigrafesCache = new Map<number, Epigrafe[] | null>();

/** Texto de los epígrafes de un tema; null si no está disponible. */
export async function cargarEpigrafes(tema: number): Promise<Epigrafe[] | null> {
  if (epigrafesCache.has(tema)) return epigrafesCache.get(tema)!;
  try {
    const res = await fetch(`data/temario/${tema}/epigrafes.json`);
    const valor = res.ok ? ((await res.json()) as Epigrafe[]) : null;
    epigrafesCache.set(tema, valor);
    return valor;
  } catch {
    epigrafesCache.set(tema, null);
    return null;
  }
}
