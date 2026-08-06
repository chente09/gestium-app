import jsPDF from 'jspdf';
import { LineaRolPago, PayrollEmployee, RolPago } from './payroll.service';

// Dibujo del recibo compartido entre el PDF individual y el PDF de "todos los
// recibos" del rol — un solo lugar para el diseño, para que nunca se
// desincronicen entre sí.

export const MESES_RECIBO = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

const NAVY: [number, number, number] = [0, 21, 41];
const GOLD: [number, number, number] = [224, 193, 15];
const INK: [number, number, number] = [38, 38, 38];
const INK_MUTED: [number, number, number] = [92, 101, 112];
const RULE: [number, number, number] = [225, 225, 225];

export const LOGO_URL = 'https://i.postimg.cc/qM5m65P4/image.png';

export function loadImageAsDataUrl(url: string): Promise<string | null> {
  return fetch(url)
    .then(res => res.blob())
    .then(blob => new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    }))
    .catch(() => null);
}

// Dibuja un recibo completo en la página actual del PDF (no crea página nueva).
export function dibujarRecibo(
  pdf: jsPDF,
  rol: RolPago,
  linea: LineaRolPago,
  employee: PayrollEmployee,
  logo: string | null
): void {
  const pageWidth = 210;
  const marginX = 20;
  const contentWidth = pageWidth - marginX * 2;

  // ===== Marca de agua — logo grande y muy transparente, detrás de todo =====
  if (logo) {
    const wmSize = 130;
    pdf.saveGraphicsState();
    pdf.setGState(new (pdf as any).GState({ opacity: 0.05 }));
    pdf.addImage(logo, 'PNG', (pageWidth - wmSize) / 2, 90, wmSize, wmSize);
    pdf.restoreGraphicsState();
  }

  // ===== Encabezado (membrete) — papel blanco, sin rellenos sólidos =====
  if (logo) {
    pdf.addImage(logo, 'PNG', marginX, 10, 18, 18);
  }

  const textX = logo ? marginX + 24 : marginX;
  pdf.setTextColor(...NAVY);
  pdf.setFont('times', 'bold');
  pdf.setFontSize(18);
  pdf.text('GESTIUM', textX, 18);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(...INK_MUTED);
  pdf.text('SERVICIOS LEGALES INTEGRALES', textX, 23.5);
  pdf.text(`RUC: ${employee.empleadorRuc} — ${employee.empleadorNombre}`, textX, 28);

  pdf.setDrawColor(...GOLD);
  pdf.setLineWidth(0.8);
  pdf.line(marginX, 34, pageWidth - marginX, 34);

  // ===== Título =====
  let y = 46;
  pdf.setTextColor(...NAVY);
  pdf.setFont('times', 'bold');
  pdf.setFontSize(14);
  pdf.text(`ROL DE PAGOS — ${MESES_RECIBO[rol.mes - 1]} ${rol.anio}`, pageWidth / 2, y, { align: 'center' });

  // ===== Datos del trabajador =====
  y += 14;
  pdf.setFontSize(10);
  const datos: [string, string][] = [
    ['Nombre', linea.nombre],
    ['Cédula', linea.cedula],
    ['Días trabajados', linea.diasTrabajados]
  ];
  for (const [label, value] of datos) {
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...NAVY);
    pdf.text(`${label}:`, marginX, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...INK);
    pdf.text(value, marginX + 32, y);
    y += 6;
  }

  // ===== Ingresos =====
  y += 6;
  y = seccion(pdf, 'INGRESOS', marginX, contentWidth, y);
  const filasIngresos: [string, number][] = [
    ['Remuneración', linea.remuneracion],
  ];
  if (linea.elegibleDecimos) {
    filasIngresos.push(['Décimo Tercero', linea.decimoTercero]);
    filasIngresos.push(['Décimo Cuarto', linea.decimoCuarto]);
  }
  if (linea.elegibleFondosReserva) {
    filasIngresos.push(['Fondos de Reserva', linea.fondosReserva]);
  }
  for (const b of linea.bonosVarios) {
    filasIngresos.push([b.concepto, b.monto]);
  }
  y = filas(pdf, filasIngresos, marginX, contentWidth, y);
  y = filaTotal(pdf, 'TOTAL INGRESOS', linea.totalIngresos, marginX, contentWidth, y);

  // ===== Descuentos =====
  y += 8;
  y = seccion(pdf, 'DESCUENTOS', marginX, contentWidth, y);
  const filasDescuentos: [string, number][] = [];
  if (linea.descuentoIESS > 0) {
    filasDescuentos.push(['IESS (9.45%)', linea.descuentoIESS]);
  }
  for (const d of linea.descuentosVarios) {
    filasDescuentos.push([d.concepto, d.monto]);
  }
  y = filas(pdf, filasDescuentos, marginX, contentWidth, y);
  y = filaTotal(pdf, 'TOTAL DESCUENTOS', linea.totalDescuentos, marginX, contentWidth, y);

  // ===== Líquido a recibir — caja con borde, no relleno sólido =====
  y += 10;
  pdf.setDrawColor(...NAVY);
  pdf.setLineWidth(0.6);
  pdf.rect(marginX, y, contentWidth, 16, 'S');
  pdf.setTextColor(...NAVY);
  pdf.setFont('times', 'bold');
  pdf.setFontSize(13);
  pdf.text('LÍQUIDO A RECIBIR', marginX + 6, y + 10.5);
  pdf.setFontSize(15);
  pdf.text(`$${linea.liquidoARecibir.toFixed(2)}`, marginX + contentWidth - 6, y + 10.5, { align: 'right' });

  // ===== Firmas =====
  y += 40;
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(9);
  pdf.setTextColor(...INK_MUTED);
  pdf.text('Recibí conforme', pageWidth / 2, y, { align: 'center' });

  y += 18;
  const firmaAncho = 60;
  const firmaTrabajadorX = pageWidth / 2 - firmaAncho - 10;
  const firmaEmpleadorX = pageWidth / 2 + 10;
  pdf.setDrawColor(...INK);
  pdf.setLineWidth(0.2);
  pdf.line(firmaTrabajadorX, y, firmaTrabajadorX + firmaAncho, y);
  pdf.line(firmaEmpleadorX, y, firmaEmpleadorX + firmaAncho, y);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(...INK);
  pdf.text(linea.nombre, firmaTrabajadorX + firmaAncho / 2, y + 5, { align: 'center' });
  pdf.text('David Maldonado', firmaEmpleadorX + firmaAncho / 2, y + 5, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(...INK_MUTED);
  pdf.text('TRABAJADOR', firmaTrabajadorX + firmaAncho / 2, y + 9, { align: 'center' });
  pdf.text('EMPLEADOR', firmaEmpleadorX + firmaAncho / 2, y + 9, { align: 'center' });

  // ===== Pie =====
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(...INK_MUTED);
  pdf.text(
    'Av. Doce de Octubre N24-660 y Francisco Salazar, Edif. Concorde piso 15 Of.15C · Telf: 022543653 · Cel: 0998-028-605',
    pageWidth / 2,
    285,
    { align: 'center' }
  );
}

function seccion(pdf: jsPDF, titulo: string, x: number, width: number, y: number): number {
  pdf.setFont('times', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(...NAVY);
  pdf.text(titulo, x, y);
  pdf.setDrawColor(...NAVY);
  pdf.setLineWidth(0.4);
  pdf.line(x, y + 2, x + width, y + 2);
  return y + 9;
}

function filas(pdf: jsPDF, filasData: [string, number][], x: number, width: number, y: number): number {
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  for (const [label, monto] of filasData) {
    pdf.setTextColor(...INK);
    pdf.text(label, x, y);
    pdf.text(`$${monto.toFixed(2)}`, x + width, y, { align: 'right' });
    pdf.setDrawColor(...RULE);
    pdf.setLineWidth(0.15);
    pdf.line(x, y + 2, x + width, y + 2);
    y += 7;
  }
  return y;
}

function filaTotal(pdf: jsPDF, label: string, monto: number, x: number, width: number, y: number): number {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10.5);
  pdf.setTextColor(...NAVY);
  pdf.text(label, x, y);
  pdf.text(`$${monto.toFixed(2)}`, x + width, y, { align: 'right' });
  return y + 6;
}
