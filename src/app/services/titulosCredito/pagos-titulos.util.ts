// Importador de pagos ya cobrados (monto cancelado + honorario, con el IESS
// ya habiendo pagado a la oficina): reconcilia un Excel de títulos resueltos
// contra los títulos que ya existen en Firestore. Funciones puras (sin
// Angular ni Firestore) para poder probarlas con archivos reales.

import { normalizarRuc, esRucValido } from './titulos-credito.util';
import {
  Celda,
  TablaHoja,
  FilaInvalida,
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
}

// Encabezados esperados (el archivo real trae "Toatal cancelado", con
// errata — por eso se matchea por substring, no por texto exacto).
type CampoPago = 'ruc' | 'razon' | 'numero' | 'honorario' | 'comprobante' | 'fecha' | 'montoCancelado';

// normalizarEncabezado() devuelve minúsculas sin tildes (ej. "titulo de credito").
function campoDeEncabezadoPago(normalizado: string): CampoPago | null {
  if (normalizado.includes('ruc')) return 'ruc';
  if (normalizado.includes('razon')) return 'razon';
  if (normalizado.includes('titulo')) return 'numero';
  if (normalizado.includes('honorario')) return 'honorario';
  if (normalizado.includes('comprobante')) return 'comprobante';
  if (normalizado.includes('cancelacion') || normalizado.includes('fecha')) return 'fecha';
  if (normalizado.includes('cancelado') || normalizado.includes('total')) return 'montoCancelado';
  return null;
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

    const montoCancelado = columnas.montoCancelado !== undefined ? parseMonto(r[columnas.montoCancelado]) : null;
    if (montoCancelado === null) {
      invalidas.push({ fila: i + 1, numero, motivo: `Monto cancelado inválido: "${textoCelda(r[columnas.montoCancelado!])}"` });
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
      fecha: columnas.fecha !== undefined ? parseFechaISO(r[columnas.fecha]) : undefined
    });
  }

  return { filas, invalidas };
}

export interface TituloExistente {
  numero: string;
  coactivadoId: string;
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

export function planificarPagos(filas: FilaPago[], invalidos: FilaInvalida[], existentes: Map<string, TituloExistente>): PlanPagos {
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
    if (existente.yaEstabaCobrado) {
      plan.yaEstabanCobrados.push(f);
      continue;
    }
    plan.validos.push(f);
  }

  return plan;
}
