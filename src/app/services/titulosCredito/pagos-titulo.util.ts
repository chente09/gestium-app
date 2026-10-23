import { PagoTitulo, TipoCancelacion, TituloCredito } from './titulos-credito.util';

// Pagos acumulados de un título (sin Angular ni Firestore). Un coactivado
// puede ir pagando un título en varios abonos hasta cancelarlo: cada abono se
// suma al historial y el título queda abierto hasta que se registra el pago
// por totalidad (con su honorario). El sistema no puede saber cuándo "ya se
// cubrió todo" — el total a pagar con intereses no está en el sistema —, así
// que el cierre lo marca quien registra el pago.

const SIN_USUARIO = { uid: '', nombre: 'Sin registro' };

const redondear = (n: number) => Math.round(n * 100) / 100;

// Firestore devuelve Timestamps; la app trabaja con Date.
function aFecha(valor: any): Date | undefined {
  if (!valor) return undefined;
  const fecha = valor.toDate ? valor.toDate() : valor;
  return fecha instanceof Date && !isNaN(fecha.getTime()) ? fecha : undefined;
}

// Firestore no admite `undefined` dentro de un objeto.
function sinIndefinidos(pago: PagoTitulo): PagoTitulo {
  const limpio: Record<string, any> = {};
  Object.entries(pago).forEach(([clave, valor]) => { if (valor !== undefined) limpio[clave] = valor; });
  return limpio as PagoTitulo;
}

// Los pagos del título en el orden en que se hicieron. Un abono registrado
// antes de que existiera el historial aparece como un primer pago "anterior"
// (con la fecha y el comprobante que tuviera), y si el total del título es
// mayor que la suma de los pagos —por ejemplo, porque la carga masiva de pagos
// trajo el total final— la diferencia aparece como otro pago anterior.
export function historialDePagos(t: TituloCredito): PagoTitulo[] {
  const registrados: PagoTitulo[] = (t.pagos ?? []).map(p => ({ ...p, fecha: aFecha(p.fecha) }));
  const hayRegistro = t.tipoCancelacion === 'abono' || t.tipoCancelacion === 'pago_total';
  const total = t.montoCancelado ?? 0;

  if (registrados.length === 0) {
    if (!hayRegistro || total <= 0) return [];
    return [{
      monto: total,
      fecha: aFecha(t.fechaCancelacion),
      comprobante: t.comprobantePago,
      registradoPor: t.canceladoPor ?? SIN_USUARIO,
      anterior: true
    }];
  }

  const resto = redondear(total - registrados.reduce((suma, p) => suma + p.monto, 0));
  if (hayRegistro && resto > 0.005) {
    registrados.push({ monto: resto, registradoPor: t.canceladoPor ?? SIN_USUARIO, anterior: true });
  }
  return registrados;
}

// Lo pagado hasta ahora (el total que leen los reportes).
export function totalPagado(t: TituloCredito): number {
  if (t.tipoCancelacion !== 'abono' && t.tipoCancelacion !== 'pago_total') return 0;
  return redondear(t.montoCancelado ?? historialDePagos(t).reduce((suma, p) => suma + p.monto, 0));
}

// Campos que se borran al deshacer los pagos de un título (solo admin). El
// estado del Excel (estadoIess) solo se toca si el título llegó a cancelarse
// por totalidad, que es lo único que lo cambia: con puros abonos queda como
// estaba. El comprobante se borra si vino de los pagos registrados aquí.
export function camposAlDeshacer(t: Pick<TituloCredito, 'tipoCancelacion' | 'pagos'>): string[] {
  const campos = [
    'tipoCancelacion', 'montoCancelado', 'honorario', 'canceladoPor', 'fechaCancelacion',
    'honorarioCobrado', 'honorarioCobradoPor', 'fechaCobroHonorario', 'pagos'
  ];
  if (t.tipoCancelacion === 'pago_total') campos.push('estadoIess');
  if ((t.pagos?.length ?? 0) > 0) campos.push('comprobantePago');
  return campos;
}

export interface CambiosAlReversar {
  cambios: Record<string, any>; // lo que se guarda
  quitar: string[]; // los campos que se borran
}

// Reversa UN pago del historial (solo admin), por su posición en
// historialDePagos. Cuadra otra vez el total, la fecha y el comprobante con
// los pagos que quedan. Si era el último pago, equivale a deshacer todo. Si el
// título estaba cancelado por totalidad, vuelve a quedar abierto (con abonos):
// se quita el estado cancelado y el honorario, y habrá que registrar de nuevo
// el pago por totalidad.
export function cambiosAlReversar(t: TituloCredito, indice: number): CambiosAlReversar {
  const todos = historialDePagos(t);
  if (indice < 0 || indice >= todos.length) throw new Error('El pago ya no existe.');

  const restantes = todos.filter((_, i) => i !== indice).map(sinIndefinidos);
  if (restantes.length === 0) {
    const quitar = camposAlDeshacer({ tipoCancelacion: t.tipoCancelacion, pagos: t.pagos });
    return { cambios: {}, quitar: quitar.includes('comprobantePago') ? quitar : [...quitar, 'comprobantePago'] };
  }

  const cambios: Record<string, any> = {
    pagos: restantes,
    tipoCancelacion: 'abono',
    montoCancelado: redondear(restantes.reduce((suma, p) => suma + p.monto, 0))
  };
  const quitar: string[] = [];

  const fechas = restantes.map(p => aFecha(p.fecha)).filter((f): f is Date => !!f);
  if (fechas.length > 0) cambios['fechaCancelacion'] = new Date(Math.max(...fechas.map(f => f.getTime())));
  else quitar.push('fechaCancelacion');

  const ultimoComprobante = [...restantes].reverse().find(p => p.comprobante)?.comprobante;
  if (ultimoComprobante) cambios['comprobantePago'] = ultimoComprobante;
  else quitar.push('comprobantePago');

  if (t.tipoCancelacion === 'pago_total') {
    quitar.push('estadoIess', 'honorario', 'honorarioCobrado', 'honorarioCobradoPor', 'fechaCobroHonorario');
  }
  return { cambios, quitar };
}

export interface EntradaPago {
  tipo: TipoCancelacion; // 'abono' deja el título abierto; 'pago_total' lo cancela
  monto: number; // lo de ESTE pago, no el acumulado
  fecha: Date;
  comprobante?: string;
  honorario?: number; // solo en pago_total
}

// Cambios que hay que guardar en el título al registrar un pago más: el
// historial completo, el total acumulado como `montoCancelado`, la fecha y el
// comprobante del último pago, y —si es el pago por totalidad— el estado
// cancelado y el honorario.
export function cambiosPorPago(
  t: TituloCredito,
  entrada: EntradaPago,
  usuario: { uid: string; nombre: string }
): Record<string, any> {
  const nuevo = sinIndefinidos({
    monto: redondear(entrada.monto),
    fecha: entrada.fecha,
    comprobante: entrada.comprobante?.trim() || undefined,
    registradoPor: usuario
  });
  const pagos = [...historialDePagos(t).map(sinIndefinidos), nuevo];

  const fechas = pagos.map(p => aFecha(p.fecha)).filter((f): f is Date => !!f);
  const cambios: Record<string, any> = {
    pagos,
    tipoCancelacion: entrada.tipo,
    montoCancelado: redondear(pagos.reduce((suma, p) => suma + p.monto, 0)),
    canceladoPor: usuario,
    fechaCancelacion: fechas.length > 0 ? new Date(Math.max(...fechas.map(f => f.getTime()))) : entrada.fecha
  };

  const ultimoComprobante = [...pagos].reverse().find(p => p.comprobante)?.comprobante;
  if (ultimoComprobante) cambios['comprobantePago'] = ultimoComprobante;

  if (entrada.tipo === 'pago_total') {
    cambios['estadoIess'] = 'CANCELADO';
    cambios['honorario'] = entrada.honorario ?? 0;
  }
  return cambios;
}
