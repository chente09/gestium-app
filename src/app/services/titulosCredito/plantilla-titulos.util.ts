// Plantilla Excel para cargar títulos de un sorteo nuevo (sin Angular ni
// exceljs). Los encabezados son los de la matriz de seguimiento, así se puede
// copiar y pegar desde ella, y tienen que ser nombres que el importador ya
// reconoce (importador-titulos.util → CAMPOS_EXACTOS / CAMPOS_POR_PREFIJO): si
// se cambia uno, el spec de la plantilla avisa que dejó de detectarse.

import { Campo } from './importador-titulos.util';

export const HOJA_TITULOS = 'Títulos';
export const HOJA_INSTRUCCIONES = 'Instrucciones';
export const HOJA_LISTAS = 'Listas';

export const NOMBRE_PLANTILLA = 'Plantilla importar titulos IESS.xlsx';

// Cuántas filas llevan la lista desplegable de abogados.
export const FILAS_CON_LISTA = 1000;

export type FormatoColumna = 'texto' | 'dinero' | 'fecha';

export interface ColumnaPlantilla {
  campo: Campo;
  encabezado: string;
  ancho: number;
  obligatoria: boolean;
  formato?: FormatoColumna;
  ayuda: string;
}

// TC, RUC y guía van como texto: Excel se come el cero inicial de una cédula
// ("0102030405") si la celda es numérica.
export const COLUMNAS_PLANTILLA: ColumnaPlantilla[] = [
  { campo: 'numero', encabezado: 'Número de Titulo de crédito', ancho: 28, obligatoria: true, formato: 'texto', ayuda: 'Número del título de crédito, solo dígitos.' },
  { campo: 'ruc', encabezado: 'Ruc/Cédula', ancho: 18, obligatoria: true, formato: 'texto', ayuda: 'Cédula (10 dígitos) o RUC (13 dígitos) del coactivado.' },
  { campo: 'razon', encabezado: 'Razón social', ancho: 36, obligatoria: false, ayuda: 'Nombre del coactivado. Es obligatoria si el coactivado todavía no está en el sistema.' },
  { campo: 'capital', encabezado: 'Valor Capital', ancho: 14, obligatoria: false, formato: 'dinero', ayuda: 'Capital del título. Si lo dejas vacío, se carga en $0,00.' },
  { campo: 'abogado', encabezado: 'Abogado', ancho: 22, obligatoria: false, ayuda: 'Elígelo de la lista. Si lo dejas vacío, al subir el archivo eliges una sola cartera para todo.' },
  { campo: 'guia', encabezado: 'No. De Guia', ancho: 16, obligatoria: false, formato: 'texto', ayuda: 'Número de la guía de legalización.' },
  { campo: 'fechaSorteo', encabezado: 'Fecha sorteo/resorteo (dd/mm/aaaa)', ancho: 34, obligatoria: false, formato: 'fecha', ayuda: 'Fecha del sorteo, con formato dd/mm/aaaa.' }
];

export const POSICION_ABOGADO = COLUMNAS_PLANTILLA.findIndex(c => c.campo === 'abogado') + 1; // 1-based

// Filas de texto de la hoja de instrucciones: [título, detalle].
export function filasInstrucciones(): [string, string][] {
  return [
    ['Cómo llenar la plantilla', 'Una fila por título de crédito, en la hoja "' + HOJA_TITULOS + '". Esta hoja de instrucciones no se carga.'],
    ...COLUMNAS_PLANTILLA.map(c => [c.encabezado + (c.obligatoria ? ' (obligatorio)' : ''), c.ayuda] as [string, string]),
    ['Ejemplo', 'Título 43406694 · Ruc/Cédula 1790012345001 · Razón social EJEMPLO S.A. · Valor Capital 1250.50 · Abogado (de la lista) · Guía 133779 · Fecha sorteo 15/10/2026'],
    ['Al subir el archivo', 'Elige si los títulos son entregados o no entregados. Los títulos que ya están cargados se detectan solos y no se duplican, y nada se guarda hasta que confirmes.']
  ];
}
