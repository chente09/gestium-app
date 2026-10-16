// Excel de convenios de pago para trabajar por abogado con las carpetas y los
// comprobantes: una hoja con una fila por título y otra con el resumen por
// razón social.

import { formatDate } from '@angular/common';
import { saveAs } from 'file-saver';

import { ConvenioPago, diasSinPagar } from '../../services/titulosCredito/convenios-pago.util';

const ETIQUETA_ESTADO = { cancelado: 'Cancelado', convenio: 'Cancelado en convenio', pendiente: 'Pendiente' } as const;

const COLUMNAS_DETALLE = [
  { header: 'ABOGADO', width: 22 },
  { header: 'RUC', width: 16 },
  { header: 'RAZÓN SOCIAL', width: 38 },
  { header: 'TC', width: 14 },
  { header: 'GUÍA', width: 12 },
  { header: 'ESTADO', width: 22 },
  { header: 'CAPITAL', width: 14 },
  { header: 'MONTO COBRADO', width: 16 },
  { header: 'FECHA DEL PAGO', width: 16 },
  { header: 'COMPROBANTE', width: 20 }
];

const COLUMNAS_RESUMEN = [
  { header: 'ABOGADO', width: 22 },
  { header: 'RUC', width: 16 },
  { header: 'RAZÓN SOCIAL', width: 38 },
  { header: 'TC TOTALES', width: 12 },
  { header: 'TC CANCELADOS', width: 15 },
  { header: 'TC PENDIENTES', width: 15 },
  { header: 'CAPITAL TOTAL', width: 15 },
  { header: 'CAPITAL CANCELADO', width: 18 },
  { header: 'CAPITAL PENDIENTE', width: 18 },
  { header: 'COBRADO REGISTRADO', width: 20 },
  { header: 'ÚLTIMO PAGO', width: 14 },
  { header: 'DÍAS SIN PAGAR', width: 15 }
];

function estiloEncabezado(hoja: any): void {
  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D141B' } };
  hoja.views = [{ state: 'frozen', ySplit: 1 }];
}

const fechaCorta = (f?: Date) => (f ? formatDate(f, 'dd/MM/yyyy', 'en-US') : '');

export async function exportarConvenios(convenios: ConvenioPago[], abogado?: string): Promise<void> {
  // exceljs pesa bastante: se carga recién al exportar, no con la app.
  const modulo: any = await import('exceljs');
  const Workbook = modulo.Workbook ?? modulo.default?.Workbook;
  const libro = new Workbook();
  libro.created = new Date();

  const resumen = libro.addWorksheet('Resumen');
  resumen.columns = COLUMNAS_RESUMEN;
  for (const c of convenios) {
    resumen.addRow([
      c.cartera, c.cedula, c.nombre, c.tc.length, c.cancelados, c.pendientes,
      c.capitalTotal, c.capitalCancelado, c.capitalPendiente, c.cobrado,
      fechaCorta(c.ultimoPago), diasSinPagar(c) ?? ''
    ]);
  }
  ['B'].forEach(col => { resumen.getColumn(col).numFmt = '@'; });
  ['G', 'H', 'I', 'J'].forEach(col => { resumen.getColumn(col).numFmt = '#,##0.00'; });
  estiloEncabezado(resumen);

  const detalle = libro.addWorksheet('Detalle por TC');
  detalle.columns = COLUMNAS_DETALLE;
  for (const c of convenios) {
    for (const t of c.tc) {
      detalle.addRow([
        c.cartera, c.cedula, c.nombre, t.numero, t.guia ?? '',
        t.conAbono ? 'Pendiente (con abono)' : ETIQUETA_ESTADO[t.estado],
        t.capital, t.montoCobrado ?? '', fechaCorta(t.fechaPago), t.comprobante ?? ''
      ]);
    }
  }
  ['B', 'D', 'E', 'J'].forEach(col => { detalle.getColumn(col).numFmt = '@'; });
  ['G', 'H'].forEach(col => { detalle.getColumn(col).numFmt = '#,##0.00'; });
  estiloEncabezado(detalle);

  const buffer = await libro.xlsx.writeBuffer();
  const fecha = formatDate(new Date(), 'yyyy-MM-dd', 'en-US');
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `Convenios de pago${abogado ? ' - ' + abogado : ''} ${fecha}.xlsx`
  );
}
