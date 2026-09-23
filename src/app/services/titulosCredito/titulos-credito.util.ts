// Títulos de crédito (TC) del IESS: tipos y utilidades puras (sin Angular ni
// Firestore) para poder probarlas con datos reales.
//
// Un coactivado (RUC) se gestiona por RUC, pero el título de crédito es lo
// que nunca se repite: su número es el ID del documento en Firestore, así
// que un mismo título no puede cargarse dos veces.

export type EstadoEntrega = 'entregado' | 'no_entregado';

// Abono: pago parcial, el título sigue abierto por el saldo. Pago total: se
// cancela por completo — ahí sí importan el monto y el honorario (lo que de
// verdad interesa para la estadística de recuperación de cartera).
export type TipoCancelacion = 'abono' | 'pago_total';

export interface TituloCredito {
  numero: string; // también es el ID del documento
  coactivadoId: string; // RUC/cédula normalizado
  capital: number;
  estadoEntrega: EstadoEntrega;
  estadoIess?: string; // ej. TRANSFERIDO A TRAMITE COACTIVA / CANCELADO TRAMITE DE COACTIVA
  guia?: string; // guía de legalización
  guiaCoactiva?: string;
  // Fechas como "yyyy-MM-dd" (son fechas de calendario, sin hora).
  fechaSorteo?: string;
  fechaEntrega?: string;
  fechaEmision?: string;
  juez?: string;
  cargaId?: string;
  // Cancelación registrada a mano desde la ficha (no la que trae el Excel).
  tipoCancelacion?: TipoCancelacion;
  montoCancelado?: number; // solo pago_total
  honorario?: number; // solo pago_total
  canceladoPor?: { uid: string; nombre: string };
  fechaCancelacion?: Date | any;
  // El título cancelado y el honorario cobrado son eventos distintos: el
  // IESS le paga el honorario a la oficina en su propio tiempo, aparte de
  // cuándo se canceló el título.
  honorarioCobrado?: boolean;
  honorarioCobradoPor?: { uid: string; nombre: string };
  fechaCobroHonorario?: Date | any;
  // Número de comprobante del pago del honorario (viene de la carga masiva
  // de pagos ya cobrados, no se pide en el registro manual).
  comprobantePago?: string;
  // De qué carga masiva de pagos vino (para poder rastrearla, no para deshacerla).
  cargaPagosId?: string;
}

// Excel guarda el RUC como número y se come el cero inicial (0502… queda
// 502…), así que un RUC de 12 dígitos es un RUC de 13 al que le falta ese
// cero, y una cédula de 9 es de 10. Sin esto el mismo coactivado aparecería
// dos veces según de qué archivo venga.
export function normalizarRuc(valor: unknown): string {
  let texto = typeof valor === 'number' ? String(Math.trunc(valor)) : String(valor ?? '');
  texto = texto.replace(/\D/g, '');
  if (texto.length === 12 || texto.length === 9) texto = '0' + texto;
  return texto;
}

export function esRucValido(ruc: string): boolean {
  return /^(\d{10}|\d{13})$/.test(ruc);
}

export function esCancelado(titulo: { estadoIess?: string }): boolean {
  return /cancelad/i.test(titulo.estadoIess ?? '');
}

export interface ResumenTitulos {
  total: number;
  entregados: number;
  noEntregados: number;
  cancelados: number;
  capitalTotal: number;
  capitalEntregado: number;
  capitalNoEntregado: number;
  capitalCancelado: number;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

export function resumirTitulos(titulos: TituloCredito[]): ResumenTitulos {
  const r: ResumenTitulos = {
    total: titulos.length, entregados: 0, noEntregados: 0, cancelados: 0,
    capitalTotal: 0, capitalEntregado: 0, capitalNoEntregado: 0, capitalCancelado: 0
  };

  for (const t of titulos) {
    r.capitalTotal += t.capital;
    if (t.estadoEntrega === 'entregado') { r.entregados++; r.capitalEntregado += t.capital; }
    else { r.noEntregados++; r.capitalNoEntregado += t.capital; }
    if (esCancelado(t)) { r.cancelados++; r.capitalCancelado += t.capital; }
  }

  r.capitalTotal = redondear(r.capitalTotal);
  r.capitalEntregado = redondear(r.capitalEntregado);
  r.capitalNoEntregado = redondear(r.capitalNoEntregado);
  r.capitalCancelado = redondear(r.capitalCancelado);
  return r;
}

// $34.512,10 (formato de Ecuador).
export function formatoMoneda(valor: number): string {
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(valor);
}

// "2026-07-15" → "15/07/2026"
export function fechaCorta(iso?: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}
