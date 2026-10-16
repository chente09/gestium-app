import { efectoEnSaldo } from './efecto-saldo.util';

const base = { fechaInicio: '2026-10-05', fechaFin: '2026-10-12' }; // lunes a lunes: 8 corridos, 6 laborables

describe('efectoEnSaldo', () => {
  it('aprobada con descuento y días guardados: usa lo que realmente se descontó', () => {
    const e = efectoEnSaldo({ ...base, estado: 'aprobado', diasDescontados: 6 }, true);
    expect(e.tipo).toBe('descuenta');
    expect(e.dias).toBe(6);
    expect(e.diasCorridosAnteriores).toBe(false);
  });

  it('aprobada con descuento sin días guardados (anterior): cuenta días corridos y lo marca', () => {
    const e = efectoEnSaldo({ ...base, estado: 'aprobado' }, true);
    expect(e.tipo).toBe('descuenta');
    expect(e.dias).toBe(8);
    expect(e.diasCorridosAnteriores).toBe(true);
  });

  it('aprobada que no descuenta (médico, calamidad, maternidad) no afecta el saldo', () => {
    const e = efectoEnSaldo({ ...base, estado: 'aprobado' }, false);
    expect(e.tipo).toBe('ninguno');
    expect(e.dias).toBe(0);
  });

  it('vencida sin justificativo con descuento: se descontó por vencer', () => {
    const e = efectoEnSaldo({ ...base, estado: 'vencido_sin_justificativo', descontadoDeVacaciones: true, diasDescontados: 6 }, false);
    expect(e.tipo).toBe('descontado_por_vencer');
    expect(e.dias).toBe(6);
  });

  it('vencida sin descuento (pasante o licencia exenta) no afecta el saldo', () => {
    const e = efectoEnSaldo({ ...base, estado: 'vencido_sin_justificativo', descontadoDeVacaciones: false }, false);
    expect(e.tipo).toBe('ninguno');
  });

  it('vencida que el admin reabrió: sigue contando el descuento ya aplicado', () => {
    const e = efectoEnSaldo({ ...base, estado: 'aprobado', descontadoDeVacaciones: true, diasDescontados: 6 }, false);
    expect(e.tipo).toBe('descontado_por_vencer');
    expect(e.dias).toBe(6);
  });

  it('pendiente que descuenta: avisa cuántos laborables descontará', () => {
    const e = efectoEnSaldo({ ...base, estado: 'pendiente' }, true);
    expect(e.tipo).toBe('descontara');
    expect(e.dias).toBe(6);
  });

  it('pendiente que no descuenta y rechazada no afectan el saldo', () => {
    expect(efectoEnSaldo({ ...base, estado: 'pendiente' }, false).tipo).toBe('ninguno');
    expect(efectoEnSaldo({ ...base, estado: 'rechazado' }, true).tipo).toBe('ninguno');
  });
});
