// Importar trámites desde Excel: columnas de la plantilla, lectura de la hoja
// y armado de lo que se guarda (sin Angular ni Firestore, para poder
// probarlo). Una fila = un trámite; cada etapa de un caso (radiografía, SUT,
// acta, anulación...) es su propia fila. Los trámites de un mismo cliente se
// reconocen por su RUC (o por el nombre, si no tiene) y la anulación queda
// enlazada con la radiografía de la que sale.

import { normalizarBusqueda, normalizarNombre } from '../coactivados/coactivados.util';
import { Celda, TablaHoja, normalizarEncabezado, parseFechaISO, parseMonto, textoCelda } from '../titulosCredito/importador-titulos.util';
import { FormatoColumna } from '../titulosCredito/plantilla-titulos.util';
import { normalizarRuc } from '../titulosCredito/titulos-credito.util';
import {
  CONCEPTOS_TERCERO,
  ConceptoTercero,
  CostoTercero,
  DatosTramite,
  ETIQUETAS_ESPERANDO,
  EsperandoA,
  EstadoTramite,
  EtapaTramite,
  GestionTramite,
  PagoTramite,
  TIPOS_TRAMITE,
  Tramite,
  TipoTramite,
  UsuarioRegistro,
  claveCliente,
  defTipo,
  normalizarDatos,
  tramiteNuevo
} from './tramites-iess.util';

export const HOJA_TRAMITES = 'Trámites';
export const HOJA_INSTRUCCIONES_TRAMITES = 'Instrucciones';
export const HOJA_LISTAS_TRAMITES = 'Listas';
export const NOMBRE_PLANTILLA_TRAMITES = 'Plantilla importar tramites IESS.xlsx';

export type CampoTramite =
  | 'cliente' | 'ruc' | 'telefono' | 'contacto'
  | 'tipo' | 'detalle'
  | 'honorario' | 'cobrado'
  | 'concepto' | 'tercero' | 'pactado' | 'pagadoTercero'
  | 'etapa' | 'estado' | 'esperando' | 'pendiente'
  | 'nroIngreso' | 'fechaPresentacion' | 'nroResolucion' | 'fechaResolucion'
  | 'notas';

export interface ColumnaTramites {
  campo: CampoTramite;
  encabezado: string;
  ancho: number;
  obligatoria: boolean;
  formato?: FormatoColumna;
  ayuda: string;
}

// RUC, teléfono y números del IESS van como texto: Excel se come el cero
// inicial de una cédula ("0102030405") si la celda es numérica.
export const COLUMNAS_TRAMITES: ColumnaTramites[] = [
  { campo: 'cliente', encabezado: 'Cliente', ancho: 36, obligatoria: true, ayuda: 'Nombre o razón social del cliente.' },
  { campo: 'ruc', encabezado: 'RUC/Cédula', ancho: 18, obligatoria: false, formato: 'texto', ayuda: 'Cédula (10 dígitos) o RUC (13). Con él se agrupan los trámites del mismo cliente; si el cliente no tiene, se agrupa por el nombre.' },
  { campo: 'telefono', encabezado: 'Teléfono', ancho: 14, obligatoria: false, formato: 'texto', ayuda: 'Teléfono del cliente.' },
  { campo: 'contacto', encabezado: 'Contacto', ancho: 22, obligatoria: false, ayuda: 'Quién lleva el trámite del lado del cliente (él mismo, un familiar, el representante legal...).' },
  { campo: 'tipo', encabezado: 'Tipo de trámite', ancho: 32, obligatoria: true, ayuda: 'Elígelo de la lista.' },
  { campo: 'detalle', encabezado: 'Detalle (solo en Otro)', ancho: 30, obligatoria: false, ayuda: 'Qué trámite es, cuando el tipo es "Otro trámite" (por ejemplo: Claves SUT).' },
  { campo: 'honorario', encabezado: 'Honorario', ancho: 12, obligatoria: false, formato: 'dinero', ayuda: 'Lo que se cobra al cliente por este trámite. Vacío = $0,00.' },
  { campo: 'cobrado', encabezado: 'Cobrado', ancho: 12, obligatoria: false, formato: 'dinero', ayuda: 'Lo que el cliente ya ha pagado en total. Se carga como un solo cobro.' },
  { campo: 'concepto', encabezado: 'Tercero: concepto', ancho: 20, obligatoria: false, ayuda: 'En qué se gasta con el tercero (SUT, Contrato, Acta de finiquito, Tramitador del IESS, Otro).' },
  { campo: 'tercero', encabezado: 'Tercero: nombre', ancho: 22, obligatoria: false, ayuda: 'A quién se le paga. Si no se sabe, se guarda como POR DEFINIR.' },
  { campo: 'pactado', encabezado: 'Tercero: pactado', ancho: 14, obligatoria: false, formato: 'dinero', ayuda: 'Lo acordado con el tercero.' },
  { campo: 'pagadoTercero', encabezado: 'Tercero: pagado', ancho: 14, obligatoria: false, formato: 'dinero', ayuda: 'Lo que ya se le pagó al tercero. Se carga como un solo pago.' },
  { campo: 'etapa', encabezado: 'Etapa actual', ancho: 36, obligatoria: false, ayuda: 'La etapa en la que va ahora (la primera que falta). Las anteriores se marcan como hechas. Vacío = todavía no inicia.' },
  { campo: 'estado', encabezado: 'Estado', ancho: 14, obligatoria: false, ayuda: 'En curso, Terminado o Desistido. Vacío = En curso. Un trámite Terminado tiene todas sus etapas hechas.' },
  { campo: 'esperando', encabezado: 'Esperando a', ancho: 14, obligatoria: false, ayuda: 'Cliente, Tercero, IESS u Oficina. Solo si no es el que corresponde a la etapa actual (por ejemplo, esperando que el cliente pague).' },
  { campo: 'pendiente', encabezado: 'Qué falta', ancho: 40, obligatoria: false, ayuda: 'Lo que falta para avanzar, en una frase.' },
  { campo: 'nroIngreso', encabezado: 'Nro. de ingreso (IESS)', ancho: 26, obligatoria: false, formato: 'texto', ayuda: 'Número con el que ingresó a gestión documental (IESS-SDNGD-…-E).' },
  { campo: 'fechaPresentacion', encabezado: 'Fecha de presentación', ancho: 20, obligatoria: false, formato: 'fecha', ayuda: 'Fecha en que se ingresó al IESS, con formato dd/mm/aaaa.' },
  { campo: 'nroResolucion', encabezado: 'Nro. de resolución', ancho: 26, obligatoria: false, formato: 'texto', ayuda: 'Número de la resolución del IESS (IESS-CPCCP-…-M).' },
  { campo: 'fechaResolucion', encabezado: 'Fecha de resolución', ancho: 20, obligatoria: false, formato: 'fecha', ayuda: 'Fecha de la resolución, con formato dd/mm/aaaa.' },
  { campo: 'notas', encabezado: 'Notas', ancho: 44, obligatoria: false, ayuda: 'Cualquier detalle del caso. Queda como la primera gestión del trámite.' }
];

export type FilaPlantillaTramite = Partial<Record<CampoTramite, string | number | Date>>;

export const ESTADOS_TRAMITE: { id: EstadoTramite; nombre: string }[] = [
  { id: 'en_curso', nombre: 'En curso' },
  { id: 'terminado', nombre: 'Terminado' },
  { id: 'desistido', nombre: 'Desistido' }
];

export const OPCIONES_ESPERANDO: { id: EsperandoA; nombre: string }[] =
  (Object.keys(ETIQUETAS_ESPERANDO) as EsperandoA[]).map(id => ({ id, nombre: ETIQUETAS_ESPERANDO[id].texto }));

// Filas de texto de la hoja de instrucciones: [título, detalle].
export function filasInstruccionesTramites(): [string, string][] {
  return [
    ['Cómo llenar la plantilla', `Una fila por trámite, en la hoja "${HOJA_TRAMITES}". Si un cliente tiene varias etapas (una radiografía y después su anulación, por ejemplo), cada una va en su fila con el mismo RUC. Esta hoja de instrucciones no se carga.`],
    ...COLUMNAS_TRAMITES.map(c => [c.encabezado + (c.obligatoria ? ' (obligatorio)' : ''), c.ayuda] as [string, string]),
    ...TIPOS_TRAMITE.map(t => [`Etapas de «${t.nombre}»`, t.etapas.map(e => e.nombre).join(' → ')] as [string, string]),
    ['Al subir el archivo', 'Se muestra una vista previa agrupada por cliente. Los trámites que ya están cargados se detectan y no se duplican, y nada se guarda hasta que confirmes.']
  ];
}

// ============================================
// 🔎 Lectura de la hoja
// ============================================
export interface TramiteImportable {
  fila: number; // número de fila en el Excel (1 = encabezado)
  datos: DatosTramite;
  estado: EstadoTramite;
  etapasHechas: string[]; // ids de las etapas ya hechas
  cobrado: number;
  costo?: { concepto: ConceptoTercero; tercero: string; pactado: number; pagado: number };
  nota?: string;
}

export interface AvisoImportacion { fila: number; mensaje: string }

export interface LecturaTramites {
  hoja: string;
  items: TramiteImportable[];
  errores: AvisoImportacion[]; // la fila no se carga
  avisos: AvisoImportacion[]; // la fila se carga, pero conviene revisarla
}

const ENCABEZADOS: Record<string, CampoTramite> = {
  'razon social': 'cliente', 'nombre': 'cliente',
  'ruc': 'ruc', 'cedula': 'ruc',
  'tipo': 'tipo', 'detalle': 'detalle',
  'etapa': 'etapa', 'esperando': 'esperando'
};
COLUMNAS_TRAMITES.forEach(c => { ENCABEZADOS[normalizarEncabezado(c.encabezado)] = c.campo; });

type Columnas = Partial<Record<CampoTramite, number>>;

function columnasDe(fila: Celda[]): Columnas | null {
  const columnas: Columnas = {};
  fila.forEach((celda, j) => {
    const campo = ENCABEZADOS[normalizarEncabezado(textoCelda(celda))];
    if (campo && columnas[campo] === undefined) columnas[campo] = j;
  });
  return columnas.cliente !== undefined && columnas.tipo !== undefined ? columnas : null;
}

// La opción cuyo id o nombre coincide con el texto (sin tildes ni mayúsculas).
function opcionDe<T extends { id: string; nombre: string }>(opciones: T[], texto: string): T | undefined {
  const buscado = normalizarEncabezado(texto);
  return opciones.find(o => normalizarEncabezado(o.id) === buscado || normalizarEncabezado(o.nombre) === buscado);
}

const lista = (nombres: string[]) => nombres.join(', ');

export function leerTramites(tablas: TablaHoja[]): LecturaTramites | null {
  const preferidas = tablas.filter(t => normalizarEncabezado(t.nombre) === normalizarEncabezado(HOJA_TRAMITES));
  for (const hoja of [...preferidas, ...tablas]) {
    for (let i = 0; i < Math.min(hoja.filas.length, 15); i++) {
      const columnas = columnasDe(hoja.filas[i] ?? []);
      if (columnas) return leerHoja(hoja, i, columnas);
    }
  }
  return null;
}

function leerHoja(hoja: TablaHoja, filaEncabezado: number, columnas: Columnas): LecturaTramites {
  const lectura: LecturaTramites = { hoja: hoja.nombre, items: [], errores: [], avisos: [] };

  hoja.filas.slice(filaEncabezado + 1).forEach((celdas, k) => {
    const fila = filaEncabezado + k + 2;
    const texto = (campo: CampoTramite) => (columnas[campo] === undefined ? '' : textoCelda(celdas[columnas[campo]!]));
    if (celdas.every(c => textoCelda(c) === '')) return;

    try {
      const { item, avisos } = leerFila(fila, texto, campo => (columnas[campo] === undefined ? undefined : celdas[columnas[campo]!]));
      lectura.items.push(item);
      avisos.forEach(mensaje => lectura.avisos.push({ fila, mensaje }));
    } catch (e: any) {
      lectura.errores.push({ fila, mensaje: e?.message ?? 'La fila no se pudo leer.' });
    }
  });
  return lectura;
}

function montoOpcional(celda: Celda, nombre: string): number {
  if (textoCelda(celda) === '') return 0;
  const monto = parseMonto(celda);
  if (monto === null || monto < 0) throw new Error(`${nombre}: el monto no es válido.`);
  return monto;
}

function fechaOpcional(celda: Celda, nombre: string): string | undefined {
  if (textoCelda(celda) === '') return undefined;
  const fecha = parseFechaISO(celda);
  if (!fecha) throw new Error(`${nombre}: la fecha no es válida (usa dd/mm/aaaa).`);
  return fecha;
}

function leerFila(
  fila: number,
  texto: (campo: CampoTramite) => string,
  crudo: (campo: CampoTramite) => Celda
): { item: TramiteImportable; avisos: string[] } {
  const avisos: string[] = [];

  if (!texto('cliente')) throw new Error('Falta el nombre del cliente.');

  const tipo = opcionDe(TIPOS_TRAMITE, texto('tipo'));
  if (!tipo) throw new Error(`Tipo de trámite no reconocido (${texto('tipo') || 'vacío'}). Usa uno de: ${lista(TIPOS_TRAMITE.map(t => t.nombre))}.`);

  const estado = texto('estado') ? opcionDe(ESTADOS_TRAMITE, texto('estado')) : ESTADOS_TRAMITE[0];
  if (!estado) throw new Error(`Estado no reconocido (${texto('estado')}). Usa: ${lista(ESTADOS_TRAMITE.map(e => e.nombre))}.`);

  let esperandoAManual: EsperandoA | undefined;
  if (texto('esperando')) {
    esperandoAManual = opcionDe(OPCIONES_ESPERANDO, texto('esperando'))?.id;
    if (!esperandoAManual) throw new Error(`«Esperando a» no reconocido (${texto('esperando')}). Usa: ${lista(OPCIONES_ESPERANDO.map(o => o.nombre))}.`);
  }

  const etapas = defTipo(tipo.id).etapas;
  let etapaId: string | null = null;
  if (texto('etapa')) {
    etapaId = opcionDe(etapas, texto('etapa'))?.id ?? null;
    if (!etapaId) throw new Error(`La etapa «${texto('etapa')}» no existe en «${tipo.nombre}». Etapas: ${lista(etapas.map(e => e.nombre))}.`);
  }

  const honorario = montoOpcional(crudo('honorario'), 'Honorario');
  const cobrado = montoOpcional(crudo('cobrado'), 'Cobrado');
  if (cobrado > honorario) avisos.push(`Cobrado (${cobrado}) es mayor que el honorario (${honorario}).`);

  let costo: TramiteImportable['costo'];
  const pactadoIngresado = montoOpcional(crudo('pactado'), 'Tercero: pactado');
  const pagado = montoOpcional(crudo('pagadoTercero'), 'Tercero: pagado');
  if (pactadoIngresado > 0 || pagado > 0 || texto('tercero') || texto('concepto')) {
    const pactado = pactadoIngresado > 0 ? pactadoIngresado : pagado;
    if (pactado <= 0) throw new Error('Tercero: falta el monto pactado.');
    const concepto = texto('concepto') ? opcionDe(CONCEPTOS_TERCERO, texto('concepto')) : CONCEPTOS_TERCERO[CONCEPTOS_TERCERO.length - 1];
    if (!concepto) throw new Error(`Concepto del tercero no reconocido (${texto('concepto')}). Usa: ${lista(CONCEPTOS_TERCERO.map(c => c.nombre))}.`);
    if (pagado > pactado) avisos.push(`Lo pagado al tercero (${pagado}) es mayor que lo pactado (${pactado}).`);
    costo = { concepto: concepto.id, tercero: normalizarNombre(texto('tercero')) || 'POR DEFINIR', pactado, pagado };
  }

  const datos: DatosTramite = {
    clienteNombre: normalizarNombre(texto('cliente')),
    clienteRuc: normalizarRuc(crudo('ruc')) || null,
    telefono: texto('telefono') || null,
    contacto: texto('contacto') || null,
    tipo: tipo.id,
    tipoDetalle: texto('detalle') || null,
    honorario,
    nroIngreso: texto('nroIngreso') || null,
    fechaPresentacion: fechaOpcional(crudo('fechaPresentacion'), 'Fecha de presentación') ?? null,
    nroResolucion: texto('nroResolucion') || null,
    fechaResolucion: fechaOpcional(crudo('fechaResolucion'), 'Fecha de resolución') ?? null,
    pendiente: texto('pendiente') || null,
    esperandoAManual: esperandoAManual ?? null
  };
  // Valida RUC, detalle, fechas... con los mismos mensajes que el formulario.
  normalizarDatos(datos);

  const ids = etapas.map(e => e.id);
  const etapasHechas = estado.id === 'terminado' ? ids : etapaId ? ids.slice(0, ids.indexOf(etapaId)) : [];

  return {
    item: { fila, datos, estado: estado.id, etapasHechas, cobrado, costo, nota: texto('notas') || undefined },
    avisos
  };
}

// ============================================
// 🔗 Cliente, enlaces y duplicados
// ============================================
// La anulación sale de la radiografía del mismo cliente; si el cliente tiene
// más de una radiografía no se adivina cuál es.
export function origenesRadiografia(items: TramiteImportable[]): (number | null)[] {
  return items.map(item => {
    if (!item.datos.tipo.startsWith('anulacion')) return null;
    const clave = claveCliente({ clienteRuc: item.datos.clienteRuc ?? undefined, clienteNombre: item.datos.clienteNombre });
    const candidatas = items
      .map((otro, i) => ({ otro, i }))
      .filter(({ otro }) => otro.datos.tipo === 'radiografia'
        && claveCliente({ clienteRuc: otro.datos.clienteRuc ?? undefined, clienteNombre: otro.datos.clienteNombre }) === clave);
    return candidatas.length === 1 ? candidatas[0].i : null;
  });
}

type ParaDuplicado = {
  clienteRuc?: string | null;
  clienteNombre: string;
  tipo: TipoTramite;
  tipoDetalle?: string | null;
  honorario?: number | null;
};

function claveDuplicado(t: ParaDuplicado): string {
  return [
    claveCliente({ clienteRuc: t.clienteRuc ?? undefined, clienteNombre: t.clienteNombre }),
    t.tipo,
    normalizarBusqueda(t.tipoDetalle ?? ''),
    t.honorario ?? 0
  ].join('|');
}

// Un trámite ya cargado (o repetido más arriba en el mismo archivo) tiene el
// mismo cliente, tipo, detalle y honorario: no se vuelve a cargar.
export function marcarDuplicados(items: TramiteImportable[], existentes: Tramite[]): boolean[] {
  const vistos = new Set(existentes.map(claveDuplicado));
  return items.map(item => {
    const clave = claveDuplicado(item.datos);
    if (vistos.has(clave)) return true;
    vistos.add(clave);
    return false;
  });
}

// ============================================
// 🧱 Lo que se guarda
// ============================================
export function armarTramite(
  item: TramiteImportable,
  usuario: UsuarioRegistro,
  ahora: Date,
  hoyIso: string,
  nuevoId: () => string
): Omit<Tramite, 'id'> {
  const base = tramiteNuevo(item.datos, usuario, ahora);
  const pagoImportado = (monto: number): PagoTramite => ({
    monto,
    fecha: hoyIso,
    nota: 'Total registrado al importar desde Excel',
    registradoPor: usuario
  });

  const etapas: Record<string, EtapaTramite> = {};
  item.etapasHechas.forEach(id => { etapas[id] = { estado: 'hecha', por: usuario }; });

  const gestiones: GestionTramite[] = [{ fecha: ahora, texto: 'Trámite importado desde Excel', tipo: 'sistema', registradoPor: usuario }];
  if (item.nota) gestiones.push({ fecha: ahora, texto: item.nota.slice(0, 2000), tipo: 'nota', registradoPor: usuario });

  const costosTerceros: CostoTercero[] = item.costo
    ? [{
      id: nuevoId(),
      concepto: item.costo.concepto,
      tercero: item.costo.tercero,
      monto: item.costo.pactado,
      pagos: item.costo.pagado > 0 ? [pagoImportado(item.costo.pagado)] : []
    }]
    : [];

  const tramite: Omit<Tramite, 'id'> = {
    ...base,
    estado: item.estado,
    etapas,
    pagos: item.cobrado > 0 ? [pagoImportado(item.cobrado)] : [],
    costosTerceros,
    gestiones
  };
  // La fecha de cierre solo se conoce si hubo resolución.
  if (item.estado !== 'en_curso' && item.datos.fechaResolucion) tramite.fechaCierre = item.datos.fechaResolucion;
  return tramite;
}
