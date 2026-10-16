import { TituloCredito, esAnulado, esCancelado, esEnConvenio } from './titulos-credito.util';

// Convenios de pago (sin Angular ni Firestore). No hay un registro de
// "convenio": se detecta solo. Una razón social está en pago parcial cuando
// ya pagó algo (títulos cancelados, cancelados en convenio o con abono) y
// todavía le quedan títulos pendientes. Es lo que hay que seguir de cerca
// con los comprobantes. El reporte es por abogado: se agrupa por la cartera
// del título (a quién se lo sorteó el IESS), no por la del coactivado.

export type EstadoTcConvenio = 'cancelado' | 'convenio' | 'pendiente';

export interface TcConvenio {
  numero: string;
  guia?: string;
  estado: EstadoTcConvenio;
  capital: number;
  // Pagó una parte (abono) pero el título sigue abierto.
  conAbono: boolean;
  // Lo registrado como pagado (si se cargó el monto), no el capital nominal.
  montoCobrado?: number;
  // Cuándo se registró el pago.
  fechaPago?: Date;
  comprobante?: string;
}

export interface ConvenioPago {
  cartera: string; // el abogado
  cedula: string;
  nombre: string; // lo completa quien lee los coactivados; arranca igual a la cédula
  tc: TcConvenio[]; // sin anulados: no son capital a recuperar
  cancelados: number; // cancelados + cancelados en convenio
  pendientes: number;
  capitalTotal: number;
  capitalCancelado: number;
  capitalPendiente: number;
  cobrado: number; // suma de lo registrado como pagado
  ultimoPago?: Date;
}

const SIN_CARTERA = 'Sin cartera';

const redondear = (n: number) => Math.round(n * 100) / 100;

// Firestore devuelve Timestamps; la app trabaja con Date.
function aFecha(valor: any): Date | undefined {
  if (!valor) return undefined;
  const fecha = valor.toDate ? valor.toDate() : valor;
  return fecha instanceof Date && !isNaN(fecha.getTime()) ? fecha : undefined;
}

function estadoDe(t: TituloCredito): EstadoTcConvenio {
  if (esEnConvenio(t)) return 'convenio';
  if (esCancelado(t)) return 'cancelado';
  return 'pendiente';
}

export function construirConvenios(titulos: TituloCredito[]): ConvenioPago[] {
  const grupos = new Map<string, ConvenioPago>();

  for (const t of titulos) {
    if (esAnulado(t)) continue;

    const cartera = t.cartera ?? SIN_CARTERA;
    const clave = `${cartera}|${t.coactivadoId}`;
    const grupo = grupos.get(clave) ?? {
      cartera, cedula: t.coactivadoId, nombre: t.coactivadoId, tc: [],
      cancelados: 0, pendientes: 0, capitalTotal: 0, capitalCancelado: 0, capitalPendiente: 0, cobrado: 0
    };

    const estado = estadoDe(t);
    const fechaPago = aFecha(t.fechaCancelacion);
    const registrado = t.tipoCancelacion === 'abono' || t.tipoCancelacion === 'pago_total';

    grupo.tc.push({
      numero: t.numero,
      guia: t.guia,
      estado,
      capital: t.capital,
      conAbono: t.tipoCancelacion === 'abono' && estado === 'pendiente',
      montoCobrado: registrado ? t.montoCancelado : undefined,
      fechaPago,
      comprobante: t.comprobantePago
    });

    grupo.capitalTotal += t.capital;
    if (estado === 'pendiente') grupo.pendientes++;
    else { grupo.cancelados++; grupo.capitalCancelado += t.capital; }
    if (registrado) grupo.cobrado += t.montoCancelado ?? 0;
    if (fechaPago && (!grupo.ultimoPago || fechaPago > grupo.ultimoPago)) grupo.ultimoPago = fechaPago;

    grupos.set(clave, grupo);
  }

  return [...grupos.values()]
    .filter(g => g.pendientes > 0 && (g.cancelados > 0 || g.tc.some(tc => tc.conAbono)))
    .map(g => ({
      ...g,
      tc: g.tc.sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true })),
      capitalTotal: redondear(g.capitalTotal),
      capitalCancelado: redondear(g.capitalCancelado),
      capitalPendiente: redondear(g.capitalTotal - g.capitalCancelado),
      cobrado: redondear(g.cobrado)
    }))
    .sort((a, b) => a.cartera.localeCompare(b.cartera) || a.cedula.localeCompare(b.cedula));
}

// Días desde el último pago registrado (para priorizar el seguimiento).
export function diasSinPagar(convenio: ConvenioPago, hoy: Date = new Date()): number | null {
  if (!convenio.ultimoPago) return null;
  return Math.max(0, Math.floor((hoy.getTime() - convenio.ultimoPago.getTime()) / (1000 * 60 * 60 * 24)));
}
