import { construirConvenios, diasSinPagar } from './convenios-pago.util';

const RUC = '1793111564001';

function titulo(numero: string, extra: Record<string, unknown> = {}): any {
  return { numero, coactivadoId: RUC, cartera: 'Jessica Ordoñez', capital: 100, estadoEntrega: 'entregado', estadoIess: 'TRANSFERIDO A TRAMITE COACTIVA', ...extra };
}

const cancelado = (numero: string, extra: Record<string, unknown> = {}) =>
  titulo(numero, { estadoIess: 'CANCELADO', tipoCancelacion: 'pago_total', montoCancelado: 95, honorario: 5, ...extra });

describe('construirConvenios', () => {
  it('10 TC con 2 cancelados: es un convenio con 8 pendientes', () => {
    const tcs = [
      cancelado('1', { fechaCancelacion: new Date(2026, 9, 1), comprobantePago: 'C-001' }),
      cancelado('2', { fechaCancelacion: new Date(2026, 9, 8) }),
      ...Array.from({ length: 8 }, (_, i) => titulo(String(i + 3)))
    ];
    const r = construirConvenios(tcs);
    expect(r.length).toBe(1);
    expect(r[0].tc.length).toBe(10);
    expect(r[0].cancelados).toBe(2);
    expect(r[0].pendientes).toBe(8);
    expect(r[0].capitalTotal).toBe(1000);
    expect(r[0].capitalCancelado).toBe(200);
    expect(r[0].capitalPendiente).toBe(800);
    expect(r[0].cobrado).toBe(190);
    expect(r[0].ultimoPago?.getDate()).toBe(8);
    expect(r[0].tc[0].comprobante).toBe('C-001');
  });

  it('si no pagó nada, o si ya pagó todo, no es convenio', () => {
    expect(construirConvenios([titulo('1'), titulo('2')]).length).toBe(0);
    expect(construirConvenios([cancelado('1'), cancelado('2')]).length).toBe(0);
  });

  it('un cancelado en convenio cuenta como pagado', () => {
    const r = construirConvenios([titulo('1', { estadoIess: 'CANCELADO EN CONVENIO' }), titulo('2')]);
    expect(r.length).toBe(1);
    expect(r[0].tc[0].estado).toBe('convenio');
    expect(r[0].cancelados).toBe(1);
  });

  it('un abono en un título que sigue abierto cuenta como pago parcial', () => {
    const r = construirConvenios([
      titulo('1', { tipoCancelacion: 'abono', montoCancelado: 40, comprobantePago: 'AB-9' }),
      titulo('2')
    ]);
    expect(r.length).toBe(1);
    expect(r[0].tc[0].conAbono).toBe(true);
    expect(r[0].pendientes).toBe(2);
    expect(r[0].cobrado).toBe(40);
    expect(r[0].capitalCancelado).toBe(0);
  });

  it('los anulados no cuentan ni como pendientes ni en el capital', () => {
    const r = construirConvenios([cancelado('1'), titulo('2', { estadoIess: 'ANULADO' })]);
    expect(r.length).toBe(0); // sin pendientes: solo quedó el cancelado
    const r2 = construirConvenios([cancelado('1'), titulo('2', { estadoIess: 'ANULADO' }), titulo('3')]);
    expect(r2[0].tc.length).toBe(2);
    expect(r2[0].capitalTotal).toBe(200);
  });

  it('separa por abogado: el mismo RUC con títulos de dos abogados da dos filas', () => {
    const r = construirConvenios([
      cancelado('1'), titulo('2'),
      cancelado('3', { cartera: 'Mayra Ordoñez' }), titulo('4', { cartera: 'Mayra Ordoñez' })
    ]);
    expect(r.length).toBe(2);
    expect(r.map(c => c.cartera).join('|')).toBe('Jessica Ordoñez|Mayra Ordoñez');
  });

  it('un cancelado de Excel sin monto registrado no suma cobrado', () => {
    const r = construirConvenios([titulo('1', { estadoIess: 'CANCELADO' }), titulo('2')]);
    expect(r[0].cancelados).toBe(1);
    expect(r[0].cobrado).toBe(0);
    expect(r[0].tc[0].montoCobrado === undefined).toBe(true);
  });
});

describe('diasSinPagar', () => {
  it('cuenta los días desde el último pago; sin pagos no hay dato', () => {
    const [c] = construirConvenios([cancelado('1', { fechaCancelacion: new Date(2026, 9, 1) }), titulo('2')]);
    expect(diasSinPagar(c, new Date(2026, 9, 16))).toBe(15);
    const [sinFecha] = construirConvenios([cancelado('1'), titulo('2')]);
    expect(diasSinPagar(sinFecha, new Date(2026, 9, 16)) === null).toBe(true);
  });
});
