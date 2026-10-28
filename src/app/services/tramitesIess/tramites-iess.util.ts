// Trámites del IESS (radiografías, anulaciones de títulos y otros): tipos,
// etapas, totales y los cambios que se guardan en cada acción (sin Angular ni
// Firestore, para poder probarlos).
//
// Un trámite es un servicio a un cliente (persona o empresa, no siempre
// coactivado). Tiene dos lados de dinero: lo que se cobra al cliente (el
// honorario, en abonos) y lo que se paga a terceros (tramitadores del SUT,
// del IESS...), cada costo con sus propios abonos. La utilidad es la
// diferencia. Cada cambio de etapa, pago o cierre deja una línea en las
// gestiones con quién lo hizo.

import { normalizarBusqueda, normalizarNombre } from '../coactivados/coactivados.util';
import { esRucValido, formatoMoneda, fechaCorta, normalizarRuc } from '../titulosCredito/titulos-credito.util';

export const COLECCION_TRAMITES = 'tramites_iess';

// Días sin ningún movimiento a partir de los cuales un trámite en curso se
// marca para darle seguimiento.
export const DIAS_SIN_MOVIMIENTO = 15;

export type TipoTramite = 'radiografia' | 'anulacion_ruc' | 'anulacion_conyuges' | 'anulacion_finiquito' | 'otro';
export type EsperandoA = 'cliente' | 'tercero' | 'iess' | 'oficina';
export type EstadoTramite = 'en_curso' | 'terminado' | 'desistido';
export type EstadoEtapa = 'pendiente' | 'hecha' | 'omitida';
export type ConceptoTercero = 'sut' | 'contrato' | 'acta' | 'tramitador_iess' | 'otro';

export interface UsuarioRegistro { uid: string; nombre: string }

// ============================================
// 📋 Tipos de trámite y sus etapas
// ============================================
export interface DefEtapa {
  id: string;
  nombre: string;
  esperandoA: EsperandoA; // de quién depende que la etapa avance
  concepto?: ConceptoTercero; // costo a tercero que suele llevar esta etapa
}

export interface DefTipo {
  id: TipoTramite;
  nombre: string;
  color: string; // color de la etiqueta (ng-zorro)
  etapas: DefEtapa[];
}

const ETAPA_RESOLUCION: DefEtapa = { id: 'resolucion', nombre: 'Esperar la resolución del IESS', esperandoA: 'iess' };

// Cualquier etapa se puede omitir (no todos los casos las llevan todas): lo
// que cambia por tipo es el orden en que se esperan.
export const TIPOS_TRAMITE: DefTipo[] = [
  {
    id: 'radiografia', nombre: 'Radiografía', color: 'geekblue',
    etapas: [
      { id: 'solicitar_info', nombre: 'Solicitar información al cliente', esperandoA: 'cliente' },
      { id: 'revision', nombre: 'Revisar la situación en el IESS', esperandoA: 'oficina' },
      { id: 'resultados', nombre: 'Entregar resultados y decisión del cliente', esperandoA: 'cliente' }
    ]
  },
  {
    id: 'anulacion_ruc', nombre: 'Anulación · RUC suspendido', color: 'volcano',
    etapas: [
      { id: 'solicitar_info', nombre: 'Solicitar información al cliente', esperandoA: 'cliente' },
      { id: 'ingresar', nombre: 'Ingresar el trámite al IESS', esperandoA: 'oficina' },
      ETAPA_RESOLUCION
    ]
  },
  {
    id: 'anulacion_conyuges', nombre: 'Anulación · cónyuges', color: 'magenta',
    etapas: [
      { id: 'solicitar_docs', nombre: 'Solicitar la documentación', esperandoA: 'cliente' },
      { id: 'presentar', nombre: 'Presentar el escrito', esperandoA: 'oficina' },
      ETAPA_RESOLUCION
    ]
  },
  {
    id: 'anulacion_finiquito', nombre: 'Anulación · actas de finiquito', color: 'purple',
    etapas: [
      { id: 'verificar', nombre: 'Verificar cuenta SUT y contrato previo', esperandoA: 'oficina' },
      { id: 'analizar', nombre: 'Analizar el caso', esperandoA: 'oficina' },
      { id: 'sut', nombre: 'Crear la cuenta SUT', esperandoA: 'tercero', concepto: 'sut' },
      { id: 'contrato', nombre: 'Contrato', esperandoA: 'tercero', concepto: 'contrato' },
      { id: 'acta', nombre: 'Acta de finiquito', esperandoA: 'tercero', concepto: 'acta' },
      { id: 'ingresar', nombre: 'Ingresar el trámite al IESS', esperandoA: 'oficina' },
      ETAPA_RESOLUCION
    ]
  },
  {
    id: 'otro', nombre: 'Otro trámite', color: 'default',
    etapas: [
      { id: 'gestion', nombre: 'En gestión', esperandoA: 'oficina' },
      { id: 'presentado', nombre: 'Presentado, esperando respuesta', esperandoA: 'iess' }
    ]
  }
];

export function defTipo(tipo: TipoTramite): DefTipo {
  return TIPOS_TRAMITE.find(t => t.id === tipo) ?? TIPOS_TRAMITE[TIPOS_TRAMITE.length - 1];
}

export const ETIQUETAS_ESPERANDO: Record<EsperandoA, { texto: string; color: string }> = {
  cliente: { texto: 'Cliente', color: 'gold' },
  tercero: { texto: 'Tercero', color: 'purple' },
  iess: { texto: 'IESS', color: 'blue' },
  oficina: { texto: 'Oficina', color: 'green' }
};

export const CONCEPTOS_TERCERO: { id: ConceptoTercero; nombre: string }[] = [
  { id: 'sut', nombre: 'SUT' },
  { id: 'contrato', nombre: 'Contrato' },
  { id: 'acta', nombre: 'Acta de finiquito' },
  { id: 'tramitador_iess', nombre: 'Tramitador del IESS' },
  { id: 'otro', nombre: 'Otro' }
];

export function nombreConcepto(concepto: ConceptoTercero): string {
  return CONCEPTOS_TERCERO.find(c => c.id === concepto)?.nombre ?? concepto;
}

// ============================================
// 🧾 Modelo
// ============================================
export interface EtapaTramite {
  estado: EstadoEtapa;
  fecha?: string; // yyyy-MM-dd
  por?: UsuarioRegistro;
}

export interface PagoTramite {
  monto: number;
  fecha: string; // yyyy-MM-dd
  comprobante?: string;
  nota?: string;
  registradoPor: UsuarioRegistro;
}

export interface CostoTercero {
  id: string;
  concepto: ConceptoTercero;
  tercero: string; // a quién se le paga
  detalle?: string;
  monto: number; // lo pactado
  pagos: PagoTramite[];
}

export interface GestionTramite {
  fecha: Date | any;
  texto: string;
  tipo: 'nota' | 'sistema'; // 'sistema' = línea automática (etapa, pago, cierre)
  registradoPor: UsuarioRegistro;
}

export interface Tramite {
  id?: string; // ID del documento
  clienteNombre: string;
  clienteRuc?: string;
  telefono?: string;
  contacto?: string; // quién del lado del cliente lleva el trámite (él mismo, un familiar, el representante...)
  tipo: TipoTramite;
  tipoDetalle?: string; // solo en 'otro': qué trámite es
  estado: EstadoTramite;
  fechaCierre?: string; // yyyy-MM-dd
  motivoCierre?: string;
  etapas?: Record<string, EtapaTramite>; // sin entrada = pendiente
  esperandoAManual?: EsperandoA; // si no se quiere el que sale de la etapa actual
  pendiente?: string; // qué falta
  // Lo que se cobra al cliente. `montoAnular` y `porcentaje` son solo la
  // referencia con la que se negoció el honorario (no se calculan solos: el
  // sistema no tiene los valores actualizados).
  honorario: number;
  montoAnular?: number;
  porcentaje?: number;
  pagos: PagoTramite[];
  costosTerceros: CostoTercero[];
  nroIngreso?: string; // gestión documental
  fechaPresentacion?: string; // yyyy-MM-dd
  nroResolucion?: string;
  fechaResolucion?: string; // yyyy-MM-dd
  gestiones: GestionTramite[];
  origenTramiteId?: string; // la radiografía de la que sale este trámite
  creadoPor: UsuarioRegistro;
  fechaCreacion: Date | any;
  ultimoMovimiento: Date | any;
}

// ============================================
// 🔧 Auxiliares
// ============================================
export const redondear = (n: number) => Math.round(n * 100) / 100;

// Firestore devuelve Timestamps; la app trabaja con Date.
export function aFecha(valor: any): Date | undefined {
  if (!valor) return undefined;
  const fecha = valor.toDate ? valor.toDate() : valor;
  return fecha instanceof Date && !isNaN(fecha.getTime()) ? fecha : undefined;
}

const esFechaIso = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v + 'T00:00:00Z').getTime());

// Firestore no admite `undefined` dentro de un objeto.
function sinIndefinidos<T extends object>(obj: T): T {
  const limpio: Record<string, any> = {};
  Object.entries(obj).forEach(([clave, valor]) => { if (valor !== undefined) limpio[clave] = valor; });
  return limpio as T;
}

export function etiquetaTipo(t: Pick<Tramite, 'tipo' | 'tipoDetalle'>): string {
  return t.tipo === 'otro' && t.tipoDetalle ? t.tipoDetalle : defTipo(t.tipo).nombre;
}

// Un cliente se reconoce por su RUC o cédula; si no tiene, por su nombre.
export function claveCliente(t: Pick<Tramite, 'clienteRuc' | 'clienteNombre'>): string {
  return t.clienteRuc || normalizarBusqueda(t.clienteNombre);
}

// ============================================
// 🪜 Etapas
// ============================================
export interface EtapaVista { def: DefEtapa; estado: EstadoEtapa; fecha?: string; por?: UsuarioRegistro }

export function etapasDe(t: Pick<Tramite, 'tipo' | 'etapas'>): EtapaVista[] {
  return defTipo(t.tipo).etapas.map(def => {
    const guardada = t.etapas?.[def.id];
    return { def, estado: guardada?.estado ?? 'pendiente', fecha: guardada?.fecha, por: guardada?.por };
  });
}

// La primera que falta (en el orden del tipo de trámite).
export function etapaActual(t: Pick<Tramite, 'tipo' | 'etapas'>): DefEtapa | null {
  return etapasDe(t).find(e => e.estado === 'pendiente')?.def ?? null;
}

export function progresoEtapas(t: Pick<Tramite, 'tipo' | 'etapas'>): { hechas: number; total: number } {
  const vigentes = etapasDe(t).filter(e => e.estado !== 'omitida');
  return { hechas: vigentes.filter(e => e.estado === 'hecha').length, total: vigentes.length };
}

// A quién se está esperando: el que se fijó a mano, o el de la etapa actual.
// Un trámite cerrado no espera a nadie.
export function esperandoA(t: Pick<Tramite, 'tipo' | 'etapas' | 'estado' | 'esperandoAManual'>): EsperandoA | null {
  if (t.estado !== 'en_curso') return null;
  return t.esperandoAManual ?? etapaActual(t)?.esperandoA ?? 'oficina';
}

// El concepto de costo que sugiere la etapa en la que va el trámite.
export function conceptoSugerido(t: Pick<Tramite, 'tipo' | 'etapas'>): ConceptoTercero {
  return etapaActual(t)?.concepto ?? 'otro';
}

// ============================================
// 💵 Totales
// ============================================
export const totalPagos = (pagos: PagoTramite[] | undefined) => redondear((pagos ?? []).reduce((s, p) => s + p.monto, 0));

export interface TotalesCosto { pactado: number; pagado: number; porPagar: number }

export function totalesCosto(c: CostoTercero): TotalesCosto {
  const pagado = totalPagos(c.pagos);
  return { pactado: c.monto, pagado, porPagar: Math.max(0, redondear(c.monto - pagado)) };
}

export interface TotalesTramite {
  cobrado: number;
  porCobrar: number;
  pactadoTerceros: number;
  pagadoTerceros: number;
  porPagarTerceros: number;
  utilidad: number; // honorario menos lo pactado con terceros
}

export function totalesDe(t: Pick<Tramite, 'honorario' | 'pagos' | 'costosTerceros'>): TotalesTramite {
  const cobrado = totalPagos(t.pagos);
  const costos = (t.costosTerceros ?? []).map(totalesCosto);
  const pactadoTerceros = redondear(costos.reduce((s, c) => s + c.pactado, 0));
  return {
    cobrado,
    porCobrar: Math.max(0, redondear((t.honorario ?? 0) - cobrado)),
    pactadoTerceros,
    pagadoTerceros: redondear(costos.reduce((s, c) => s + c.pagado, 0)),
    porPagarTerceros: redondear(costos.reduce((s, c) => s + c.porPagar, 0)),
    utilidad: redondear((t.honorario ?? 0) - pactadoTerceros)
  };
}

// Días desde el último movimiento; solo tiene sentido en un trámite en curso.
export function diasSinMovimiento(t: Pick<Tramite, 'estado' | 'ultimoMovimiento'>, ahora: Date): number | null {
  if (t.estado !== 'en_curso') return null;
  const ultimo = aFecha(t.ultimoMovimiento);
  if (!ultimo) return null;
  return Math.max(0, Math.floor((ahora.getTime() - ultimo.getTime()) / 86400000));
}

export const requiereSeguimiento = (t: Pick<Tramite, 'estado' | 'ultimoMovimiento'>, ahora: Date) =>
  (diasSinMovimiento(t, ahora) ?? 0) >= DIAS_SIN_MOVIMIENTO;

export interface ResumenTramites {
  enCurso: number; // casos (clientes) que todavía tienen algo abierto
  porCobrar: number; // un trámite desistido no se cobra
  porPagarTerceros: number; // a los terceros se les debe aunque el cliente desista
  sinMovimiento: number;
}

export function resumenDe(lista: Tramite[], ahora: Date): ResumenTramites {
  const r: ResumenTramites = { enCurso: 0, porCobrar: 0, porPagarTerceros: 0, sinMovimiento: 0 };
  for (const t of lista) {
    const tot = totalesDe(t);
    if (t.estado !== 'desistido') r.porCobrar += tot.porCobrar;
    r.porPagarTerceros += tot.porPagarTerceros;
    if (requiereSeguimiento(t, ahora)) r.sinMovimiento++;
  }
  r.enCurso = casosPorCliente(lista).filter(caso => estadoCaso(caso) === 'en_curso').length;
  r.porCobrar = redondear(r.porCobrar);
  r.porPagarTerceros = redondear(r.porPagarTerceros);
  return r;
}

// ============================================
// 👤 Casos agrupados por cliente
// ============================================
// Un cliente tiene un caso con varias etapas (radiografía, SUT, acta,
// anulación...), cada una su propio trámite. Que una etapa esté completa no
// significa que el caso haya terminado.
export interface GrupoCliente {
  clave: string;
  nombre: string;
  clienteRuc?: string;
  telefono?: string;
  contacto?: string;
  tramites: Tramite[]; // todas las etapas del caso, en orden
  estado: EstadoTramite; // del caso completo (ver estadoCaso)
  enCurso: number;
  terminados: number;
  desistidos: number;
  esperando: EsperandoA[]; // a quién se espera en los que siguen en curso
  honorario: number; // un trámite desistido no se cobra
  cobrado: number;
  porCobrar: number;
  porPagarTerceros: number;
  dias: number | null; // días del trámite en curso con más tiempo sin moverse
  seguimiento: boolean;
}

const RANGO_TIPO: Record<TipoTramite, number> = {
  radiografia: 0, otro: 1, anulacion_ruc: 2, anulacion_conyuges: 2, anulacion_finiquito: 2
};
const RANGO_ESTADO: Record<EstadoTramite, number> = { terminado: 0, desistido: 1, en_curso: 2 };

// Las etapas de un caso se leen en orden: primero la radiografía, luego los
// pasos previos (SUT, actas) y al final la anulación; dentro de cada una, lo
// ya terminado antes que lo que sigue en curso.
export function ordenarEtapasCaso(a: Tramite, b: Tramite): number {
  return RANGO_TIPO[a.tipo] - RANGO_TIPO[b.tipo]
    || RANGO_ESTADO[a.estado] - RANGO_ESTADO[b.estado]
    || (aFecha(a.fechaCreacion)?.getTime() ?? 0) - (aFecha(b.fechaCreacion)?.getTime() ?? 0)
    || etiquetaTipo(a).localeCompare(etiquetaTipo(b));
}

export function casosPorCliente(lista: Tramite[]): Tramite[][] {
  const porCliente = new Map<string, Tramite[]>();
  lista.forEach(t => porCliente.set(claveCliente(t), [...(porCliente.get(claveCliente(t)) ?? []), t]));
  return [...porCliente.values()];
}

// Un caso sigue en curso mientras alguna etapa esté abierta. Cuando ya no
// queda ninguna, el estado es el de su última etapa (la anulación, o el
// trámite que sea): terminado si salió la resolución, desistió si el cliente
// no siguió. Una radiografía sola no cierra el caso: falta saber si el
// cliente sigue con la anulación o desiste.
export function estadoCaso(tramites: Tramite[]): EstadoTramite {
  if (tramites.some(t => t.estado === 'en_curso')) return 'en_curso';
  const ordenadas = [...tramites].sort(ordenarEtapasCaso);
  const ultima = ordenadas[ordenadas.length - 1];
  if (!ultima) return 'en_curso';
  return ultima.tipo === 'radiografia' && ultima.estado === 'terminado' ? 'en_curso' : ultima.estado;
}

// El filtro decide qué clientes se ven, no qué etapas: un cliente con algún
// trámite que pasa el filtro sale con todo su caso (una radiografía ya
// terminada sigue siendo parte del caso que está en curso). `estado` filtra
// por el estado del caso, no el de una etapa.
export function agruparPorCliente(visibles: Tramite[], todos: Tramite[], ahora: Date, estado: EstadoTramite | null = null): GrupoCliente[] {
  // Los grupos salen en el orden en que aparece su primer trámite visible.
  const claves = [...new Set(visibles.map(claveCliente))];
  const porCliente = new Map<string, Tramite[]>(claves.map(clave => [clave, []]));
  todos.forEach(t => porCliente.get(claveCliente(t))?.push(t));

  const grupos = [...porCliente].map(([clave, lista]) => {
    const tramites = [...lista].sort(ordenarEtapasCaso);
    const enCurso = tramites.filter(t => t.estado === 'en_curso');
    const vigentes = tramites.filter(t => t.estado !== 'desistido');
    const dias = enCurso.map(t => diasSinMovimiento(t, ahora) ?? 0);
    const esperando = (Object.keys(ETIQUETAS_ESPERANDO) as EsperandoA[])
      .filter(e => enCurso.some(t => esperandoA(t) === e));

    return {
      clave,
      nombre: tramites[0].clienteNombre,
      clienteRuc: tramites.find(t => t.clienteRuc)?.clienteRuc,
      telefono: tramites.find(t => t.telefono)?.telefono,
      contacto: tramites.find(t => t.contacto)?.contacto,
      tramites,
      estado: estadoCaso(tramites),
      enCurso: enCurso.length,
      terminados: tramites.filter(t => t.estado === 'terminado').length,
      desistidos: tramites.filter(t => t.estado === 'desistido').length,
      esperando,
      honorario: redondear(vigentes.reduce((s, t) => s + (t.honorario ?? 0), 0)),
      cobrado: redondear(tramites.reduce((s, t) => s + totalesDe(t).cobrado, 0)),
      porCobrar: redondear(vigentes.reduce((s, t) => s + totalesDe(t).porCobrar, 0)),
      porPagarTerceros: redondear(tramites.reduce((s, t) => s + totalesDe(t).porPagarTerceros, 0)),
      dias: dias.length > 0 ? Math.max(...dias) : null,
      seguimiento: enCurso.some(t => requiereSeguimiento(t, ahora))
    };
  });
  return estado ? grupos.filter(g => g.estado === estado) : grupos;
}

// ============================================
// 🔎 Filtros de la lista
// ============================================
export interface FiltrosTramites {
  texto?: string;
  tipo?: TipoTramite | null;
  estado?: EstadoTramite | null; // null = todos
  esperandoA?: EsperandoA | null;
  soloSinMovimiento?: boolean;
}

function pajar(t: Tramite): string {
  return normalizarBusqueda([
    t.clienteNombre, t.clienteRuc, t.telefono, t.contacto, etiquetaTipo(t), t.nroIngreso, t.nroResolucion
  ].filter(Boolean).join(' '));
}

export function filtrarTramites(lista: Tramite[], f: FiltrosTramites, ahora: Date): Tramite[] {
  const palabras = normalizarBusqueda(f.texto ?? '').split(' ').filter(Boolean);
  return lista.filter(t => {
    if (f.tipo && t.tipo !== f.tipo) return false;
    if (f.estado && t.estado !== f.estado) return false;
    if (f.esperandoA && esperandoA(t) !== f.esperandoA) return false;
    if (f.soloSinMovimiento && !requiereSeguimiento(t, ahora)) return false;
    if (palabras.length > 0) {
      const texto = pajar(t);
      if (!palabras.every(p => texto.includes(p))) return false;
    }
    return true;
  });
}

// ============================================
// ✍️ Datos del trámite (alta y edición)
// ============================================
export interface DatosTramite {
  clienteNombre: string;
  clienteRuc?: string | null;
  telefono?: string | null;
  contacto?: string | null;
  tipo: TipoTramite;
  tipoDetalle?: string | null;
  honorario?: number | null;
  montoAnular?: number | null;
  porcentaje?: number | null;
  nroIngreso?: string | null;
  fechaPresentacion?: string | null;
  nroResolucion?: string | null;
  fechaResolucion?: string | null;
  pendiente?: string | null;
  esperandoAManual?: EsperandoA | null;
  origenTramiteId?: string | null;
}

export interface DatosNormalizados {
  valores: Record<string, any>; // lo que se guarda
  borrar: string[]; // campos opcionales que quedaron vacíos
}

const CAMPOS_TEXTO = ['telefono', 'contacto', 'nroIngreso', 'nroResolucion', 'pendiente', 'origenTramiteId'] as const;
const CAMPOS_FECHA = ['fechaPresentacion', 'fechaResolucion'] as const;
const CAMPOS_NUMERO = ['montoAnular', 'porcentaje'] as const;

// Valida y deja los datos listos para guardar. Lo que viene vacío no se guarda
// (en una edición se borra del documento). Solo se tocan los campos que
// vienen en `datos`, así una edición parcial no pisa el resto.
export function normalizarDatos(datos: Partial<DatosTramite>): DatosNormalizados {
  const valores: Record<string, any> = {};
  const borrar: string[] = [];
  const poner = (campo: string, valor: unknown) => (valor === undefined || valor === null || valor === '' ? borrar.push(campo) : (valores[campo] = valor));

  if (datos.clienteNombre !== undefined) {
    const nombre = normalizarNombre(datos.clienteNombre ?? '');
    if (!nombre) throw new Error('El nombre del cliente es obligatorio.');
    valores['clienteNombre'] = nombre;
  }

  if (datos.clienteRuc !== undefined) {
    const ruc = normalizarRuc(datos.clienteRuc ?? '');
    if (ruc && !esRucValido(ruc)) throw new Error('El RUC o la cédula debe tener 10 o 13 dígitos.');
    poner('clienteRuc', ruc);
  }

  if (datos.tipo !== undefined) {
    if (!TIPOS_TRAMITE.some(t => t.id === datos.tipo)) throw new Error('Elige el tipo de trámite.');
    valores['tipo'] = datos.tipo;
  }
  if (datos.tipoDetalle !== undefined || datos.tipo !== undefined) {
    const detalle = (datos.tipoDetalle ?? '').trim();
    if (datos.tipo === 'otro' && !detalle) throw new Error('Escribe qué trámite es.');
    // Solo el tipo "otro" lleva detalle: al cambiar a otro tipo se borra.
    poner('tipoDetalle', datos.tipo !== undefined && datos.tipo !== 'otro' ? '' : detalle);
  }

  CAMPOS_TEXTO.forEach(campo => {
    if (datos[campo] !== undefined) poner(campo, (datos[campo] ?? '').toString().trim().replace(/\s+/g, ' '));
  });

  CAMPOS_FECHA.forEach(campo => {
    const v = datos[campo];
    if (v === undefined) return;
    if (v && !esFechaIso(v)) throw new Error('La fecha no es válida.');
    poner(campo, v);
  });

  if (datos.honorario !== undefined) {
    const h = datos.honorario ?? 0;
    if (!Number.isFinite(h) || h < 0) throw new Error('El honorario no puede ser negativo.');
    valores['honorario'] = redondear(h);
  }
  CAMPOS_NUMERO.forEach(campo => {
    const v = datos[campo];
    if (v === undefined) return;
    if (v !== null && (!Number.isFinite(v) || v < 0)) throw new Error('Los montos y porcentajes no pueden ser negativos.');
    if (campo === 'porcentaje' && v !== null && v > 100) throw new Error('El porcentaje no puede pasar de 100.');
    poner(campo, v === null ? null : redondear(v));
  });

  if (datos.esperandoAManual !== undefined) poner('esperandoAManual', datos.esperandoAManual);

  return { valores, borrar };
}

export function tramiteNuevo(datos: DatosTramite, usuario: UsuarioRegistro, ahora: Date): Omit<Tramite, 'id'> {
  // El nombre y el tipo son obligatorios en DatosTramite, así que siempre vienen.
  const valores = normalizarDatos(datos).valores as Pick<Tramite, 'clienteNombre' | 'tipo'> & Partial<Tramite>;
  return {
    honorario: 0,
    ...valores,
    estado: 'en_curso',
    etapas: {},
    pagos: [],
    costosTerceros: [],
    gestiones: [{ fecha: ahora, texto: 'Trámite creado', tipo: 'sistema', registradoPor: usuario }],
    creadoPor: usuario,
    fechaCreacion: ahora,
    ultimoMovimiento: ahora
  };
}

// ============================================
// 🔁 Cambios por acción
// ============================================
export interface CambiosTramite {
  cambios: Record<string, any>; // lo que se guarda
  quitar: string[]; // campos que se borran
}

// Todo movimiento deja su línea en las gestiones y actualiza el último movimiento.
function conGestion(
  t: Tramite,
  cambios: Record<string, any>,
  texto: string,
  usuario: UsuarioRegistro,
  ahora: Date,
  tipo: GestionTramite['tipo'] = 'sistema',
  quitar: string[] = []
): CambiosTramite {
  const gestion: GestionTramite = { fecha: ahora, texto, tipo, registradoPor: usuario };
  return {
    cambios: { ...cambios, gestiones: [...(t.gestiones ?? []), gestion], ultimoMovimiento: ahora },
    quitar
  };
}

export function cambiosAlAgregarGestion(t: Tramite, texto: string, usuario: UsuarioRegistro, ahora: Date): CambiosTramite {
  const limpio = texto.trim();
  if (!limpio) throw new Error('Escribe la gestión.');
  if (limpio.length > 2000) throw new Error('La gestión es demasiado larga (máximo 2000 caracteres).');
  return conGestion(t, {}, limpio, usuario, ahora, 'nota');
}

export function cambiosAlCambiarEtapa(
  t: Tramite,
  etapaId: string,
  estado: EstadoEtapa,
  usuario: UsuarioRegistro,
  ahora: Date,
  hoyIso: string
): CambiosTramite {
  if (t.estado !== 'en_curso') throw new Error('Reabre el trámite para cambiar sus etapas.');
  const def = defTipo(t.tipo).etapas.find(e => e.id === etapaId);
  if (!def) throw new Error('Esa etapa no existe en este tipo de trámite.');

  const etapas = { ...(t.etapas ?? {}) };
  if (estado === 'pendiente') delete etapas[etapaId];
  else etapas[etapaId] = { estado, fecha: hoyIso, por: usuario };

  const texto = estado === 'hecha' ? `Etapa «${def.nombre}» completada`
    : estado === 'omitida' ? `Etapa «${def.nombre}» omitida`
    : `Etapa «${def.nombre}» vuelve a pendiente`;
  return conGestion(t, { etapas }, texto, usuario, ahora);
}

export interface EntradaPagoTramite { monto: number; fecha: string; comprobante?: string; nota?: string }

function pagoDe(entrada: EntradaPagoTramite, usuario: UsuarioRegistro): PagoTramite {
  if (!Number.isFinite(entrada.monto) || entrada.monto <= 0) throw new Error('El monto debe ser mayor a cero.');
  if (!esFechaIso(entrada.fecha)) throw new Error('La fecha del pago no es válida.');
  return sinIndefinidos({
    monto: redondear(entrada.monto),
    fecha: entrada.fecha,
    comprobante: entrada.comprobante?.trim() || undefined,
    nota: entrada.nota?.trim() || undefined,
    registradoPor: usuario
  });
}

const detallePago = (p: PagoTramite) => `${formatoMoneda(p.monto)}${p.comprobante ? ` (comprobante ${p.comprobante})` : ''}`;

export function cambiosAlRegistrarPago(t: Tramite, entrada: EntradaPagoTramite, usuario: UsuarioRegistro, ahora: Date): CambiosTramite {
  const pago = pagoDe(entrada, usuario);
  return conGestion(t, { pagos: [...(t.pagos ?? []), pago] }, `Cobro al cliente: ${detallePago(pago)}`, usuario, ahora);
}

export function cambiosAlReversarPago(t: Tramite, indice: number, usuario: UsuarioRegistro, ahora: Date): CambiosTramite {
  const pagos = t.pagos ?? [];
  if (indice < 0 || indice >= pagos.length) throw new Error('El pago ya no existe.');
  const quitado = pagos[indice];
  return conGestion(
    t,
    { pagos: pagos.filter((_, i) => i !== indice) },
    `Cobro reversado: ${detallePago(quitado)} del ${fechaCorta(quitado.fecha)}`,
    usuario,
    ahora
  );
}

export interface EntradaCosto { id: string; concepto: ConceptoTercero; tercero: string; detalle?: string; monto: number }

export function cambiosAlGuardarCosto(t: Tramite, entrada: EntradaCosto, usuario: UsuarioRegistro, ahora: Date): CambiosTramite {
  const tercero = normalizarNombre(entrada.tercero ?? '');
  if (!tercero) throw new Error('Escribe a quién se le paga.');
  if (!CONCEPTOS_TERCERO.some(c => c.id === entrada.concepto)) throw new Error('Elige el concepto del costo.');
  if (!Number.isFinite(entrada.monto) || entrada.monto <= 0) throw new Error('El monto pactado debe ser mayor a cero.');

  const costos = t.costosTerceros ?? [];
  const existente = costos.find(c => c.id === entrada.id);
  const costo: CostoTercero = sinIndefinidos({
    id: entrada.id,
    concepto: entrada.concepto,
    tercero,
    detalle: entrada.detalle?.trim() || undefined,
    monto: redondear(entrada.monto),
    pagos: existente?.pagos ?? []
  });
  const lista = existente ? costos.map(c => (c.id === entrada.id ? costo : c)) : [...costos, costo];
  const texto = `${existente ? 'Costo a tercero actualizado' : 'Costo a tercero agregado'}: ${nombreConcepto(costo.concepto)} — ${tercero}, ${formatoMoneda(costo.monto)}`;
  return conGestion(t, { costosTerceros: lista }, texto, usuario, ahora);
}

function costoPorId(t: Tramite, costoId: string): CostoTercero {
  const costo = (t.costosTerceros ?? []).find(c => c.id === costoId);
  if (!costo) throw new Error('Ese costo ya no existe.');
  return costo;
}

// Con pagos registrados no se borra: primero se reversan (así no se pierde sin querer el historial).
export function cambiosAlQuitarCosto(t: Tramite, costoId: string, usuario: UsuarioRegistro, ahora: Date): CambiosTramite {
  const costo = costoPorId(t, costoId);
  if (costo.pagos.length > 0) throw new Error('Reversa primero los pagos de este costo.');
  return conGestion(
    t,
    { costosTerceros: t.costosTerceros.filter(c => c.id !== costoId) },
    `Costo a tercero quitado: ${nombreConcepto(costo.concepto)} — ${costo.tercero}`,
    usuario,
    ahora
  );
}

export function cambiosAlPagarTercero(t: Tramite, costoId: string, entrada: EntradaPagoTramite, usuario: UsuarioRegistro, ahora: Date): CambiosTramite {
  const costo = costoPorId(t, costoId);
  const pago = pagoDe(entrada, usuario);
  const lista = t.costosTerceros.map(c => (c.id === costoId ? { ...c, pagos: [...c.pagos, pago] } : c));
  return conGestion(t, { costosTerceros: lista }, `Pago a ${costo.tercero} (${nombreConcepto(costo.concepto)}): ${detallePago(pago)}`, usuario, ahora);
}

export function cambiosAlReversarPagoTercero(t: Tramite, costoId: string, indice: number, usuario: UsuarioRegistro, ahora: Date): CambiosTramite {
  const costo = costoPorId(t, costoId);
  if (indice < 0 || indice >= costo.pagos.length) throw new Error('El pago ya no existe.');
  const quitado = costo.pagos[indice];
  const lista = t.costosTerceros.map(c => (c.id === costoId ? { ...c, pagos: c.pagos.filter((_, i) => i !== indice) } : c));
  return conGestion(
    t,
    { costosTerceros: lista },
    `Pago reversado a ${costo.tercero} (${nombreConcepto(costo.concepto)}): ${detallePago(quitado)} del ${fechaCorta(quitado.fecha)}`,
    usuario,
    ahora
  );
}

export function cambiosAlCerrar(
  t: Tramite,
  estado: 'terminado' | 'desistido',
  motivo: string | undefined,
  usuario: UsuarioRegistro,
  ahora: Date,
  hoyIso: string
): CambiosTramite {
  if (t.estado !== 'en_curso') throw new Error('El trámite ya está cerrado.');
  const limpio = motivo?.trim();
  const cambios: Record<string, any> = { estado, fechaCierre: hoyIso };
  if (limpio) cambios['motivoCierre'] = limpio;
  const texto = estado === 'terminado' ? 'Trámite terminado' : `Trámite desistido${limpio ? `: ${limpio}` : ''}`;
  return conGestion(t, cambios, texto, usuario, ahora, 'sistema', limpio ? [] : ['motivoCierre']);
}

export function cambiosAlReabrir(t: Tramite, usuario: UsuarioRegistro, ahora: Date): CambiosTramite {
  if (t.estado === 'en_curso') throw new Error('El trámite ya está en curso.');
  return conGestion(t, { estado: 'en_curso' }, 'Trámite reabierto', usuario, ahora, 'sistema', ['fechaCierre', 'motivoCierre']);
}
