/**
 * Registro anónimo de progreso en localStorage. Sin cuentas: todo vive en el
 * navegador del alumno. Si localStorage no está disponible (modo privado con
 * bloqueo, cuota llena), la web funciona igual pero sin memoria.
 */
import { clavePregunta, type FuentePregunta } from "./data";

export interface Intento {
  /** ISO 8601 */
  fecha: string;
  aciertos: number;
  fallos: number;
  blanco: number;
  total: number;
  /** Solo simulacro */
  segundos?: number;
}

export type TipoPractica = "simulacro" | "aleatorio" | "falladas";

interface Almacen {
  v: 2;
  /** "cat/id" → intentos, el más reciente al final */
  tests: Record<string, Intento[]>;
  practicas: Record<TipoPractica, Intento[]>;
  /** tema → números de lámina ya vistos */
  temario: Record<string, number[]>;
  /** "cat/test/num" → nº de veces fallada */
  fallos: Record<string, number>;
  /** "cat/test/num" → nº de veces acertada */
  aciertos: Record<string, number>;
  /** "cat/test/num" → aciertos seguidos desde el último fallo (solo falladas) */
  rachas: Record<string, number>;
}

const CLAVE = "carnetb.progreso.v1";

/** Aciertos seguidos tras el último fallo con los que una pregunta se da por dominada. */
export const RACHA_DOMINADA = 2;

const VACIO: Almacen = {
  v: 2,
  tests: {},
  practicas: { simulacro: [], aleatorio: [], falladas: [] },
  temario: {},
  fallos: {},
  aciertos: {},
  rachas: {},
};

function leerAlmacen(): Almacen {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return structuredClone(VACIO);
    const datos = JSON.parse(crudo) as { v?: number };
    if (datos.v !== 2) return structuredClone(VACIO);
    const almacen = datos as Almacen;
    // Progresos guardados antes de existir las rachas.
    almacen.rachas ??= {};
    return almacen;
  } catch {
    return structuredClone(VACIO);
  }
}

function escribirAlmacen(datos: Almacen): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
  } catch {
    // Sin almacenamiento disponible: la sesión sigue sin registro.
  }
}

export const claveTest = (cat: number, id: number) => `${cat}/${id}`;

export interface ResultadoPregunta {
  src: FuentePregunta;
  acertada: boolean;
}

/** Guarda un intento corregido y actualiza el contador por pregunta. */
export function guardarIntento(
  destino: { tipo: "test"; cat: number; id: number } | { tipo: TipoPractica },
  intento: Intento,
  porPregunta: ResultadoPregunta[]
): void {
  const datos = leerAlmacen();
  if (destino.tipo === "test") {
    const clave = claveTest(destino.cat, destino.id);
    (datos.tests[clave] ??= []).push(intento);
  } else {
    datos.practicas[destino.tipo].push(intento);
  }
  for (const r of porPregunta) {
    const clave = clavePregunta(r.src);
    if (r.acertada) {
      datos.aciertos[clave] = (datos.aciertos[clave] ?? 0) + 1;
      // La racha solo interesa en preguntas falladas alguna vez: al llegar a
      // RACHA_DOMINADA la pregunta se retira del repaso de falladas.
      if (datos.fallos[clave]) datos.rachas[clave] = (datos.rachas[clave] ?? 0) + 1;
    } else {
      datos.fallos[clave] = (datos.fallos[clave] ?? 0) + 1;
      datos.rachas[clave] = 0;
    }
  }
  escribirAlmacen(datos);
}

export function marcarLaminaVista(tema: number, lamina: number): void {
  const datos = leerAlmacen();
  const vistas = (datos.temario[String(tema)] ??= []);
  if (!vistas.includes(lamina)) {
    vistas.push(lamina);
    escribirAlmacen(datos);
  }
}

export function progreso(): Almacen {
  return leerAlmacen();
}

export function laminasVistas(tema: number): number {
  return leerAlmacen().temario[String(tema)]?.length ?? 0;
}

export function mejorIntento(intentos: Intento[]): Intento | null {
  if (intentos.length === 0) return null;
  return intentos.reduce((mejor, i) => (i.aciertos > mejor.aciertos ? i : mejor));
}

export interface FalloRegistrado {
  clave: string;
  fallos: number;
  aciertos: number;
  /** true cuando lleva RACHA_DOMINADA aciertos seguidos desde el último fallo */
  dominada: boolean;
}

/** Claves de pregunta ordenadas de más a menos fallada (solo las falladas alguna vez). */
export function rankingFallos(): FalloRegistrado[] {
  const datos = leerAlmacen();
  return Object.entries(datos.fallos)
    .map(([clave, fallos]) => ({
      clave,
      fallos,
      aciertos: datos.aciertos[clave] ?? 0,
      dominada: (datos.rachas[clave] ?? 0) >= RACHA_DOMINADA,
    }))
    .sort((a, b) => b.fallos - a.fallos || a.aciertos - b.aciertos);
}

/** Preguntas falladas aún sin dominar: las que entran en el repaso de falladas. */
export function fallosPendientes(): FalloRegistrado[] {
  return rankingFallos().filter((r) => !r.dominada);
}

/** Nº de veces fallada/acertada de cada pregunta, para consultarlo sin releer el almacén. */
export function historialPorPregunta(): { fallos: Record<string, number>; aciertos: Record<string, number> } {
  const datos = leerAlmacen();
  return { fallos: { ...datos.fallos }, aciertos: { ...datos.aciertos } };
}

/** Clave "aaaa-mm-dd" de una fecha, en hora local. */
export const claveDia = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const diaLocal = (iso: string) => claveDia(new Date(iso));

/** Preguntas respondidas por día natural (clave "aaaa-mm-dd"), a partir de los intentos. */
export function actividadDiaria(): Map<string, number> {
  const datos = leerAlmacen();
  const todos = [...Object.values(datos.tests).flat(), ...Object.values(datos.practicas).flat()];
  const porDia = new Map<string, number>();
  for (const intento of todos) {
    const dia = diaLocal(intento.fecha);
    porDia.set(dia, (porDia.get(dia) ?? 0) + intento.aciertos + intento.fallos);
  }
  return porDia;
}

/** Días seguidos con actividad terminando hoy (o ayer, si hoy aún no se ha estudiado). */
export function rachaDias(porDia: Map<string, number>): number {
  const dia = new Date();
  if (!porDia.has(claveDia(dia))) dia.setDate(dia.getDate() - 1); // hoy aún sin estudiar no rompe la racha
  let racha = 0;
  while (porDia.has(claveDia(dia))) {
    racha += 1;
    dia.setDate(dia.getDate() - 1);
  }
  return racha;
}

export function borrarProgreso(): void {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento: no hay nada que borrar.
  }
}

/** Todo el progreso como JSON, para llevarlo a otro navegador o copia local. */
export function exportarProgreso(): string {
  return JSON.stringify(leerAlmacen(), null, 2);
}

/**
 * Restaura un progreso exportado. Sustituye el actual.
 * Lanza un error con mensaje legible si el archivo no es un progreso válido.
 */
export function importarProgreso(texto: string): void {
  let datos: { v?: number };
  try {
    datos = JSON.parse(texto) as { v?: number };
  } catch {
    throw new Error("El archivo no es un JSON válido.");
  }
  if (datos.v !== 2) {
    throw new Error("El archivo no parece un progreso exportado de esta web.");
  }
  escribirAlmacen(datos as Almacen);
}
