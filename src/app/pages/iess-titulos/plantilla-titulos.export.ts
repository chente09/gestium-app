// Descarga la plantilla Excel para cargar títulos a mano: el importador la
// lee como cualquier otra matriz (los encabezados son los que ya reconoce).

import { saveAs } from 'file-saver';

import {
  COLUMNAS_PLANTILLA,
  FILAS_CON_LISTA,
  HOJA_INSTRUCCIONES,
  HOJA_LISTAS,
  HOJA_TITULOS,
  NOMBRE_PLANTILLA,
  POSICION_ABOGADO,
  encabezadoDe,
  filasInstrucciones
} from '../../services/titulosCredito/plantilla-titulos.util';

const COLOR_ENCABEZADO = 'FF0D141B';

export async function crearLibroPlantilla(carteras: string[]): Promise<any> {
  // exceljs pesa bastante: se carga recién al descargar, no con la app.
  const modulo: any = await import('exceljs');
  const Workbook = modulo.Workbook ?? modulo.default?.Workbook;
  const libro = new Workbook();
  libro.created = new Date();

  const hoja = libro.addWorksheet(HOJA_TITULOS);
  hoja.columns = COLUMNAS_PLANTILLA.map(c => ({
    header: encabezadoDe(c),
    width: c.ancho,
    style: c.formato === 'texto' ? { numFmt: '@' } : c.formato === 'dinero' ? { numFmt: '#,##0.00' } : {}
  }));

  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ENCABEZADO } };
  hoja.views = [{ state: 'frozen', ySplit: 1 }];

  // Lista desplegable de abogados: sale de una hoja oculta (el importador
  // ignora las ocultas) y las carteras van tal cual, así se reconocen siempre.
  if (carteras.length > 0) {
    const listas = libro.addWorksheet(HOJA_LISTAS, { state: 'hidden' });
    carteras.forEach((cartera, i) => { listas.getCell(i + 1, 1).value = cartera; });
    const rango = `${HOJA_LISTAS}!$A$1:$A$${carteras.length}`;
    for (let fila = 2; fila <= FILAS_CON_LISTA + 1; fila++) {
      hoja.getCell(fila, POSICION_ABOGADO).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [rango],
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Abogado',
        error: 'Elige un abogado de la lista.'
      };
    }
  }

  const instrucciones = libro.addWorksheet(HOJA_INSTRUCCIONES);
  instrucciones.columns = [{ width: 30 }, { width: 100 }];
  filasInstrucciones().forEach(([titulo, detalle], i) => {
    const fila = instrucciones.addRow([titulo, detalle]);
    fila.getCell(1).font = { bold: true, size: i === 0 ? 13 : 11 };
    fila.getCell(2).alignment = { wrapText: true, vertical: 'top' };
    fila.getCell(1).alignment = { vertical: 'top' };
  });

  return libro;
}

export async function descargarPlantillaTitulos(carteras: string[]): Promise<void> {
  const libro = await crearLibroPlantilla(carteras);
  const buffer = await libro.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    NOMBRE_PLANTILLA
  );
}
