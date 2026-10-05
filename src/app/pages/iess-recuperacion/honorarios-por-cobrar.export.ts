// Excel con los TC cuyo honorario el IESS aún no le paga a la oficina: una
// fila por título, para cotejar contra las carpetas físicas.

import { formatDate } from '@angular/common';
import { saveAs } from 'file-saver';

import { GrupoHonorarioPorCobrar } from '../../services/coactivados/coactivados.service';

const COLUMNAS = [
  { header: 'ABOGADO', width: 22 },
  { header: 'RUC', width: 16 },
  { header: 'RAZÓN SOCIAL', width: 38 },
  { header: 'TC', width: 14 },
  { header: 'GUÍA', width: 12 },
  { header: 'MONTO CANCELADO', width: 18 },
  { header: 'HONORARIO', width: 14 },
  { header: 'FECHA CANCELACIÓN', width: 20 },
  { header: 'COMPROBANTE', width: 16 }
];

export async function exportarHonorariosPorCobrar(grupos: GrupoHonorarioPorCobrar[], cartera?: string): Promise<void> {
  // exceljs pesa bastante: se carga recién al exportar, no con la app.
  const modulo: any = await import('exceljs');
  const Workbook = modulo.Workbook ?? modulo.default?.Workbook;
  const libro = new Workbook();
  libro.created = new Date();

  const hoja = libro.addWorksheet('Honorarios por cobrar');
  hoja.columns = COLUMNAS;

  let totalMonto = 0;
  let totalHonorario = 0;
  for (const g of grupos) {
    for (const t of g.titulos) {
      totalMonto += t.montoCancelado;
      totalHonorario += t.honorario;
      hoja.addRow([
        t.cartera ?? '',
        g.cedula,
        g.nombre,
        t.numero,
        t.guia ?? '',
        t.montoCancelado,
        t.honorario,
        t.fechaCancelacion ? formatDate(t.fechaCancelacion, 'dd/MM/yyyy', 'en-US') : '',
        t.comprobante ?? ''
      ]);
    }
  }

  ['B', 'D', 'E', 'I'].forEach(col => { hoja.getColumn(col).numFmt = '@'; });
  ['F', 'G'].forEach(col => { hoja.getColumn(col).numFmt = '#,##0.00'; });

  const total = hoja.addRow(['TOTAL', '', '', '', '', Math.round(totalMonto * 100) / 100, Math.round(totalHonorario * 100) / 100, '', '']);
  total.font = { bold: true };

  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D141B' } };
  hoja.views = [{ state: 'frozen', ySplit: 1 }];

  const buffer = await libro.xlsx.writeBuffer();
  const fecha = formatDate(new Date(), 'yyyy-MM-dd', 'en-US');
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `Honorarios por cobrar${cartera ? ' - ' + cartera : ''} ${fecha}.xlsx`
  );
}
