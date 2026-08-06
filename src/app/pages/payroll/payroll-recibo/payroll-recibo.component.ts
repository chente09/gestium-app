import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';

import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';

import jsPDF from 'jspdf';

import { PayrollService, RolPago, LineaRolPago, PayrollEmployee } from '../../../services/payroll/payroll.service';
import { MESES_RECIBO, LOGO_URL, loadImageAsDataUrl, dibujarRecibo } from '../../../services/payroll/payroll-pdf.util';

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
  readonly meses = MESES_RECIBO;
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
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      dibujarRecibo(pdf, this.rol, this.linea, this.employee, logo);
      pdf.save(`Rol de Pagos - ${this.linea.nombre} - ${this.meses[this.rol.mes - 1]} ${this.rol.anio}.pdf`);
    } catch (error) {
      console.error('Error generando PDF:', error);
      this.message.error('Error al generar el PDF');
    } finally {
      this.generandoPdf = false;
    }
  }
}
