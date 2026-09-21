import { formatDate } from '@angular/common';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';

import { GestionCoactivado } from '../../services/gestionesCoactivado/gestiones-coactivado.service';
import { ReporteGestion } from './reporte-gestion.util';

export interface TipoReporte {
  clave: string;
  etiqueta: string;
}

const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

function fechaCorta(fecha: Date): string {
  return formatDate(fecha, 'dd/MM/yyyy', 'en-US');
}

// "2026-09-21" → "lun 21/09/2026"
export function etiquetaDia(clave: string): string {
  const [y, m, d] = clave.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  return `${DIAS_SEMANA[fecha.getDay()]} ${fechaCorta(fecha)}`;
}

export function textoPeriodo(reporte: ReporteGestion): string {
  const desde = fechaCorta(reporte.desde);
  const hasta = fechaCorta(reporte.hasta);
  return desde === hasta ? desde : `${desde} a ${hasta}`;
}

function nombreArchivo(reporte: ReporteGestion, extension: string): string {
  const desde = formatDate(reporte.desde, 'yyyy-MM-dd', 'en-US');
  const hasta = formatDate(reporte.hasta, 'yyyy-MM-dd', 'en-US');
  return `Informe de gestion IESS ${desde === hasta ? desde : `${desde} a ${hasta}`}.${extension}`;
}

// ============================================
// 📄 PDF
// ============================================
export function exportarPdf(reporte: ReporteGestion, tipos: TipoReporte[], generadoPor: string): void {
  // Con muchas columnas de integrantes, en vertical no cabe.
  const pdf = new jsPDF({
    orientation: reporte.integrantes.length > 8 ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  pdf.setFont('Helvetica');

  pdf.setFontSize(14);
  pdf.text('Informe de gestion - IESS', 14, 15);
  pdf.setFontSize(9);
  pdf.text(`Periodo: ${textoPeriodo(reporte)}`, 14, 21);
  pdf.text(`Generado por ${generadoPor} el ${formatDate(new Date(), 'dd/MM/yyyy HH:mm', 'en-US')}`, 14, 26);
  pdf.text(
    `Gestiones: ${reporte.totalGestiones}  |  Coactivados distintos: ${reporte.coactivadosDistintos}  |  ` +
    `Integrantes activos: ${reporte.integrantesActivos} de ${reporte.integrantes.length}`,
    14, 31
  );

  const estilo = {
    theme: 'striped' as const,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [13, 20, 27] as [number, number, number] }
  };

  const seccion = (titulo: string): number => {
    const finalY: number = (pdf as any).lastAutoTable?.finalY ?? 31;
    let y = finalY + 9;
    if (y > pdf.internal.pageSize.getHeight() - 30) {
      pdf.addPage();
      y = 15;
    }
    pdf.setFontSize(10);
    pdf.text(titulo, 14, y);
    return y + 3;
  };

  autoTable(pdf, {
    ...estilo,
    startY: seccion('Gestiones por dia'),
    head: [['Fecha', ...reporte.integrantes.map(i => i.nombre), 'Total']],
    body: [
      ...reporte.dias.map(dia => [
        etiquetaDia(dia),
        ...reporte.integrantes.map(i => reporte.matriz[dia][i.uid] || '-'),
        reporte.totalesPorDia[dia]
      ]),
      ['Total', ...reporte.integrantes.map(i => reporte.totalesPorIntegrante[i.uid]), reporte.totalGestiones]
    ]
  });

  autoTable(pdf, {
    ...estilo,
    startY: seccion('Resumen por integrante'),
    head: [['Integrante', 'Gestiones', ...tipos.map(t => t.etiqueta), 'Coactivados', 'Dias activos', 'Prom./dia']],
    body: reporte.resumenIntegrantes.map(r => [
      r.nombre,
      r.total,
      ...tipos.map(t => r.porTipo[t.clave] ?? 0),
      r.coactivadosDistintos,
      r.diasActivos,
      r.promedioPorDiaActivo
    ])
  });

  if (reporte.porCartera.length > 0) {
    autoTable(pdf, {
      ...estilo,
      startY: seccion('Gestiones por cartera'),
      head: [['Cartera', 'Gestiones', 'Coactivados distintos']],
      body: reporte.porCartera.map(c => [c.cartera, c.gestiones, c.coactivadosDistintos])
    });
  }

  pdf.save(nombreArchivo(reporte, 'pdf'));
}

// ============================================
// 📊 Excel
// ============================================
export async function exportarExcel(
  reporte: ReporteGestion,
  gestiones: GestionCoactivado[],
  tipos: TipoReporte[],
  generadoPor: string
): Promise<void> {
  // exceljs pesa bastante: se carga recién al exportar, no con la app.
  const modulo: any = await import('exceljs');
  const Workbook = modulo.Workbook ?? modulo.default?.Workbook;
  const libro = new Workbook();
  libro.creator = generadoPor;
  libro.created = new Date();

  const encabezado = (hoja: any) => {
    const fila = hoja.getRow(1);
    fila.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    fila.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D141B' } };
    hoja.views = [{ state: 'frozen', ySplit: 1 }];
  };

  // --- Resumen
  const resumen = libro.addWorksheet('Resumen');
  resumen.columns = [{ width: 32 }, { width: 22 }];
  resumen.addRows([
    ['Informe de gestión - IESS'],
    ['Período', textoPeriodo(reporte)],
    ['Generado por', generadoPor],
    ['Fecha de generación', formatDate(new Date(), 'dd/MM/yyyy HH:mm', 'en-US')],
    [],
    ['Gestiones', reporte.totalGestiones],
    ['Coactivados distintos', reporte.coactivadosDistintos],
    ['Integrantes activos', `${reporte.integrantesActivos} de ${reporte.integrantes.length}`],
    ['Días con actividad', reporte.diasConActividad],
    [],
    ...tipos.map(t => [t.etiqueta, reporte.porTipo[t.clave] ?? 0])
  ]);
  resumen.getRow(1).font = { bold: true, size: 14 };

  // --- Por día (filas = días, columnas = integrantes)
  const porDia = libro.addWorksheet('Por día');
  porDia.addRow(['Fecha', ...reporte.integrantes.map(i => i.nombre), 'Total']);
  reporte.dias.forEach(dia => {
    porDia.addRow([etiquetaDia(dia), ...reporte.integrantes.map(i => reporte.matriz[dia][i.uid]), reporte.totalesPorDia[dia]]);
  });
  const filaTotal = porDia.addRow(['Total', ...reporte.integrantes.map(i => reporte.totalesPorIntegrante[i.uid]), reporte.totalGestiones]);
  filaTotal.font = { bold: true };
  porDia.getColumn(1).width = 18;
  encabezado(porDia);

  // --- Por integrante
  const porIntegrante = libro.addWorksheet('Por integrante');
  porIntegrante.addRow(['Integrante', 'Gestiones', ...tipos.map(t => t.etiqueta), 'Coactivados distintos', 'Días activos', 'Promedio por día activo']);
  reporte.resumenIntegrantes.forEach(r => {
    porIntegrante.addRow([r.nombre, r.total, ...tipos.map(t => r.porTipo[t.clave] ?? 0), r.coactivadosDistintos, r.diasActivos, r.promedioPorDiaActivo]);
  });
  porIntegrante.getColumn(1).width = 30;
  encabezado(porIntegrante);

  // --- Por cartera
  const porCartera = libro.addWorksheet('Por cartera');
  porCartera.addRow(['Cartera', 'Gestiones', 'Coactivados distintos']);
  reporte.porCartera.forEach(c => porCartera.addRow([c.cartera, c.gestiones, c.coactivadosDistintos]));
  porCartera.getColumn(1).width = 26;
  encabezado(porCartera);

  // --- Detalle (cada gestión, para cruzar o filtrar a gusto)
  const etiquetaTipo = new Map(tipos.map(t => [t.clave, t.etiqueta]));
  const detalle = libro.addWorksheet('Detalle');
  detalle.columns = [
    { header: 'Fecha', width: 12 },
    { header: 'Hora', width: 8 },
    { header: 'Integrante', width: 28 },
    { header: 'Cédula', width: 16 },
    { header: 'Coactivado', width: 34 },
    { header: 'Cartera', width: 20 },
    { header: 'Tipo', width: 12 },
    { header: 'Descripción', width: 70 }
  ];
  [...gestiones]
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
    .forEach(g => {
      const fila = detalle.addRow([
        fechaCorta(g.fecha),
        formatDate(g.fecha, 'HH:mm', 'en-US'),
        g.registradoPor.nombre,
        g.coactivadoId,
        g.coactivadoNombre,
        g.cartera ?? '',
        etiquetaTipo.get(g.tipo) ?? g.tipo,
        g.descripcion
      ]);
      fila.getCell(8).alignment = { wrapText: true, vertical: 'top' };
    });
  encabezado(detalle);

  const buffer = await libro.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    nombreArchivo(reporte, 'xlsx')
  );
}
