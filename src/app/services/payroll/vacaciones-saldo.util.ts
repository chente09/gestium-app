// Saldo de vacaciones (sin Angular ni Firestore): lo usan la lista de saldos,
// "Mis solicitudes", el formulario de empleados y los descuentos al aprobar o
// vencer una solicitud — todos tienen que ver el mismo número.

// De los 15 días legales de vacaciones (Código del Trabajo, Art. 69: quince
// días ininterrumpidos, incluidos los no laborables), 4 corresponden a fines
// de semana dentro del bloque continuo. Cuando se descuentan del saldo día a
// día solo cuentan los días laborables: 11 por cada año cumplido.
export const DIAS_VACACIONES_DESCONTABLES = 11;

// El saldo de cada empleado lo cargó el admin a mano hasta ahora, así que no
// se sabe si ya incluye su último aniversario. Por eso la acreditación
// automática solo cuenta los aniversarios desde el 1/10/2026; lo anterior se
// da por reflejado en el número que ya estaba cargado.
export const ACREDITADO_HASTA_INICIAL = '2026-09-30';

export interface DatosSaldoVacaciones {
  fechaAfiliacionIESS: string | null;
  saldoVacacionesDisponible?: number | null;
  // Fecha (YYYY-MM-DD, inclusive) hasta la que los aniversarios ya están
  // sumados dentro de `saldoVacacionesDisponible`. Vacío = ACREDITADO_HASTA_INICIAL.
  vacacionesAcreditadasHasta?: string | null;
}

export interface SaldoVacaciones {
  // Saldo real de hoy: el guardado más los aniversarios que faltaba sumar.
  saldo: number;
  // Cuántos aniversarios se sumaron de más sobre el saldo guardado.
  aniversariosPorAcreditar: number;
  // Valor para guardar en `vacacionesAcreditadasHasta` al persistir `saldo`.
  acreditadoHasta: string;
}

function fechaLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// YYYY-MM-DD en hora local (toISOString corre el día por la zona horaria).
export function fechaIso(fecha: Date = new Date()): string {
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mm}-${dd}`;
}

// Aniversarios de afiliación cumplidos después de `acreditadoHasta` y hasta
// hoy (el del propio día cuenta desde las 00:00).
export function contarAniversariosPorAcreditar(
  fechaAfiliacionIESS: string,
  acreditadoHasta: string | null | undefined,
  hoy: Date = new Date()
): number {
  const [y, m, d] = fechaAfiliacionIESS.split('-').map(Number);
  const desde = fechaLocal(acreditadoHasta || ACREDITADO_HASTA_INICIAL);
  let cuantos = 0;
  for (let anio = 1; ; anio++) {
    const aniversario = new Date(y + anio, m - 1, d);
    if (aniversario > hoy) break;
    if (aniversario > desde) cuantos++;
  }
  return cuantos;
}

// Cada aniversario suma 11 días, sin tope: lo que no se usa se acumula, y un
// adelanto o una deuda se compensa solo (-4 + 11 = 7). Un pasante (sin fecha
// de afiliación) no acumula nada.
export function saldoVacacionesAlDia(datos: DatosSaldoVacaciones, hoy: Date = new Date()): SaldoVacaciones {
  const guardado = datos.saldoVacacionesDisponible ?? 0;
  const nuevos = datos.fechaAfiliacionIESS
    ? contarAniversariosPorAcreditar(datos.fechaAfiliacionIESS, datos.vacacionesAcreditadasHasta, hoy)
    : 0;
  return {
    saldo: guardado + nuevos * DIAS_VACACIONES_DESCONTABLES,
    aniversariosPorAcreditar: nuevos,
    acreditadoHasta: fechaIso(hoy)
  };
}

// Cómo se rotula el saldo. Un mismo número negativo significa cosas distintas
// según si ya cumplió el año (deuda real) o no (adelanto antes de tener
// derecho): la palabra y el color ya los distinguen sin necesitar leyenda.
export function etiquetaSaldo(saldo: number, elegible: boolean): { texto: string; color: string } {
  if (saldo > 0) return { texto: `${saldo} días`, color: 'green' };
  if (saldo === 0) return { texto: '0 días', color: 'default' };
  return elegible
    ? { texto: `Debe ${Math.abs(saldo)}`, color: 'red' }
    : { texto: `Adelanto ${Math.abs(saldo)}`, color: 'gold' };
}

// Aniversarios de afiliación que el sistema suma solo (desde el 1/10/2026
// hasta hoy), como fechas YYYY-MM-DD. Para mostrar de dónde sale el saldo.
export function aniversariosAcreditadosAuto(fechaAfiliacionIESS: string, hoy: Date = new Date()): string[] {
  const [y, m, d] = fechaAfiliacionIESS.split('-').map(Number);
  const desde = fechaLocal(ACREDITADO_HASTA_INICIAL);
  const fechas: string[] = [];
  for (let anio = 1; ; anio++) {
    const aniversario = new Date(y + anio, m - 1, d);
    if (aniversario > hoy) break;
    if (aniversario > desde) fechas.push(fechaIso(aniversario));
  }
  return fechas;
}

// Próximo aniversario de afiliación después de hoy (YYYY-MM-DD).
export function proximoAniversario(fechaAfiliacionIESS: string, hoy: Date = new Date()): string {
  const [y, m, d] = fechaAfiliacionIESS.split('-').map(Number);
  let anio = 1;
  while (new Date(y + anio, m - 1, d) <= hoy) anio++;
  return fechaIso(new Date(y + anio, m - 1, d));
}

// Días corridos entre dos fechas (inclusive), sábados y domingos incluidos.
// Así se descontaban las solicitudes antes del 16/10/2026; se conserva para
// mostrar cuántos días se descontaron en esas.
export function diasCorridos(fechaInicio: string, fechaFin: string): number {
  const ms = fechaLocal(fechaFin).getTime() - fechaLocal(fechaInicio).getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1);
}

// Días de lunes a viernes entre dos fechas (inclusive). Los feriados no se
// excluyen: no hay un calendario de feriados cargado.
export function diasLaborables(fechaInicio: string, fechaFin: string): number {
  const fin = fechaLocal(fechaFin);
  let total = 0;
  for (const dia = fechaLocal(fechaInicio); dia <= fin; dia.setDate(dia.getDate() + 1)) {
    const diaSemana = dia.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) total++;
  }
  return total;
}
