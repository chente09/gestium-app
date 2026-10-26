// Plantilla Excel para cargar títulos a mano (sin Angular ni exceljs). Los
// encabezados tienen que ser nombres que el importador ya reconoce
// (importador-titulos.util → CAMPOS_EXACTOS): si se cambia uno, el spec de la
// plantilla avisa que dejó de detectarse.

import { Campo } from './importador-titulos.util';

export const HOJA_TITULOS = 'Títulos';
export const HOJA_INSTRUCCIONES = 'Instrucciones';
export const HOJA_LISTAS = 'Listas';

export const NOMBRE_PLANTILLA = 'Plantilla importar titulos IESS.xlsx';

// Cuántas filas llevan la lista desplegable de abogados.
export const FILAS_CON_LISTA = 1000;

export type FormatoColumna = 'texto' | 'dinero';

export interface ColumnaPlantilla {
  campo: Campo;
  encabezado: string;
  ancho: number;
  obligatoria: boolean;
  formato?: FormatoColumna;
  ayuda: string;
}

// TC y RUC van como texto: Excel se come el cero inicial de una cédula
// ("0102030405") si la celda es numérica.
export const COLUMNAS_PLANTILLA: ColumnaPlantilla[] = [
  { campo: 'numero', encabezado: 'TC', ancho: 14, obligatoria: true, formato: 'texto', ayuda: 'Número del título de crédito, solo dígitos.' },
  { campo: 'ruc', encabezado: 'RUC', ancho: 16, obligatoria: true, formato: 'texto', ayuda: 'Cédula (10 dígitos) o RUC (13 dígitos) del coactivado.' },
  { campo: 'razon', encabezado: 'Razón social', ancho: 36, obligatoria: false, ayuda: 'Nombre del coactivado. Es obligatoria si el coactivado todavía no está en el sistema.' },
  { campo: 'capital', encabezado: 'Valor', ancho: 12, obligatoria: false, formato: 'dinero', ayuda: 'Capital del título. Si lo dejas vacío, se carga en $0,00.' },
  { campo: 'abogado', encabezado: 'Abogado', ancho: 22, obligatoria: false, ayuda: 'Elígelo de la lista. Si lo dejas vacío, al subir el archivo eliges una sola cartera para todo.' },
  { campo: 'representanteLegal', encabezado: 'Representante legal', ancho: 30, obligatoria: false, ayuda: 'Solo para empresas. Completa el dato si el coactivado no lo tenía; nunca pisa uno existente.' },
  { campo: 'telefono', encabezado: 'Teléfono', ancho: 16, obligatoria: false, ayuda: 'Completa el dato si el coactivado no lo tenía; nunca pisa uno existente.' },
  { campo: 'correo', encabezado: 'Correo', ancho: 30, obligatoria: false, ayuda: 'Completa el dato si el coactivado no lo tenía; nunca pisa uno existente.' }
];

export const POSICION_ABOGADO = COLUMNAS_PLANTILLA.findIndex(c => c.campo === 'abogado') + 1; // 1-based

// Los obligatorios llevan asterisco en el encabezado (el importador ignora los
// símbolos al reconocer la columna).
export function encabezadoDe(columna: ColumnaPlantilla): string {
  return columna.obligatoria ? columna.encabezado + ' *' : columna.encabezado;
}

// Filas de texto de la hoja de instrucciones: [título, detalle].
export function filasInstrucciones(): [string, string][] {
  return [
    ['Cómo llenar la plantilla', 'Una fila por título de crédito, en la hoja "' + HOJA_TITULOS + '". Las columnas con * son obligatorias. Esta hoja de instrucciones no se carga.'],
    ...COLUMNAS_PLANTILLA.map(c => [encabezadoDe(c), c.ayuda] as [string, string]),
    ['Ejemplo', 'TC 43406694 · RUC 1790012345001 · Razón social EJEMPLO S.A. · Valor 1250.50 · Abogado (de la lista)'],
    ['Al subir el archivo', 'Elige si los títulos son entregados o no entregados. Los títulos que ya están cargados se detectan solos y no se duplican, y nada se guarda hasta que confirmes.']
  ];
}
