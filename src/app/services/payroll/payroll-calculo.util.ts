// Cálculo de los montos de una línea de rol de pago: función pura (sin
// Angular ni Firestore), usada tanto al generar una línea nueva como al
// recalcularla — así las dos nunca pueden calcular distinto.
//
// Normativa (Ecuador):
// - Décimo Tercero: 1/12 de la remuneración percibida.
// - Décimo Cuarto: 1/12 del SBU vigente — SIEMPRE sobre el SBU, nunca sobre
//   el sueldo del trabajador, gane lo que gane.
// - Fondos de Reserva: 8.33% de la remuneración percibida (solo con más de
//   un año de afiliación).
// - Aporte personal IESS: 9.45% solo sobre la remuneración; los décimos y
//   los fondos de reserva no aportan.

export const IESS_PORCENTAJE = 0.0945;
export const FONDOS_RESERVA_PORCENTAJE = 0.0833;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface EntradaCalculoLinea {
  remuneracionBase: number; // sueldo mensual completo, sin prorratear
  sbu: number; // SBU vigente (base del décimo cuarto)
  proporcion: number; // 0-1, según días trabajados
  elegibleDecimos: boolean;
  elegibleFondosReserva: boolean;
  bonosVarios: { monto: number }[];
  descuentosVarios: { monto: number }[];
}

export interface MontosLinea {
  remuneracion: number;
  decimoTercero: number;
  decimoCuarto: number;
  fondosReserva: number;
  descuentoIESS: number;
  totalIngresos: number;
  totalDescuentos: number;
  liquidoARecibir: number;
}

export function calcularMontosLinea(e: EntradaCalculoLinea): MontosLinea {
  const remuneracion = round2(e.remuneracionBase * e.proporcion);

  const decimoTercero = e.elegibleDecimos ? round2(remuneracion / 12) : 0;
  const decimoCuarto = e.elegibleDecimos ? round2((e.sbu / 12) * e.proporcion) : 0;
  const fondosReserva = e.elegibleFondosReserva ? round2(remuneracion * FONDOS_RESERVA_PORCENTAJE) : 0;
  const descuentoIESS = e.elegibleDecimos ? round2(remuneracion * IESS_PORCENTAJE) : 0;

  const totalBonosVarios = e.bonosVarios.reduce((sum, b) => sum + b.monto, 0);
  const totalDescuentosVarios = e.descuentosVarios.reduce((sum, d) => sum + d.monto, 0);
  const totalIngresos = round2(remuneracion + decimoTercero + decimoCuarto + fondosReserva + totalBonosVarios);
  const totalDescuentos = round2(descuentoIESS + totalDescuentosVarios);
  const liquidoARecibir = round2(totalIngresos - totalDescuentos);

  return { remuneracion, decimoTercero, decimoCuarto, fondosReserva, descuentoIESS, totalIngresos, totalDescuentos, liquidoARecibir };
}
