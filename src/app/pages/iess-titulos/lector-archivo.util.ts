// Lee un File (.xlsx o .csv) del navegador y lo convierte en TablaHoja[]
// para el importador. No depende de Angular ni de Firestore.

import { Celda, TablaHoja, parseCsv } from '../../services/titulosCredito/importador-titulos.util';

// exceljs pesa bastante: se carga recién al importar, no con el resto de la app.
async function cargarExcelJS(): Promise<any> {
  const modulo: any = await import('exceljs');
  return modulo.Workbook ?? modulo.default?.Workbook;
}

// Valor crudo de la celda tal cual lo necesita el importador (Celda):
// texto/número/Date directos, o el resultado/texto para fórmulas y texto enriquecido.
function valorCelda(v: unknown): Celda {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    const obj = v as any;
    if (obj.result !== undefined) return valorCelda(obj.result);
    if (obj.richText) return obj.richText.map((t: any) => t.text).join('');
    if (obj.text !== undefined) return obj.text;
    if (obj.error !== undefined) return null;
    return String(v);
  }
  return v as Celda;
}

// row.values en lugar de getCell(c) por columna: para una hoja de miles de
// filas x decenas de columnas, leer celda por celda es visiblemente más
// lento (varios minutos) que leer la fila entera de una vez.
async function leerXlsx(archivo: File): Promise<TablaHoja[]> {
  const Workbook = await cargarExcelJS();
  const libro = new Workbook();
  await libro.xlsx.load(await archivo.arrayBuffer());

  return libro.worksheets
    .filter((hoja: any) => hoja.state === 'visible')
    .map((hoja: any) => {
      const filas: Celda[][] = [];
      hoja.eachRow({ includeEmpty: false }, (row: any) => {
        // row.values es 1-based con un hueco en el índice 0.
        filas.push((row.values as unknown[]).slice(1).map(valorCelda));
      });
      return { nombre: hoja.name as string, filas };
    });
}

async function leerCsv(archivo: File): Promise<TablaHoja[]> {
  const texto = await archivo.text();
  return [{ nombre: archivo.name, filas: parseCsv(texto) as Celda[][] }];
}

export async function leerArchivoTablas(archivo: File): Promise<TablaHoja[]> {
  const esCsv = /\.csv$/i.test(archivo.name) || archivo.type === 'text/csv';
  return esCsv ? leerCsv(archivo) : leerXlsx(archivo);
}
