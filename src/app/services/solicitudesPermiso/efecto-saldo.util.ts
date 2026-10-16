import { diasCorridos, diasLaborables } from '../payroll/vacaciones-saldo.util';

// Qué hizo (o hará) una solicitud sobre el saldo de vacaciones de la persona,
// para revisar su historial con ella. Pura (sin Angular ni Firestore): el
// tipo de solicitud se pasa ya resuelto en `descuentaAlAprobar`.

export interface DatosEfecto {
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'vencido_sin_justificativo';
  fechaInicio: string;
  fechaFin: string;
  descontadoDeVacaciones?: boolean;
  // Días que se descontaron de verdad (solo se guarda desde el 16/10/2026).
  diasDescontados?: number;
}

export type TipoEfecto =
  | 'descuenta' // se descontó al aprobarse
  | 'descontado_por_vencer' // se descontó por no subir el justificativo a tiempo
  | 'descontara' // pendiente: se descontará al aprobarse
  | 'ninguno'; // médico/calamidad con justificativo, maternidad, rechazadas, etc.

export interface EfectoSaldo {
  tipo: TipoEfecto;
  dias: number;
  // true = no se guardó cuántos días se descontaron: se calcula con días
  // corridos, que es como se descontaba antes del 16/10/2026.
  diasCorridosAnteriores: boolean;
}

const NINGUNO: EfectoSaldo = { tipo: 'ninguno', dias: 0, diasCorridosAnteriores: false };

export function efectoEnSaldo(s: DatosEfecto, descuentaAlAprobar: boolean): EfectoSaldo {
  switch (s.estado) {
    case 'pendiente':
      return descuentaAlAprobar
        ? { tipo: 'descontara', dias: diasLaborables(s.fechaInicio, s.fechaFin), diasCorridosAnteriores: false }
        : NINGUNO;

    case 'aprobado':
      if (descuentaAlAprobar) return descontado('descuenta', s);
      // Una vencida que el admin reabrió para subir el justificativo tarde
      // vuelve a "aprobado", pero el descuento ya hecho no se revierte.
      return s.descontadoDeVacaciones ? descontado('descontado_por_vencer', s) : NINGUNO;

    case 'vencido_sin_justificativo':
      return s.descontadoDeVacaciones ? descontado('descontado_por_vencer', s) : NINGUNO;

    default:
      return NINGUNO;
  }
}

function descontado(tipo: 'descuenta' | 'descontado_por_vencer', s: DatosEfecto): EfectoSaldo {
  if (s.diasDescontados !== undefined) {
    return { tipo, dias: s.diasDescontados, diasCorridosAnteriores: false };
  }
  return { tipo, dias: diasCorridos(s.fechaInicio, s.fechaFin), diasCorridosAnteriores: true };
}
