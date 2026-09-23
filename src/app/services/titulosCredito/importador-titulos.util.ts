// Importador de títulos de crédito: lectura de tablas (Excel/CSV ya
// convertidos a filas), detección de formato por encabezados, validación y
// plan de carga con las reglas de duplicados. Funciones puras (sin Angular ni
// Firestore) para probarlas con los archivos reales.

import { normalizarNombre } from '../coactivados/coactivados.util';
import { EstadoEntrega, esRucValido, normalizarRuc } from './titulos-credito.util';

export type Celda = string | number | Date | null | undefined;

export interface TablaHoja {
  nombre: string;
  filas: Celda[][];
}

export type Campo =
  | 'numero' | 'ruc' | 'razon' | 'capital' | 'estadoIess' | 'guia' | 'guiaCoactiva'
  | 'fechaSorteo' | 'fechaEntrega' | 'fechaEmision' | 'juez' | 'abogado'
  // Solo presentes en la matriz de llamadas (entregados y no entregados):
  // se usan nada más para migrar la gestión histórica en la carga inicial.
  | 'observacion' | 'observacionGeneral' | 'personaLlama' | 'fechaLlamada'
  // Datos de contacto del coactivado: la matriz sí los trae, pero son del
  // coactivado (RUC), no del título — se usan para completar su ficha.
  | 'representanteLegal' | 'telefono' | 'correo';

export interface FormatoDetectado {
  hoja: string;
  filaEncabezado: number; // índice 0-based
  columnas: Partial<Record<Campo, number>>;
  estadoEntrega: EstadoEntrega;
  etiqueta: string;
  traeAbogado: boolean;
  filas: number; // filas de datos (títulos) encontradas
}

export interface FilaTitulo {
  fila: number; // 1-based, como se ve en Excel
  numero: string;
  ruc: string;
  razon: string;
  capital: number;
  estadoEntrega: EstadoEntrega;
  estadoIess?: string;
  guia?: string;
  guiaCoactiva?: string;
  fechaSorteo?: string;
  fechaEntrega?: string;
  fechaEmision?: string;
  juez?: string;
  abogado?: string;
  // Cartera ya resuelta para esta fila (se llena en planificarCarga, no al
  // leer el archivo) — solo se usa al crear un título nuevo.
  cartera?: string;
  observacion?: string;
  observacionGeneral?: string;
  personaLlama?: string;
  fechaLlamada?: string;
  representanteLegal?: string;
  telefono?: string;
  correo?: string;
}

export interface FilaInvalida {
  fila: number;
  numero?: string;
  motivo: string;
}

// ============================================
// 📄 CSV
// ============================================
export function parseCsv(texto: string): Celda[][] {
  texto = texto.replace(/^﻿/, '');
  const primera = texto.split(/\r?\n/, 1)[0] ?? '';
  const delimitador = [',', ';', '\t']
    .map(d => ({ d, n: primera.split(d).length }))
    .sort((a, b) => b.n - a.n)[0].d;

  const filas: Celda[][] = [];
  let fila: string[] = [];
  let celda = '';
  let entreComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { celda += '"'; i++; } else entreComillas = false;
      } else celda += c;
    } else if (c === '"') entreComillas = true;
    else if (c === delimitador) { fila.push(celda); celda = ''; }
    else if (c === '\n') { fila.push(celda.replace(/\r$/, '')); filas.push(fila); fila = []; celda = ''; }
    else celda += c;
  }
  if (celda !== '' || fila.length > 0) { fila.push(celda.replace(/\r$/, '')); filas.push(fila); }

  return filas.filter(f => f.some(c => c !== ''));
}

// ============================================
// 🔎 Detección de formato por encabezados
// ============================================
export function normalizarEncabezado(texto: string): string {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const CAMPOS_EXACTOS: Record<string, Campo> = {
  'tc': 'numero', 't c': 'numero', 'titulo': 'numero', 'numero titulo': 'numero',
  'numero de titulo': 'numero', 'numero de titulo de credito': 'numero',
  'ruc': 'ruc', 'ruc cedula': 'ruc',
  'razon social': 'razon', 'apellidos y nombres': 'razon',
  'valor': 'capital', 'valor capital': 'capital', 'capital': 'capital',
  'estado': 'estadoIess', 'estado actual tc': 'estadoIess',
  // La guía de la matriz ("No, De Guia") es la guía de legalización de los CSV
  // (comprobado título por título); "1er No, De Guia Sorteo" es otra cosa y
  // no se mapea.
  'guia legalizacion': 'guia', 'no guia legalizacion': 'guia', 'no de guia': 'guia', 'no guia de sorteo': 'guia',
  'no guia coactiva': 'guiaCoactiva',
  'fecha entrega': 'fechaEntrega', 'fecha de entrega': 'fechaEntrega',
  'fecha emision': 'fechaEmision', 'fecha emision tc': 'fechaEmision',
  'juez ejecutor': 'juez', 'juez de coactiva': 'juez',
  'abogado': 'abogado',
  // La matriz de entregados usa "PERSONA QUE LLAMA"/"FECHA 1ERA LLAMADA"; la
  // de no entregados, "NOMBRE QUIEN LLAMA"/"PRIMERA LLAMADA" — mismo dato,
  // nombre de columna distinto.
  'observacion': 'observacion', 'observacion general': 'observacionGeneral',
  'persona que llama': 'personaLlama', 'nombre quien llama': 'personaLlama',
  'fecha 1era llamada': 'fechaLlamada', 'primera llamada': 'fechaLlamada',
  'representante legal': 'representanteLegal',
  'telefono': 'telefono',
  'e mail': 'correo', 'correo': 'correo'
};

// Encabezados largos de la matriz de seguimiento ("Razón social/ Nombre del
// coactivado", "Fecha sorteo/resorteo (dd/mm/aaaa)", ...).
const CAMPOS_POR_PREFIJO: [string, Campo][] = [
  ['razon social', 'razon'],
  ['fecha sorteo', 'fechaSorteo'],
  ['fecha de entrega', 'fechaEntrega'],
  ['fecha emision', 'fechaEmision'],
  ['nombre del gestor externo', 'abogado']
];

export function campoDeEncabezado(normalizado: string): Campo | null {
  if (!normalizado) return null;
  const exacto = CAMPOS_EXACTOS[normalizado];
  if (exacto) return exacto;
  return CAMPOS_POR_PREFIJO.find(([prefijo]) => normalizado.startsWith(prefijo))?.[1] ?? null;
}

export function textoCelda(celda: Celda): string {
  if (celda === null || celda === undefined) return '';
  if (celda instanceof Date) return celda.toISOString().slice(0, 10);
  return String(celda).replace(/\s+/g, ' ').trim();
}

// "43406694", 43406694, "43406694.0" → "43406694". Cualquier otra cosa
// (encabezados repetidos, totales, filas de instrucciones) → null.
export function normalizarNumeroTitulo(celda: Celda): string | null {
  const texto = typeof celda === 'number' ? String(Math.trunc(celda)) : textoCelda(celda).replace(/\.0+$/, '');
  return /^\d{5,12}$/.test(texto) ? texto : null;
}

export function detectarFormato(hoja: TablaHoja): FormatoDetectado | null {
  const limite = Math.min(hoja.filas.length, 15);

  for (let i = 0; i < limite; i++) {
    const columnas: Partial<Record<Campo, number>> = {};
    (hoja.filas[i] ?? []).forEach((celda, j) => {
      const campo = campoDeEncabezado(normalizarEncabezado(textoCelda(celda)));
      if (campo && columnas[campo] === undefined) columnas[campo] = j;
    });
    if (columnas.numero === undefined || columnas.ruc === undefined) continue;

    // Si la hoja no trae guía ni fechas de sorteo/entrega, son títulos que
    // todavía no se entregaron (la hoja "NO ENTREGADOS").
    const tieneEntrega = columnas.guia !== undefined || columnas.fechaEntrega !== undefined || columnas.fechaSorteo !== undefined;
    const estadoEntrega: EstadoEntrega = /no\s*entregad/i.test(hoja.nombre) || !tieneEntrega ? 'no_entregado' : 'entregado';

    const filas = hoja.filas.slice(i + 1).filter(f => normalizarNumeroTitulo(f[columnas.numero!]) !== null).length;
    return {
      hoja: hoja.nombre,
      filaEncabezado: i,
      columnas,
      estadoEntrega,
      etiqueta: estadoEntrega === 'no_entregado' ? 'Títulos no entregados' : 'Títulos entregados',
      traeAbogado: columnas.abogado !== undefined,
      filas
    };
  }
  return null;
}

// ============================================
// 🧹 Lectura de valores
// ============================================
export function parseMonto(celda: Celda): number | null {
  if (typeof celda === 'number') return Number.isFinite(celda) ? celda : null;
  let s = textoCelda(celda).replace(/[^\d.,\-]/g, '');
  if (!s) return null;

  const punto = s.lastIndexOf('.');
  const coma = s.lastIndexOf(',');
  if (punto >= 0 && coma >= 0) {
    // El último separador es el decimal.
    s = coma > punto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (coma >= 0) {
    s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if ((s.match(/\./g) ?? []).length > 1) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Fechas de calendario como "yyyy-MM-dd". Las fechas de Excel llegan como
// Date a medianoche UTC: se leen con getUTC* para no correrlas un día por la
// zona horaria.
export function parseFechaISO(celda: Celda): string | undefined {
  const pad = (n: number) => String(n).padStart(2, '0');
  if (celda instanceof Date) {
    return isNaN(celda.getTime()) ? undefined : `${celda.getUTCFullYear()}-${pad(celda.getUTCMonth() + 1)}-${pad(celda.getUTCDate())}`;
  }
  // Celda numérica que Excel no formateó como fecha (serial: días desde
  // 1899-12-30) — pasa como número plano en vez de Date.
  if (typeof celda === 'number' && celda > 0) {
    const d = new Date(Math.round((celda - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? undefined : `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const texto = textoCelda(celda);
  let m = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = texto.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (m && +m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  return undefined;
}

// "00133779" y 133779 son la misma guía.
function normalizarGuia(celda: Celda): string | undefined {
  const texto = typeof celda === 'number' ? String(Math.trunc(celda)) : textoCelda(celda);
  return texto ? texto.replace(/^0+(?=\d)/, '') : undefined;
}

function textoOpcional(celda: Celda): string | undefined {
  const t = textoCelda(celda).toUpperCase();
  return t || undefined;
}

// Sin forzar mayúsculas: es texto libre (una nota), no un nombre.
function notaOpcional(celda: Celda): string | undefined {
  const t = textoCelda(celda).replace(/\s+/g, ' ').trim();
  return t || undefined;
}

export function extraerFilas(
  hoja: TablaHoja,
  formato: FormatoDetectado
): { filas: FilaTitulo[]; invalidas: FilaInvalida[] } {
  const c = formato.columnas;
  const filas: FilaTitulo[] = [];
  const invalidas: FilaInvalida[] = [];

  for (let i = formato.filaEncabezado + 1; i < hoja.filas.length; i++) {
    const r = hoja.filas[i] ?? [];
    const numero = normalizarNumeroTitulo(r[c.numero!]);
    if (!numero) continue; // encabezado repetido, total, fila vacía...

    const ruc = normalizarRuc(r[c.ruc!]);
    if (!esRucValido(ruc)) {
      invalidas.push({ fila: i + 1, numero, motivo: `RUC/cédula inválido: "${textoCelda(r[c.ruc!])}"` });
      continue;
    }

    const capitalCelda = c.capital !== undefined ? r[c.capital] : undefined;
    const capital = textoCelda(capitalCelda) === '' ? 0 : parseMonto(capitalCelda);
    if (capital === null || capital < 0) {
      invalidas.push({ fila: i + 1, numero, motivo: `Capital inválido: "${textoCelda(capitalCelda)}"` });
      continue;
    }

    const fila: FilaTitulo = {
      fila: i + 1,
      numero,
      ruc,
      razon: c.razon !== undefined ? normalizarNombre(textoCelda(r[c.razon])) : '',
      capital,
      estadoEntrega: formato.estadoEntrega
    };
    if (c.estadoIess !== undefined) fila.estadoIess = textoOpcional(r[c.estadoIess]);
    if (c.guia !== undefined) fila.guia = normalizarGuia(r[c.guia]);
    if (c.guiaCoactiva !== undefined) fila.guiaCoactiva = normalizarGuia(r[c.guiaCoactiva]);
    if (c.fechaSorteo !== undefined) fila.fechaSorteo = parseFechaISO(r[c.fechaSorteo]);
    if (c.fechaEntrega !== undefined) fila.fechaEntrega = parseFechaISO(r[c.fechaEntrega]);
    if (c.fechaEmision !== undefined) fila.fechaEmision = parseFechaISO(r[c.fechaEmision]);
    if (c.juez !== undefined) fila.juez = textoOpcional(r[c.juez]);
    if (c.abogado !== undefined) fila.abogado = textoOpcional(r[c.abogado]);
    if (c.observacion !== undefined) fila.observacion = notaOpcional(r[c.observacion]);
    if (c.observacionGeneral !== undefined) fila.observacionGeneral = notaOpcional(r[c.observacionGeneral]);
    if (c.personaLlama !== undefined) fila.personaLlama = textoOpcional(r[c.personaLlama]);
    if (c.fechaLlamada !== undefined) fila.fechaLlamada = parseFechaISO(r[c.fechaLlamada]);
    if (c.representanteLegal !== undefined) fila.representanteLegal = textoOpcional(r[c.representanteLegal]);
    if (c.telefono !== undefined) fila.telefono = notaOpcional(r[c.telefono]);
    if (c.correo !== undefined) fila.correo = notaOpcional(r[c.correo]);

    // La matriz de llamadas no tiene columna de estado: lo único que marca un
    // título cancelado es la palabra "CANCELADO" al final de la observación
    // (en Excel además se pinta la fila de rojo, pero eso es solo un aviso
    // visual — el texto es el dato real).
    if (!fila.estadoIess && /cancelad/i.test(`${fila.observacion ?? ''} ${fila.observacionGeneral ?? ''}`)) {
      fila.estadoIess = 'CANCELADO';
    }

    filas.push(fila);
  }
  return { filas, invalidas };
}

// ============================================
// 👩‍⚖️ Cartera a partir del nombre del abogado
// ============================================
function tokens(texto: string): string[] {
  return texto
    .replace(/\?/g, 'N') // "ORDO?EZ": la Ñ se perdió al generar el CSV
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

// "RUEDA BUSTE JOSE LUIS" → "Jose Luis Rueda": todas las palabras del nombre
// de la cartera deben estar en el texto del archivo (en cualquier orden).
// Si no hay exactamente una cartera que calce, no se adivina.
export function carteraDesdeAbogado(texto: string, carteras: string[]): string | null {
  const palabras = new Set(tokens(texto));
  const coincidencias = carteras.filter(cartera => tokens(cartera).every(t => palabras.has(t)));
  return coincidencias.length === 1 ? coincidencias[0] : null;
}

// ============================================
// 📋 Plan de carga (reglas de duplicados)
// ============================================
export interface Existente {
  numero: string;
  coactivadoId: string;
  estadoEntrega: EstadoEntrega;
  estadoIess?: string;
}

export interface OpcionesCarga {
  carteras: string[];
  // Si se elige, TODAS las filas del archivo van a esa cartera (ignora la
  // columna de abogado). Útil cuando el abogado del archivo trae errores.
  carteraForzada?: string | null;
  // Solo para la carga inicial de una cartera: migra las notas de
  // OBSERVACION/OBSERVACION GENERAL como gestión histórica. En cargas
  // posteriores (nuevas entregas, actualizaciones) va en false — de ahí en
  // adelante las gestiones se registran en vivo desde la bitácora, no desde
  // el Excel.
  migrarObservaciones?: boolean;
  // Notas (RUC + texto) que ya están migradas en Firestore — no se vuelven a
  // crear aunque el archivo las vuelva a traer. Evita duplicar si se repite
  // una carga a propósito o por error (doble clic en "Confirmar").
  notasHistoricasExistentes?: Set<string>;
}

// Una nota migrada del Excel: se agrupa por coactivado y por texto — un
// mismo RUC con 200 títulos que repiten la misma observación 200 veces
// genera UNA sola gestión histórica, no 200. OBSERVACION GENERAL se guarda
// aparte de la descripción porque es la base para el informe del IESS
// (se descarga tal cual, no mezclada con el detalle).
export interface GestionHistorica {
  ruc: string;
  coactivadoNombre: string;
  descripcion: string;
  observacionGeneral?: string;
  personaLlama?: string;
  fecha?: string; // ISO — de la fila que originó esta nota, si la tenía
}

export interface ItemPlan {
  fila: FilaTitulo;
  motivo: string;
}

export interface CoactivadoNuevo {
  ruc: string;
  nombre: string;
  cartera: string;
  representanteLegal?: string;
  telefono?: string;
  correo?: string;
}

// Coactivado que ya existía pero le faltaba representante legal, teléfono o
// correo — la matriz sí los trae, así que una re-carga los completa (nunca
// pisa un dato que el coactivado ya tenía).
export interface ContactoCompletado {
  ruc: string;
  representanteLegal?: string;
  telefono?: string;
  correo?: string;
}

export interface PlanCarga {
  nuevos: FilaTitulo[];
  transiciones: FilaTitulo[];
  // Título ya cargado, mismo estado de entrega, pero cambió su estadoIess
  // (por ejemplo: recién se detecta "CANCELADO" en la observación de una
  // carga posterior). Se actualiza sin contarlo como una entrega nueva.
  actualizaciones: FilaTitulo[];
  coactivadosNuevos: CoactivadoNuevo[];
  contactosCompletados: ContactoCompletado[];
  duplicados: ItemPlan[];
  conflictos: ItemPlan[];
  invalidos: FilaInvalida[];
  // RUC nuevos a los que no se les pudo determinar la cartera: hay que
  // elegirla antes de confirmar.
  rucSinCartera: string[];
  gestionesHistoricas: GestionHistorica[];
  totalFilas: number;
}

// Clave estable de una nota histórica: se usa tanto para no duplicar dentro
// del propio archivo (un RUC con 200 títulos repitiendo la misma nota) como
// para no volver a migrar una nota que ya quedó guardada en una carga
// anterior. OBSERVACION y OBSERVACION GENERAL entran por separado: si
// cualquiera de las dos cambia, es una nota distinta.
export function claveGestionHistorica(ruc: string, descripcion: string, observacionGeneral?: string): string {
  return `${ruc} ${descripcion} ${observacionGeneral ?? ''}`;
}

interface NotaFila {
  descripcion: string;
  observacionGeneral?: string;
}

// OBSERVACION es el detalle (queda como descripción de la gestión);
// OBSERVACION GENERAL se guarda aparte porque es la base del informe del
// IESS y no debe mezclarse con el detalle. Si solo viene la general, se usa
// también como descripción (para que la gestión nunca quede sin texto).
function notaDeFila(f: FilaTitulo): NotaFila | null {
  const detalle = f.observacion?.trim() || undefined;
  const general = f.observacionGeneral?.trim() || undefined;
  if (!detalle && !general) return null;
  return { descripcion: detalle ?? general!, observacionGeneral: general };
}

function extraerGestionesHistoricas(filas: FilaTitulo[], notasExistentes: Set<string>): GestionHistorica[] {
  // ruc -> clave -> (fila + nota) que trajo esa nota (para su fecha/persona)
  const porRuc = new Map<string, Map<string, { fila: FilaTitulo; nota: NotaFila }>>();

  for (const f of filas) {
    const nota = notaDeFila(f);
    if (!nota) continue;
    const clave = claveGestionHistorica(f.ruc, nota.descripcion, nota.observacionGeneral);
    if (notasExistentes.has(clave)) continue;
    const notas = porRuc.get(f.ruc) ?? porRuc.set(f.ruc, new Map()).get(f.ruc)!;
    if (!notas.has(clave)) notas.set(clave, { fila: f, nota });
  }

  const gestiones: GestionHistorica[] = [];
  for (const notas of porRuc.values()) {
    for (const { fila: f, nota } of notas.values()) {
      gestiones.push({
        ruc: f.ruc,
        coactivadoNombre: f.razon,
        descripcion: nota.descripcion,
        observacionGeneral: nota.observacionGeneral,
        personaLlama: f.personaLlama,
        fecha: f.fechaLlamada
      });
    }
  }
  return gestiones;
}

export function planificarCarga(
  filas: FilaTitulo[],
  invalidos: FilaInvalida[],
  existentes: Map<string, Existente>,
  coactivados: Map<string, { cartera: string; representanteLegal?: string; telefono?: string; correo?: string }>,
  opciones: OpcionesCarga
): PlanCarga {
  const carteraDeFila = (f: FilaTitulo): string | null =>
    opciones.carteraForzada ?? (f.abogado ? carteraDesdeAbogado(f.abogado, opciones.carteras) : null);

  // Carteras que trae el archivo para cada RUC que todavía no existe.
  const carterasPorRuc = new Map<string, Set<string>>();
  for (const f of filas) {
    if (coactivados.has(f.ruc)) continue;
    const cartera = carteraDeFila(f);
    if (!cartera) continue;
    (carterasPorRuc.get(f.ruc) ?? carterasPorRuc.set(f.ruc, new Set()).get(f.ruc)!).add(cartera);
  }

  const plan: PlanCarga = {
    nuevos: [], transiciones: [], actualizaciones: [], coactivadosNuevos: [], contactosCompletados: [],
    duplicados: [], conflictos: [],
    invalidos, rucSinCartera: [],
    gestionesHistoricas: opciones.migrarObservaciones
      ? extraerGestionesHistoricas(filas, opciones.notasHistoricasExistentes ?? new Set())
      : [],
    totalFilas: filas.length + invalidos.length
  };
  const vistos = new Set<string>();
  const creados = new Map<string, CoactivadoNuevo>();
  const sinCartera = new Set<string>();
  const contactos = new Map<string, ContactoCompletado>();

  // Un coactivado ya existente puede estarle faltando representante/teléfono/
  // correo (no se pedían al importar antes) — la matriz sí los trae, así que
  // se completan solos con una re-carga, sin pisar lo que ya tenía.
  const completarContacto = (ruc: string, base: { representanteLegal?: string; telefono?: string; correo?: string }, f: FilaTitulo) => {
    const pendiente = contactos.get(ruc);
    const falta = {
      representanteLegal: !base.representanteLegal && !pendiente?.representanteLegal && f.representanteLegal ? f.representanteLegal : undefined,
      telefono: !base.telefono && !pendiente?.telefono && f.telefono ? f.telefono : undefined,
      correo: !base.correo && !pendiente?.correo && f.correo ? f.correo : undefined
    };
    if (!falta.representanteLegal && !falta.telefono && !falta.correo) return;
    contactos.set(ruc, {
      ruc,
      representanteLegal: falta.representanteLegal ?? pendiente?.representanteLegal,
      telefono: falta.telefono ?? pendiente?.telefono,
      correo: falta.correo ?? pendiente?.correo
    });
  };

  for (const f of filas) {
    if (vistos.has(f.numero)) {
      plan.duplicados.push({ fila: f, motivo: 'Repetido dentro del archivo' });
      continue;
    }
    vistos.add(f.numero);

    const carteraArchivo = carteraDeFila(f);
    const enBase = coactivados.get(f.ruc);
    if (enBase) completarContacto(f.ruc, enBase, f);

    const existente = existentes.get(f.numero);
    if (existente) {
      if (existente.coactivadoId !== f.ruc) {
        plan.conflictos.push({ fila: f, motivo: `El título ya está registrado con otro RUC (${existente.coactivadoId})` });
      } else if (existente.estadoEntrega === 'no_entregado' && f.estadoEntrega === 'entregado') {
        plan.transiciones.push(f);
      } else if (f.estadoIess && f.estadoIess !== existente.estadoIess) {
        plan.actualizaciones.push(f);
      } else {
        plan.duplicados.push({ fila: f, motivo: existente.estadoEntrega === f.estadoEntrega ? 'Ya estaba cargado' : 'Ya estaba entregado' });
      }
      continue;
    }

    // Título nuevo: si el coactivado tampoco existe, hay que crearlo (y
    // decidir su cartera). Si el coactivado ya existe pero en otra cartera,
    // el título se cuelga de él igual — el mismo RUC puede caer en dos
    // carteras distintas por error del IESS (guías y títulos distintos);
    // cada título guarda su propia cartera, no la hereda a ciegas del RUC.
    if (!enBase) {
      const candidatas = carterasPorRuc.get(f.ruc);
      if (candidatas && candidatas.size > 1) {
        plan.conflictos.push({ fila: f, motivo: `El RUC aparece con más de una cartera en el archivo (${[...candidatas].join(' y ')})` });
        continue;
      }
      if (!creados.has(f.ruc)) {
        const cartera = candidatas ? [...candidatas][0] : null;
        if (!cartera) {
          sinCartera.add(f.ruc);
          continue;
        }
        if (!f.razon) {
          plan.conflictos.push({ fila: f, motivo: 'Coactivado nuevo sin razón social' });
          continue;
        }
        creados.set(f.ruc, {
          ruc: f.ruc,
          nombre: f.razon,
          cartera,
          representanteLegal: f.representanteLegal,
          telefono: f.telefono,
          correo: f.correo
        });
      }
    }
    f.cartera = carteraArchivo ?? enBase?.cartera ?? creados.get(f.ruc)?.cartera;
    plan.nuevos.push(f);
  }

  plan.coactivadosNuevos = [...creados.values()];
  plan.contactosCompletados = [...contactos.values()];
  plan.rucSinCartera = [...sinCartera];
  return plan;
}
