import { cambiosAlReversar, cambiosPorPago, camposAlDeshacer, historialDePagos, totalPagado } from './pagos-titulo.util';
import { RANGO_CATEGORIA, categoriaEstado } from './titulos-credito.util';

const usuario = { uid: 'u1', nombre: 'VICENTE NENGER' };
const otro = { uid: 'u2', nombre: 'PAULA CISNEROS' };
const dia = (d: number) => new Date(2026, 9, d, 12, 0, 0);

function titulo(extra: Record<string, unknown> = {}): any {
  return { numero: '527487722', coactivadoId: '1707139455001', capital: 211.2, estadoEntrega: 'entregado', estadoIess: 'TRANSFERIDO A TRAMITE COACTIVA', ...extra };
}

describe('historialDePagos', () => {
  it('un título sin pagos no tiene historial', () => {
    expect(historialDePagos(titulo()).length).toBe(0);
    expect(totalPagado(titulo())).toBe(0);
  });

  it('un abono registrado antes del historial aparece como primer pago, con su fecha y comprobante', () => {
    const t = titulo({ tipoCancelacion: 'abono', montoCancelado: 100, fechaCancelacion: dia(5), comprobantePago: 'C-1', canceladoPor: usuario });
    const h = historialDePagos(t);
    expect(h.length).toBe(1);
    expect(h[0].monto).toBe(100);
    expect(h[0].anterior).toBe(true);
    expect(h[0].comprobante).toBe('C-1');
    expect(h[0].fecha?.getDate()).toBe(5);
    expect(totalPagado(t)).toBe(100);
  });

  it('si el total es mayor que la suma de los pagos, la diferencia es un pago anterior (carga masiva)', () => {
    const t = titulo({
      tipoCancelacion: 'pago_total', montoCancelado: 300, canceladoPor: usuario,
      pagos: [{ monto: 100, fecha: dia(3), registradoPor: usuario }]
    });
    const h = historialDePagos(t);
    expect(h.length).toBe(2);
    expect(h[1].monto).toBe(200);
    expect(h[1].anterior).toBe(true);
  });

  it('acepta fechas de Firestore (Timestamp)', () => {
    const t = titulo({ tipoCancelacion: 'abono', montoCancelado: 50, pagos: [{ monto: 50, fecha: { toDate: () => dia(7) }, registradoPor: usuario }] });
    expect(historialDePagos(t)[0].fecha?.getDate()).toBe(7);
  });
});

describe('cambiosPorPago', () => {
  it('el primer abono deja el título abierto con el historial de un pago', () => {
    const c = cambiosPorPago(titulo(), { tipo: 'abono', monto: 100, fecha: dia(5), comprobante: ' C-1 ' }, usuario);
    expect(c['tipoCancelacion']).toBe('abono');
    expect(c['montoCancelado']).toBe(100);
    expect(c['pagos'].length).toBe(1);
    expect(c['pagos'][0].comprobante).toBe('C-1');
    expect(c['comprobantePago']).toBe('C-1');
    expect(c['estadoIess'] === undefined).toBe(true); // sigue abierto
    expect(c['honorario'] === undefined).toBe(true);
  });

  it('cada abono se suma al anterior y no lo reemplaza', () => {
    const t1 = titulo();
    const c1 = cambiosPorPago(t1, { tipo: 'abono', monto: 100, fecha: dia(5), comprobante: 'C-1' }, usuario);
    const c2 = cambiosPorPago({ ...t1, ...c1 }, { tipo: 'abono', monto: 50.5, fecha: dia(12), comprobante: 'C-2' }, otro);
    expect(c2['montoCancelado']).toBe(150.5);
    expect(c2['pagos'].length).toBe(2);
    expect(c2['pagos'][0].monto).toBe(100);
    expect(c2['pagos'][1].registradoPor.nombre).toBe('PAULA CISNEROS');
    expect(c2['comprobantePago']).toBe('C-2'); // el del último
    expect(c2['fechaCancelacion'].getDate()).toBe(12);
  });

  it('el abono anterior al historial pasa a ser el primer pago al sumar otro', () => {
    const viejo = titulo({ tipoCancelacion: 'abono', montoCancelado: 80, fechaCancelacion: dia(2), comprobantePago: 'V-1', canceladoPor: usuario });
    const c = cambiosPorPago(viejo, { tipo: 'abono', monto: 20, fecha: dia(9) }, usuario);
    expect(c['pagos'].length).toBe(2);
    expect(c['pagos'][0].anterior).toBe(true);
    expect(c['pagos'][0].monto).toBe(80);
    expect(c['montoCancelado']).toBe(100);
    expect(c['comprobantePago']).toBe('V-1'); // el nuevo pago no trajo comprobante: se conserva el último que hubo
  });

  it('el pago por totalidad cierra el título: total acumulado, estado cancelado y honorario', () => {
    const t = titulo({ tipoCancelacion: 'abono', montoCancelado: 150, pagos: [{ monto: 150, fecha: dia(4), registradoPor: usuario }], canceladoPor: usuario });
    const c = cambiosPorPago(t, { tipo: 'pago_total', monto: 61.2, fecha: dia(15), honorario: 30 }, usuario);
    expect(c['tipoCancelacion']).toBe('pago_total');
    expect(c['montoCancelado']).toBe(211.2);
    expect(c['estadoIess']).toBe('CANCELADO');
    expect(c['honorario']).toBe(30);
    expect(c['pagos'].length).toBe(2);
  });

  it('suma en centavos, sin errores de punto flotante', () => {
    const t = titulo({ tipoCancelacion: 'abono', montoCancelado: 0.1, pagos: [{ monto: 0.1, fecha: dia(1), registradoPor: usuario }], canceladoPor: usuario });
    expect(cambiosPorPago(t, { tipo: 'abono', monto: 0.2, fecha: dia(2) }, usuario)['montoCancelado']).toBe(0.3);
  });

  it('no deja valores indefinidos dentro del historial (Firestore los rechaza)', () => {
    const viejo = titulo({ tipoCancelacion: 'abono', montoCancelado: 80, canceladoPor: usuario }); // sin fecha ni comprobante
    const c = cambiosPorPago(viejo, { tipo: 'abono', monto: 20, fecha: dia(9) }, usuario);
    const hayIndefinidos = (c['pagos'] as any[]).some(p => Object.values(p).includes(undefined));
    expect(hayIndefinidos).toBe(false);
  });

  it('un título cancelado por Excel con fecha previa usa la fecha más reciente como fecha de cancelación', () => {
    const t = titulo({ tipoCancelacion: 'abono', montoCancelado: 10, fechaCancelacion: dia(20), canceladoPor: usuario });
    const c = cambiosPorPago(t, { tipo: 'abono', monto: 5, fecha: dia(3) }, usuario); // pago registrado con fecha anterior
    expect(c['fechaCancelacion'].getDate()).toBe(20);
  });
});

describe('cambiosAlReversar', () => {
  const pago = (monto: number, d: number, comprobante?: string) =>
    ({ monto, fecha: dia(d), ...(comprobante ? { comprobante } : {}), registradoPor: usuario });
  const abierto = () => titulo({
    tipoCancelacion: 'abono', montoCancelado: 150, canceladoPor: usuario, comprobantePago: 'C-2', fechaCancelacion: dia(12),
    pagos: [pago(100, 5, 'C-1'), pago(50, 12, 'C-2')]
  });

  it('reversar un abono deja los demás y cuadra el total, la fecha y el comprobante', () => {
    const r = cambiosAlReversar(abierto(), 1); // el último
    expect(r.cambios['pagos'].length).toBe(1);
    expect(r.cambios['montoCancelado']).toBe(100);
    expect(r.cambios['tipoCancelacion']).toBe('abono');
    expect(r.cambios['comprobantePago']).toBe('C-1');
    expect(r.cambios['fechaCancelacion'].getDate()).toBe(5);
    expect(r.quitar.length).toBe(0);
  });

  it('reversar el único pago equivale a deshacer todo, también el comprobante', () => {
    const solo = titulo({ tipoCancelacion: 'abono', montoCancelado: 100, comprobantePago: 'C-1', pagos: [pago(100, 5, 'C-1')], canceladoPor: usuario });
    const r = cambiosAlReversar(solo, 0);
    expect(Object.keys(r.cambios).length).toBe(0);
    expect(r.quitar.includes('pagos')).toBe(true);
    expect(r.quitar.includes('montoCancelado')).toBe(true);
    expect(r.quitar.includes('comprobantePago')).toBe(true);
    expect(r.quitar.includes('estadoIess')).toBe(false); // era abono: el estado del Excel se conserva
  });

  it('un abono anterior al historial también se puede reversar (queda el resto)', () => {
    const viejo = titulo({ tipoCancelacion: 'abono', montoCancelado: 80, fechaCancelacion: dia(2), comprobantePago: 'V-1', canceladoPor: usuario });
    const conNuevo = { ...viejo, ...cambiosPorPago(viejo, { tipo: 'abono', monto: 20, fecha: dia(9), comprobante: 'N-1' }, usuario) };
    const r = cambiosAlReversar(conNuevo, 0); // el viejo
    expect(r.cambios['pagos'].length).toBe(1);
    expect(r.cambios['montoCancelado']).toBe(20);
    expect(r.cambios['comprobantePago']).toBe('N-1');
  });

  it('reversar un pago de un título cancelado por totalidad lo reabre y quita el honorario', () => {
    const cerrado = titulo({
      tipoCancelacion: 'pago_total', estadoIess: 'CANCELADO', honorario: 30, honorarioCobrado: true, montoCancelado: 211.2,
      canceladoPor: usuario, pagos: [pago(150, 4, 'C-1'), pago(61.2, 15, 'C-2')]
    });
    const r = cambiosAlReversar(cerrado, 1); // el pago final
    expect(r.cambios['tipoCancelacion']).toBe('abono');
    expect(r.cambios['montoCancelado']).toBe(150);
    expect(['estadoIess', 'honorario', 'honorarioCobrado', 'honorarioCobradoPor', 'fechaCobroHonorario'].every(c => r.quitar.includes(c))).toBe(true);
  });

  it('si los pagos que quedan no tienen fecha ni comprobante, esos campos se borran', () => {
    const t = titulo({ tipoCancelacion: 'abono', montoCancelado: 90, canceladoPor: usuario, pagos: [{ monto: 40, registradoPor: usuario }, pago(50, 3, 'X')] });
    const r = cambiosAlReversar(t, 1);
    expect(r.quitar.includes('fechaCancelacion')).toBe(true);
    expect(r.quitar.includes('comprobantePago')).toBe(true);
  });

  it('un pago que no existe da error', () => {
    let error = '';
    try { cambiosAlReversar(abierto(), 5); } catch (e: any) { error = e.message; }
    expect(error).toBe('El pago ya no existe.');
  });
});

describe('camposAlDeshacer', () => {
  it('con puros abonos conserva el estado del Excel (estadoIess)', () => {
    const campos = camposAlDeshacer({ tipoCancelacion: 'abono', pagos: [] });
    expect(campos.includes('estadoIess')).toBe(false);
    expect(campos.includes('pagos')).toBe(true);
    expect(campos.includes('montoCancelado')).toBe(true);
  });

  it('si llegó a cancelarse por totalidad también quita el estado cancelado', () => {
    expect(camposAlDeshacer({ tipoCancelacion: 'pago_total' }).includes('estadoIess')).toBe(true);
  });

  it('quita el comprobante solo si el título tiene pagos registrados aquí', () => {
    const conPagos = { tipoCancelacion: 'abono' as const, pagos: [{ monto: 10, registradoPor: { uid: 'u', nombre: 'U' } }] };
    expect(camposAlDeshacer(conPagos).includes('comprobantePago')).toBe(true);
    expect(camposAlDeshacer({ tipoCancelacion: 'abono' }).includes('comprobantePago')).toBe(false);
  });
});

describe('categoriaEstado', () => {
  it('distingue pendiente, con abono, cancelado, en convenio y anulado', () => {
    expect(categoriaEstado({ estadoIess: 'TRANSFERIDO A TRAMITE COACTIVA' })).toBe('pendiente');
    expect(categoriaEstado({ estadoIess: 'TRANSFERIDO A TRAMITE COACTIVA', tipoCancelacion: 'abono' })).toBe('abono');
    expect(categoriaEstado({ estadoIess: 'CANCELADO', tipoCancelacion: 'pago_total' })).toBe('cancelado');
    expect(categoriaEstado({ estadoIess: 'CANCELADO EN CONVENIO' })).toBe('convenio');
    expect(categoriaEstado({ estadoIess: 'ANULADO' })).toBe('anulado');
  });

  it('ordena: pendiente, con abono, cancelado, convenio, anulado', () => {
    const orden = ['anulado', 'pendiente', 'convenio', 'abono', 'cancelado'] as const;
    const ordenado = [...orden].sort((a, b) => RANGO_CATEGORIA[a] - RANGO_CATEGORIA[b]);
    expect(ordenado.join(',')).toBe('pendiente,abono,cancelado,convenio,anulado');
  });
});
