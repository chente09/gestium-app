import type { AreaActivity } from '../areaActivities/area-activities.service';

// Pendientes de una persona en la bitácora (sin Angular ni Firestore): sus
// recordatorios abiertos, UNA entrada por coactivado. Un mismo coactivado
// puede tener dos recordatorios pero es un solo caso que revisar: la entrada
// lleva la fecha más próxima y cuántos tiene.

export interface PendienteCaso {
  coactivadoId: string;
  coactivadoNombre: string;
  fechaLimite: Date; // la más próxima de sus recordatorios abiertos
  descripcion: string; // lo que hay que hacer, del recordatorio más próximo
  cantidad: number;
  actividadIds: string[];
}

const ESTADOS_ABIERTOS: AreaActivity['estado'][] = ['pendiente', 'en_progreso', 'pospuesta'];

function aFecha(valor: any): Date {
  return valor?.toDate ? valor.toDate() : new Date(valor);
}

// "Mis pendientes" es lo que toca HOY: lo atrasado y lo de hoy. Un
// recordatorio puesto para mañana aparece mañana, no antes — si no, la lista
// se llenaría de cosas que todavía no hay que hacer.
export function esVencidaODeHoy(fechaLimite: any, hoy: Date = new Date()): boolean {
  const finDeHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59, 999);
  return aFecha(fechaLimite) <= finDeHoy;
}

export function soloVencidasYDeHoy(actividades: AreaActivity[], hoy: Date = new Date()): AreaActivity[] {
  return actividades.filter(a => esVencidaODeHoy(a.fechaLimite, hoy));
}

// Milisegundos hasta la próxima medianoche: a esa hora la lista de hoy cambia
// sola, sin esperar a que Firestore mande otra actualización.
export function msHastaMedianoche(ahora: Date = new Date()): number {
  const medianoche = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1, 0, 0, 0, 0);
  return medianoche.getTime() - ahora.getTime();
}

// A qué caso pasar al completar un recordatorio de "Mis pendientes": el que
// queda en su lugar, o el anterior si era el último. undefined = no cambiar de
// caso (la completada no es de mi lista, o ese coactivado todavía tiene otro
// recordatorio abierto); null = ya no queda ninguno. `actividades` son las
// abiertas ANTES de completar.
export function siguientePendienteTras(
  completada: { id?: string; coactivadoId?: string },
  actividades: AreaActivity[]
): PendienteCaso | null | undefined {
  const actuales = agruparPendientesPorCoactivado(actividades);
  const i = actuales.findIndex(p => p.coactivadoId === completada.coactivadoId);
  if (i < 0) return undefined;

  const restantes = agruparPendientesPorCoactivado(actividades.filter(a => a.id !== completada.id));
  if (restantes.some(p => p.coactivadoId === completada.coactivadoId)) return undefined;
  return restantes[i] ?? restantes[i - 1] ?? null;
}

// Ordenados por fecha: los vencidos quedan primero, que es por donde hay que
// empezar. A igual fecha, por nombre, para que el orden sea estable.
export function agruparPendientesPorCoactivado(actividades: AreaActivity[]): PendienteCaso[] {
  const porCoactivado = new Map<string, PendienteCaso>();

  for (const a of actividades) {
    if (!a.coactivadoId || !ESTADOS_ABIERTOS.includes(a.estado)) continue;

    const fecha = aFecha(a.fechaLimite);
    const caso = porCoactivado.get(a.coactivadoId);

    if (!caso) {
      porCoactivado.set(a.coactivadoId, {
        coactivadoId: a.coactivadoId,
        coactivadoNombre: a.coactivadoNombre ?? a.coactivadoId,
        fechaLimite: fecha,
        descripcion: a.descripcion ?? '',
        cantidad: 1,
        actividadIds: a.id ? [a.id] : []
      });
      continue;
    }

    caso.cantidad++;
    if (a.id) caso.actividadIds.push(a.id);
    if (fecha < caso.fechaLimite) {
      caso.fechaLimite = fecha;
      caso.descripcion = a.descripcion ?? '';
    }
  }

  return [...porCoactivado.values()].sort((a, b) =>
    a.fechaLimite.getTime() - b.fechaLimite.getTime() || a.coactivadoNombre.localeCompare(b.coactivadoNombre)
  );
}
