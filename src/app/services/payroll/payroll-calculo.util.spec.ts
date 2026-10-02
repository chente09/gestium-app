import { calcularMontosLinea } from './payroll-calculo.util';

describe('calcularMontosLinea', () => {
  const base = {
    remuneracionBase: 2700,
    sbu: 482,
    proporcion: 1,
    elegibleDecimos: true,
    bonosVarios: [],
    descuentosVarios: []
  };

  it('sueldo de $2,700 con décimos mensualizados y sin fondos de reserva', () => {
    const m = calcularMontosLinea({ ...base, elegibleFondosReserva: false });
    expect(m.decimoTercero).toBe(225);
    expect(m.decimoCuarto).toBe(40.17); // SBU/12, nunca sobre el sueldo
    expect(m.descuentoIESS).toBe(255.15); // 9.45% solo sobre el sueldo
    expect(m.totalIngresos).toBe(2965.17);
    expect(m.liquidoARecibir).toBe(2710.02);
  });

  it('con más de un año de afiliación suma fondos de reserva (8.33% del sueldo)', () => {
    const m = calcularMontosLinea({ ...base, elegibleFondosReserva: true });
    expect(m.fondosReserva).toBe(224.91);
  });

  it('un pasante no tiene décimos, fondos ni descuento IESS', () => {
    const m = calcularMontosLinea({
      ...base, remuneracionBase: 300, elegibleDecimos: false, elegibleFondosReserva: false
    });
    expect(m.decimoTercero).toBe(0);
    expect(m.decimoCuarto).toBe(0);
    expect(m.descuentoIESS).toBe(0);
    expect(m.liquidoARecibir).toBe(300);
  });
});
