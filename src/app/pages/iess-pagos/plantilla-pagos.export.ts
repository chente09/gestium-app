// Plantilla de Excel para cargar títulos cancelados con su honorario: solo
// las columnas que el sistema realmente usa, para llenarla y subirla en
// "Importar pagos". extraerFilasPago (pagos-titulos.util) las lee por nombre
// de encabezado.

import { saveAs } from 'file-saver';

const COLUMNAS = [
  { header: 'ABOGADO', width: 24 },
  { header: 'RUC', width: 18 },
  { header: 'TC', width: 16 },
  { header: 'TOTAL', width: 14 },
  { header: 'HONORARIO', width: 14 }
];

// Una sola celda de texto por línea: la hoja de instrucciones también la lee
// el importador, y así nunca puede confundirse con una fila de encabezados.
const INSTRUCCIONES = [
  'Cómo llenar la plantilla',
  '',
  'Borra las 2 filas de ejemplo y pega tus títulos, uno por fila.',
  '',
  '• ABOGADO: elige de la lista el abogado dueño del título. Se usa para avisarte si un título es de otra cartera.',
  '• RUC: el RUC o cédula del coactivado (el mismo con el que está registrado el título).',
  '• TC: el número del título de crédito.',
  '• TOTAL: lo que pagó el cliente por ese título (capital + interés), en dólares.',
  '• HONORARIO: el honorario de ese título, en dólares.',
  '',
  'Al subir el archivo, el sistema te pregunta si los honorarios ya fueron cobrados al IESS o siguen pendientes, y toma como fecha de cancelación el día de la carga.',
  'Los títulos que no existan en el sistema, o cuyo RUC o abogado no coincidan, se avisan antes de confirmar y no se tocan.'
];

const FILAS_CON_LISTA = 500;

export async function crearLibroPlantilla(carteras: string[]): Promise<any> {
  // exceljs pesa bastante: se carga recién al descargar, no con la app.
  const modulo: any = await import('exceljs');
  const Workbook = modulo.Workbook ?? modulo.default?.Workbook;
  const libro = new Workbook();
  libro.created = new Date();

  const hoja = libro.addWorksheet('Cancelados');
  hoja.columns = COLUMNAS;

  const abogadoEjemplo = carteras[0] ?? 'Nombre Apellido';
  hoja.addRow([abogadoEjemplo, '1790000000001', '510000001', 250, 37.5]);
  hoja.addRow([abogadoEjemplo, '1790000000001', '510000002', 147.51, 22.13]);

  // RUC y TC como texto: Excel se come el cero inicial del RUC y pasa los
  // números largos a notación científica.
  ['B', 'C'].forEach(col => { hoja.getColumn(col).numFmt = '@'; });
  ['D', 'E'].forEach(col => { hoja.getColumn(col).numFmt = '#,##0.00'; });

  // Lista de abogados como ayuda al llenar; no bloquea escribir otro nombre
  // (el importador reconoce también "APELLIDOS NOMBRES").
  const lista = `"${carteras.join(',')}"`;
  if (carteras.length > 0 && lista.length <= 255) {
    for (let fila = 2; fila <= FILAS_CON_LISTA + 1; fila++) {
      hoja.getCell(`A${fila}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        showErrorMessage: false,
        formulae: [lista]
      };
    }
  }

  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D141B' } };
  hoja.views = [{ state: 'frozen', ySplit: 1 }];

  const ayuda = libro.addWorksheet('Instrucciones');
  ayuda.getColumn(1).width = 120;
  INSTRUCCIONES.forEach(linea => ayuda.addRow([linea]));
  ayuda.getRow(1).font = { bold: true, size: 14 };
  ayuda.eachRow((fila: any) => { fila.alignment = { wrapText: true, vertical: 'top' }; });

  return libro;
}

export async function descargarPlantillaPagos(carteras: string[]): Promise<void> {
  const libro = await crearLibroPlantilla(carteras);
  const buffer = await libro.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    'Plantilla cancelados con honorario.xlsx'
  );
}
