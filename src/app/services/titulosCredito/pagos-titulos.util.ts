// Importador de pagos ya cobrados (monto cancelado + honorario, con el IESS
// ya habiendo pagado a la oficina): reconcilia un Excel de títulos resueltos
// contra los títulos que ya existen en Firestore. Funciones puras (sin
// Angular ni Firestore) para poder probarlas con archivos reales.

import { normalizarRuc, esRucValido } from './titulos-credito.util';
import {
  Celda,
  TablaHoja,
  FilaInvalida,
  carteraDesdeAbogado,
  normalizarEncabezado,
  normalizarNumeroTitulo,
  parseMonto,
  parseFechaISO,
  textoCelda
} from './importador-titulos.util';

export interface FilaPago {
  fila: number;
  ruc: string;
  razon: string;
  numero: string;
  honorario: number;
  montoCancelado: number;
  comprobante?: string;
  fecha?: string; // ISO
  // Abogado tal como lo escribió el archivo — solo para cotejar con la
  // cartera del título (planificarPagos), no se guarda.
  abogado?: string;
  // Si el archivo trae la columna "Estado honorario": true = el IESS ya
  // pagó el honorario, false = sigue pendiente. undefined = el archivo no lo
  // dice para esta fila (se usa la respuesta que da el admin al confirmar).
  honorarioCobrado?: boolean;
}

// Encabezados esperados (el archivo real trae "Toatal cancelado", con
// errata — por eso se matchea por substring, no por texto exacto). El
// formato de cancelados con honorario trae CAPITAL + INTERÉS en vez de un
// total: el monto cancelado es la suma de ambos.
type CampoPago =
  | 'ruc' | 'razon' | 'numero' | 'abogado' | 'honorario' | 'estadoHonorario' | 'comprobante' | 'fecha'
  | 'montoCancelado' | 'capital' | 'interes';

// normalizarEncabezado() devuelve minúsculas sin tildes (ej. "titulo de credito").
function campoDeEncabezadoPago(normalizado: string): CampoPago | null {
  if (normalizado.includes('ruc')) return 'ruc';
  if (normalizado.includes('razon')) return 'razon';
  if (normalizado.includes('titulo') || normalizado === 'tc' || normalizado === 't c') return 'numero';
  if (normalizado === 'abogado') return 'abogado';
  if (normalizado.includes('estado') && normalizado.includes('honorario')) return 'estadoHonorario';
  if (normalizado.includes('honorario')) return 'honorario';
  if (normalizado.includes('comprobante')) return 'comprobante';
  if (normalizado.includes('cancelacion')) return 'fecha';
  // Otras fechas del archivo que NO son la del pago (sorteo, solicitud de guía).
  if (normalizado.includes('sorteo') || normalizado.includes('solicitud')) return null;
  if (normalizado.includes('fecha')) return 'fecha';
  if (normalizado.includes('cancelado') || normalizado.includes('total')) return 'montoCancelado';
  if (normalizado === 'capital') return 'capital';
  if (normalizado === 'interes') return 'interes';
  return null;
}

// "PENDIENTE" → false, "COBRADO"/"PAGADO" → true, cualquier otra cosa o
// vacío → undefined (se decide al confirmar).
function honorarioCobradoDe(celda: Celda): boolean | undefined {
  const t = normalizarEncabezado(textoCelda(celda));
  if (!t) return undefined;
  if (t.includes('pend')) return false;
  if (/cobrad|pagad|cancelad/.test(t)) return true;
  return undefined;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

// Monto cancelado de una fila: la columna de total si existe; si no,
// capital + interés. null = no se pudo leer.
function montoDeFila(r: Celda[], columnas: Partial<Record<CampoPago, number>>): number | null {
  if (columnas.montoCancelado !== undefined) return parseMonto(r[columnas.montoCancelado]);
  if (columnas.capital === undefined) return null;

  const capital = parseMonto(r[columnas.capital]);
  const celdaInteres = columnas.interes !== undefined ? r[columnas.interes] : undefined;
  const interes = textoCelda(celdaInteres) === '' ? 0 : parseMonto(celdaInteres);
  return capital === null || interes === null ? null : redondear(capital + interes);
}

export function extraerFilasPago(tabla: TablaHoja): { filas: FilaPago[]; invalidas: FilaInvalida[] } {
  const limite = Math.min(tabla.filas.length, 15);
  let filaEncabezado = -1;
  let columnas: Partial<Record<CampoPago, number>> = {};

  for (let i = 0; i < limite; i++) {
    const candidatas: Partial<Record<CampoPago, number>> = {};
    (tabla.filas[i] ?? []).forEach((celda, j) => {
      const campo = campoDeEncabezadoPago(normalizarEncabezado(textoCelda(celda)));
      if (campo && candidatas[campo] === undefined) candidatas[campo] = j;
    });
    if (candidatas.ruc !== undefined && candidatas.numero !== undefined && candidatas.honorario !== undefined) {
      filaEncabezado = i;
      columnas = candidatas;
      break;
    }
  }

  if (filaEncabezado === -1) return { filas: [], invalidas: [] };

  const filas: FilaPago[] = [];
  const invalidas: FilaInvalida[] = [];

  for (let i = filaEncabezado + 1; i < tabla.filas.length; i++) {
    const r = tabla.filas[i];
    if (!r || r.every(c => c === null || c === undefined || c === '')) continue;

    // Sin número de título: fila de totales o relleno (el Excel de cancelados
    // cierra con una fila que solo suma los honorarios) — no es un error.
    if (textoCelda(r[columnas.numero!]) === '') continue;

    const numero = normalizarNumeroTitulo(r[columnas.numero!]);
    if (!numero) {
      invalidas.push({ fila: i + 1, motivo: `Número de título inválido: "${textoCelda(r[columnas.numero!])}"` });
      continue;
    }

    const ruc = columnas.ruc !== undefined ? normalizarRuc(r[columnas.ruc]) : '';
    if (!esRucValido(ruc)) {
      invalidas.push({ fila: i + 1, numero, motivo: `RUC/cédula inválido: "${textoCelda(r[columnas.ruc!])}"` });
      continue;
    }

    const honorario = columnas.honorario !== undefined ? parseMonto(r[columnas.honorario]) : null;
    if (honorario === null) {
      invalidas.push({ fila: i + 1, numero, motivo: `Honorario inválido: "${textoCelda(r[columnas.honorario!])}"` });
      continue;
    }

    const montoCancelado = montoDeFila(r, columnas);
    if (montoCancelado === null) {
      const origen = columnas.montoCancelado ?? columnas.capital;
      invalidas.push({ fila: i + 1, numero, motivo: `Monto cancelado inválido: "${origen !== undefined ? textoCelda(r[origen]) : ''}"` });
      continue;
    }

    filas.push({
      fila: i + 1,
      ruc,
      razon: columnas.razon !== undefined ? textoCelda(r[columnas.razon]).trim() : '',
      numero,
      honorario,
      montoCancelado,
      comprobante: columnas.comprobante !== undefined ? textoCelda(r[columnas.comprobante]).trim() || undefined : undefined,
      fecha: columnas.fecha !== undefined ? parseFechaISO(r[columnas.fecha]) : undefined,
      abogado: columnas.abogado !== undefined ? textoCelda(r[columnas.abogado]).trim() || undefined : undefined,
      honorarioCobrado: columnas.estadoHonorario !== undefined ? honorarioCobradoDe(r[columnas.estadoHonorario]) : undefined
    });
  }

  return { filas, invalidas };
}

export interface TituloExistente {
  numero: string;
  coactivadoId: string;
  cartera?: string;
  yaEstabaCobrado: boolean;
}

export interface ItemPagoInvalido {
  fila: FilaPago;
  motivo: string;
}

export interface PlanPagos {
  validos: FilaPago[];
  // Ya estaba marcado como pago_total + honorarioCobrado — se re-aplicaría
  // sin cambiar nada; se avisa aparte para no ocultarlo, pero no bloquea.
  yaEstabanCobrados: FilaPago[];
  noEncontrados: ItemPagoInvalido[];
  conflictos: ItemPagoInvalido[];
  invalidos: FilaInvalida[];
  totalFilas: number;
}

// `carteras` (los abogados del sistema) permite cotejar la columna Abogado
// del archivo con la cartera del título: si el archivo dice un abogado y el
// título es de otro, es muy probable que sea un error en el archivo. Si el
// nombre no se reconoce como ninguna cartera, no se coteja.
export function planificarPagos(
  filas: FilaPago[],
  invalidos: FilaInvalida[],
  existentes: Map<string, TituloExistente>,
  carteras: string[] = []
): PlanPagos {
  const plan: PlanPagos = {
    validos: [], yaEstabanCobrados: [], noEncontrados: [], conflictos: [],
    invalidos, totalFilas: filas.length + invalidos.length
  };

  const vistos = new Set<string>();
  for (const f of filas) {
    if (vistos.has(f.numero)) {
      plan.conflictos.push({ fila: f, motivo: 'Repetido dentro del archivo' });
      continue;
    }
    vistos.add(f.numero);

    const existente = existentes.get(f.numero);
    if (!existente) {
      plan.noEncontrados.push({ fila: f, motivo: 'Ese número de título no existe en el sistema' });
      continue;
    }
    if (existente.coactivadoId !== f.ruc) {
      plan.conflictos.push({ fila: f, motivo: `El título está registrado con otro RUC (${existente.coactivadoId})` });
      continue;
    }
    const carteraArchivo = f.abogado ? carteraDesdeAbogado(f.abogado, carteras) : null;
    if (carteraArchivo && existente.cartera && carteraArchivo !== existente.cartera) {
      plan.conflictos.push({ fila: f, motivo: `El archivo lo pone en ${carteraArchivo}, pero el título es de la cartera de ${existente.cartera}` });
      continue;
    }
    if (existente.yaEstabaCobrado) {
      plan.yaEstabanCobrados.push(f);
      continue;
    }
    plan.validos.push(f);
  }

  return plan;
}
