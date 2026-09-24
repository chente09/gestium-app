// Exporta la base completa de títulos de crédito (todos los abogados, o uno
// en particular): TC, RUC, razón social y valor de cada título, más la
// observación general y la fecha de la última gestión de ese coactivado —
// lo que se necesita para armar los informes.

import { formatDate } from '@angular/common';
import { saveAs } from 'file-saver';

import { Coactivado } from '../../services/coactivados/coactivados.service';
import { TituloCredito } from '../../services/titulosCredito/titulos-credito.util';

export interface UltimaGestion {
  fecha: Date;
  observacionGeneral?: string;
}

const COLUMNAS = [
  { header: 'TC', width: 14 },
  { header: 'RUC', width: 15 },
  { header: 'Razón social', width: 34 },
  { header: 'Valor', width: 12 },
  { header: 'Observación general', width: 50 },
  { header: 'Fecha de última gestión', width: 18 }
];

function filaDe(
  t: TituloCredito,
  coactivado: Coactivado | undefined,
  ultimaGestion: UltimaGestion | undefined
): (string | number)[] {
  return [
    t.numero,
    t.coactivadoId,
    coactivado?.nombre ?? '',
    t.capital,
    ultimaGestion?.observacionGeneral ?? '',
    ultimaGestion ? formatDate(ultimaGestion.fecha, 'dd/MM/yyyy', 'en-US') : ''
  ];
}

function nombreArchivo(cartera?: string): string {
  const fecha = formatDate(new Date(), 'yyyy-MM-dd', 'en-US');
  return `Base titulos IESS${cartera ? ' - ' + cartera : ''} ${fecha}.xlsx`;
}

export async function exportarBaseTitulos(
  titulos: TituloCredito[],
  coactivados: Map<string, Coactivado>,
  ultimasGestiones: Map<string, UltimaGestion>,
  cartera?: string
): Promise<void> {
  // exceljs pesa bastante: se carga recién al exportar, no con la app.
  const modulo: any = await import('exceljs');
  const Workbook = modulo.Workbook ?? modulo.default?.Workbook;
  const libro = new Workbook();
  libro.created = new Date();

  const hoja = libro.addWorksheet('Base títulos');
  hoja.columns = COLUMNAS;
  titulos.forEach(t => hoja.addRow(filaDe(t, coactivados.get(t.coactivadoId), ultimasGestiones.get(t.coactivadoId))));

  const filaEncabezado = hoja.getRow(1);
  filaEncabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  filaEncabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D141B' } };
  hoja.views = [{ state: 'frozen', ySplit: 1 }];

  const buffer = await libro.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    nombreArchivo(cartera)
  );
}
