// Agregación del reporte de gestión del IESS. Funciones puras (sin Angular ni
// Firestore) para poder probarlas con datos de ejemplo. Los días se agrupan
// por fecha LOCAL (la oficina trabaja en hora de Ecuador), nunca por UTC.

export interface GestionReporte {
  fecha: Date;
  coactivadoId: string;
  tipo: string;
  cartera?: string;
  registradoPor: { uid: string; nombre: string };
}

export interface IntegranteReporte {
  uid: string;
  nombre: string;
}

export interface ResumenIntegrante extends IntegranteReporte {
  total: number;
  porTipo: Record<string, number>;
  coactivadosDistintos: number;
  diasActivos: number;
  promedioPorDiaActivo: number;
}

export interface ResumenCartera {
  cartera: string;
  gestiones: number;
  coactivadosDistintos: number;
}

export interface ReporteGestion {
  desde: Date;
  hasta: Date;
  dias: string[]; // yyyy-MM-dd, en orden cronológico
  integrantes: IntegranteReporte[];
  matriz: Record<string, Record<string, number>>; // día → uid → cantidad
  totalesPorDia: Record<string, number>;
  totalesPorIntegrante: Record<string, number>;
  resumenIntegrantes: ResumenIntegrante[];
  porCartera: ResumenCartera[];
  porTipo: Record<string, number>;
  totalGestiones: number;
  coactivadosDistintos: number;
  diasConActividad: number;
  integrantesActivos: number;
}

export const SIN_CARTERA = 'Sin cartera';

export function claveDia(fecha: Date): string {
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mm}-${dd}`;
}

export function inicioDelDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, 0, 0, 0);
}

export function finDelDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 23, 59, 59, 999);
}

// Lunes a viernes siempre; sábado/domingo solo si ese día hubo gestiones.
// Nunca días futuros: una fila de ceros de mañana no dice nada.
function diasDelPeriodo(desde: Date, hasta: Date, diasConDatos: Set<string>, hoy: Date): string[] {
  const limite = hasta < hoy ? hasta : hoy;
  const dias: string[] = [];

  for (let d = inicioDelDia(desde); d <= limite; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const clave = claveDia(d);
    const esFinDeSemana = d.getDay() === 0 || d.getDay() === 6;
    if (!esFinDeSemana || diasConDatos.has(clave)) dias.push(clave);
  }
  return dias;
}

export function construirReporte(
  gestiones: GestionReporte[],
  integrantesBase: IntegranteReporte[],
  tipos: string[],
  desde: Date,
  hasta: Date,
  hoy: Date = new Date()
): ReporteGestion {
  // Columnas: todo el equipo del IESS (así se ve quién NO registró nada) más
  // cualquiera que haya registrado gestiones sin pertenecer a la lista base
  // (ej. un admin de otra área).
  const integrantes = new Map<string, IntegranteReporte>();
  integrantesBase.forEach(i => integrantes.set(i.uid, i));
  gestiones.forEach(g => {
    if (!integrantes.has(g.registradoPor.uid)) {
      integrantes.set(g.registradoPor.uid, { uid: g.registradoPor.uid, nombre: g.registradoPor.nombre });
    }
  });
  const columnas = [...integrantes.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));

  const ceroPorTipo = () => Object.fromEntries(tipos.map(t => [t, 0])) as Record<string, number>;

  const diasConDatos = new Set(gestiones.map(g => claveDia(g.fecha)));
  const dias = diasDelPeriodo(desde, hasta, diasConDatos, hoy);

  const matriz: Record<string, Record<string, number>> = {};
  const totalesPorDia: Record<string, number> = {};
  dias.forEach(dia => {
    matriz[dia] = Object.fromEntries(columnas.map(c => [c.uid, 0]));
    totalesPorDia[dia] = 0;
  });

  const totalesPorIntegrante: Record<string, number> = Object.fromEntries(columnas.map(c => [c.uid, 0]));
  const porTipo = ceroPorTipo();
  const porTipoIntegrante: Record<string, Record<string, number>> = {};
  const coactivadosPorIntegrante: Record<string, Set<string>> = {};
  const diasPorIntegrante: Record<string, Set<string>> = {};
  const carteras = new Map<string, { gestiones: number; coactivados: Set<string> }>();
  const coactivados = new Set<string>();

  columnas.forEach(c => {
    porTipoIntegrante[c.uid] = ceroPorTipo();
    coactivadosPorIntegrante[c.uid] = new Set();
    diasPorIntegrante[c.uid] = new Set();
  });

  gestiones.forEach(g => {
    const dia = claveDia(g.fecha);
    const uid = g.registradoPor.uid;

    if (matriz[dia]) {
      matriz[dia][uid] += 1;
      totalesPorDia[dia] += 1;
    }
    totalesPorIntegrante[uid] += 1;

    const tipo = g.tipo in porTipo ? g.tipo : 'otro';
    porTipo[tipo] = (porTipo[tipo] ?? 0) + 1;
    porTipoIntegrante[uid][tipo] = (porTipoIntegrante[uid][tipo] ?? 0) + 1;

    coactivados.add(g.coactivadoId);
    coactivadosPorIntegrante[uid].add(g.coactivadoId);
    diasPorIntegrante[uid].add(dia);

    const carteraNombre = g.cartera || SIN_CARTERA;
    const cartera = carteras.get(carteraNombre) ?? { gestiones: 0, coactivados: new Set<string>() };
    cartera.gestiones += 1;
    cartera.coactivados.add(g.coactivadoId);
    carteras.set(carteraNombre, cartera);
  });

  const resumenIntegrantes: ResumenIntegrante[] = columnas.map(c => {
    const total = totalesPorIntegrante[c.uid];
    const diasActivos = diasPorIntegrante[c.uid].size;
    return {
      ...c,
      total,
      porTipo: porTipoIntegrante[c.uid],
      coactivadosDistintos: coactivadosPorIntegrante[c.uid].size,
      diasActivos,
      promedioPorDiaActivo: diasActivos ? Math.round((total / diasActivos) * 10) / 10 : 0
    };
  }).sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));

  const porCartera: ResumenCartera[] = [...carteras.entries()]
    .map(([cartera, v]) => ({ cartera, gestiones: v.gestiones, coactivadosDistintos: v.coactivados.size }))
    .sort((a, b) => b.gestiones - a.gestiones || a.cartera.localeCompare(b.cartera));

  return {
    desde,
    hasta,
    dias,
    integrantes: columnas,
    matriz,
    totalesPorDia,
    totalesPorIntegrante,
    resumenIntegrantes,
    porCartera,
    porTipo,
    totalGestiones: gestiones.length,
    coactivadosDistintos: coactivados.size,
    diasConActividad: diasConDatos.size,
    integrantesActivos: columnas.filter(c => totalesPorIntegrante[c.uid] > 0).length
  };
}
