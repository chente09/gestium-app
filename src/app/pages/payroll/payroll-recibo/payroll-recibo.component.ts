import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';

import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';

import jsPDF from 'jspdf';

import { PayrollService, RolPago, LineaRolPago, PayrollEmployee } from '../../../services/payroll/payroll.service';

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

// Paleta de marca (igual que el resto de la app)
const NAVY: [number, number, number] = [0, 21, 41];
const GOLD: [number, number, number] = [224, 193, 15];
const INK: [number, number, number] = [38, 38, 38];
const INK_MUTED: [number, number, number] = [92, 101, 112];
const RULE: [number, number, number] = [225, 225, 225];

const LOGO_URL = 'https://i.postimg.cc/qM5m65P4/image.png';

function loadImageAsDataUrl(url: string): Promise<string | null> {
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

@Component({
  selector: 'app-payroll-recibo',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NzButtonModule,
    NzIconModule,
    NzBreadCrumbModule
  ],
  templateUrl: './payroll-recibo.component.html',
  styleUrl: './payroll-recibo.component.css'
})
export class PayrollReciboComponent implements OnInit {
  readonly meses = MESES;
  rol: RolPago | null = null;
  linea: LineaRolPago | null = null;
  employee: PayrollEmployee | null = null;
  loading = false;
  generandoPdf = false;

  constructor(
    private route: ActivatedRoute,
    private payrollService: PayrollService,
    private message: NzMessageService
  ) { }

  async ngOnInit(): Promise<void> {
    const rolId = this.route.snapshot.paramMap.get('rolId');
    const employeeId = this.route.snapshot.paramMap.get('employeeId');
    if (!rolId || !employeeId) return;

    this.loading = true;
    try {
      const [rol, employee] = await Promise.all([
        this.payrollService.getRolPago(rolId),
        this.payrollService.getPayrollEmployeeById(employeeId)
      ]);

      this.rol = rol;
      this.employee = employee;
      this.linea = rol?.lineas.find(l => l.payrollEmployeeId === employeeId) || null;

      if (!this.rol || !this.linea) {
        this.message.error('No se encontró el recibo solicitado');
      }
    } catch (error) {
      console.error('Error cargando recibo:', error);
      this.message.error('Error al cargar el recibo');
    } finally {
      this.loading = false;
    }
  }

  async descargarPdf(): Promise<void> {
    if (!this.rol || !this.linea || !this.employee) return;

    this.generandoPdf = true;
    try {
      const logo = await loadImageAsDataUrl(LOGO_URL);
      this.construirPdf(logo).save(
        `Rol de Pagos - ${this.linea.nombre} - ${this.meses[this.rol.mes - 1]} ${this.rol.anio}.pdf`
      );
    } catch (error) {
      console.error('Error generando PDF:', error);
      this.message.error('Error al generar el PDF');
    } finally {
      this.generandoPdf = false;
    }
  }

  private construirPdf(logo: string | null): jsPDF {
    const rol = this.rol!;
    const linea = this.linea!;
    const employee = this.employee!;

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const marginX = 20;
    const contentWidth = pageWidth - marginX * 2;

    // ===== Encabezado (membrete) =====
    pdf.setFillColor(...NAVY);
    pdf.rect(0, 0, pageWidth, 38, 'F');

    if (logo) {
      pdf.addImage(logo, 'PNG', marginX, 8, 22, 22);
    }

    const textX = logo ? marginX + 28 : marginX;
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(20);
    pdf.text('GESTIUM', textX, 18);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text('SERVICIOS LEGALES INTEGRALES', textX, 24);
    pdf.text(`RUC: ${employee.empleadorRuc} — ${employee.empleadorNombre}`, textX, 30);

    pdf.setFillColor(...GOLD);
    pdf.rect(0, 38, pageWidth, 1.5, 'F');

    // ===== Título =====
    let y = 52;
    pdf.setTextColor(...NAVY);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(14);
    pdf.text(`ROL DE PAGOS — ${this.meses[rol.mes - 1]} ${rol.anio}`, pageWidth / 2, y, { align: 'center' });

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
    y = this.seccion(pdf, 'INGRESOS', marginX, contentWidth, y);
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
    y = this.filas(pdf, filasIngresos, marginX, contentWidth, y);
    y = this.filaTotal(pdf, 'TOTAL INGRESOS', linea.totalIngresos, marginX, contentWidth, y);

    // ===== Descuentos =====
    y += 8;
    y = this.seccion(pdf, 'DESCUENTOS', marginX, contentWidth, y);
    const filasDescuentos: [string, number][] = [];
    if (linea.descuentoIESS > 0) {
      filasDescuentos.push(['IESS (9.45%)', linea.descuentoIESS]);
    }
    for (const d of linea.descuentosVarios) {
      filasDescuentos.push([d.concepto, d.monto]);
    }
    y = this.filas(pdf, filasDescuentos, marginX, contentWidth, y);
    y = this.filaTotal(pdf, 'TOTAL DESCUENTOS', linea.totalDescuentos, marginX, contentWidth, y);

    // ===== Líquido a recibir =====
    y += 10;
    pdf.setFillColor(...NAVY);
    pdf.rect(marginX, y, contentWidth, 16, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(13);
    pdf.text('LÍQUIDO A RECIBIR', marginX + 6, y + 10.5);
    pdf.setFontSize(15);
    pdf.text(`$${linea.liquidoARecibir.toFixed(2)}`, marginX + contentWidth - 6, y + 10.5, { align: 'right' });
    pdf.setFillColor(...GOLD);
    pdf.rect(marginX, y + 16, contentWidth, 1, 'F');

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

    return pdf;
  }

  private seccion(pdf: jsPDF, titulo: string, x: number, width: number, y: number): number {
    pdf.setFont('times', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(...NAVY);
    pdf.text(titulo, x, y);
    pdf.setDrawColor(...NAVY);
    pdf.setLineWidth(0.4);
    pdf.line(x, y + 2, x + width, y + 2);
    return y + 9;
  }

  private filas(pdf: jsPDF, filas: [string, number][], x: number, width: number, y: number): number {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    for (const [label, monto] of filas) {
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

  private filaTotal(pdf: jsPDF, label: string, monto: number, x: number, width: number, y: number): number {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10.5);
    pdf.setTextColor(...NAVY);
    pdf.text(label, x, y);
    pdf.text(`$${monto.toFixed(2)}`, x + width, y, { align: 'right' });
    return y + 6;
  }
}
