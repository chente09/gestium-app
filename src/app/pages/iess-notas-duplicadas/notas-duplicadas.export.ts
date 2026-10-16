// Respaldo en Excel de las notas repetidas que se van a eliminar: se descarga
// ANTES de borrar, por si hay que recuperar el texto de alguna.

import { formatDate } from '@angular/common';
import { saveAs } from 'file-saver';

import { GrupoNotasDuplicadas } from '../../services/gestionesCoactivado/notas-duplicadas.util';

const COLUMNAS = [
  { header: 'RUC', width: 16 },
  { header: 'RAZÓN SOCIAL', width: 38 },
  { header: 'FECHA', width: 18 },
  { header: 'NOTA ELIMINADA', width: 90 },
  { header: 'OBSERVACIÓN GENERAL', width: 40 },
  { header: 'NOTA QUE SE CONSERVÓ', width: 90 },
  { header: 'ID DE LA GESTIÓN', width: 24 }
];

export async function exportarRespaldoNotas(grupos: GrupoNotasDuplicadas[]): Promise<void> {
  // exceljs pesa bastante: se carga recién al exportar, no con la app.
  const modulo: any = await import('exceljs');
  const Workbook = modulo.Workbook ?? modulo.default?.Workbook;
  const libro = new Workbook();
  libro.created = new Date();

  const hoja = libro.addWorksheet('Notas eliminadas');
  hoja.columns = COLUMNAS;

  for (const g of grupos) {
    for (const s of g.sobrantes) {
      hoja.addRow([
        g.coactivadoId,
        g.coactivadoNombre,
        formatDate(s.fecha, 'dd/MM/yyyy HH:mm', 'en-US'),
        s.descripcion,
        s.observacionGeneral ?? '',
        g.conservar.descripcion,
        s.id ?? ''
      ]);
    }
  }

  hoja.getColumn('A').numFmt = '@';
  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D141B' } };
  hoja.views = [{ state: 'frozen', ySplit: 1 }];

  const buffer = await libro.xlsx.writeBuffer();
  const fecha = formatDate(new Date(), 'yyyy-MM-dd HH-mm', 'en-US');
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `Respaldo notas duplicadas ${fecha}.xlsx`
  );
}
