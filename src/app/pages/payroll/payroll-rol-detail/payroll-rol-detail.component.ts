import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';

import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';

import jsPDF from 'jspdf';

import { PayrollService, RolPago, LineaRolPago, ConceptoMonto } from '../../../services/payroll/payroll.service';
import { LOGO_URL, loadImageAsDataUrl, dibujarRecibo } from '../../../services/payroll/payroll-pdf.util';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

@Component({
  selector: 'app-payroll-rol-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    NzCardModule,
    NzTableModule,
    NzButtonModule,
    NzIconModule,
    NzTagModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzBreadCrumbModule,
    NzGridModule,
    NzStatisticModule,
    NzToolTipModule
  ],
  templateUrl: './payroll-rol-detail.component.html',
  styleUrl: './payroll-rol-detail.component.css'
})
export class PayrollRolDetailComponent implements OnInit {
  readonly meses = MESES;
  rol: RolPago | null = null;
  loading = false;
  guardando = false;
  emitiendo = false;
  regenerando = false;
  generandoPdfs = false;
  agregandoFaltantes = false;

  private expandedIds = new Set<string>();

  constructor(
    private route: ActivatedRoute,
    private payrollService: PayrollService,
    private message: NzMessageService,
    private modal: NzModalService
  ) { }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.cargarRol(id);
    }
  }

  private async cargarRol(id: string): Promise<void> {
    this.loading = true;
    try {
      this.rol = await this.payrollService.getRolPago(id);
    } catch (error) {
      console.error('Error cargando rol de pago:', error);
      this.message.error('Error al cargar el rol de pago');
    } finally {
      this.loading = false;
    }
  }

  regenerarRol(): void {
    if (!this.rol?.id) return;

    this.modal.confirm({
      nzTitle: 'Regenerar rol',
      nzContent: 'Se vuelve a calcular con las reglas y el SBU actuales. Se pierden los días trabajados y los bonos/descuentos que hayas cargado a mano en este borrador. ¿Continuar?',
      nzOkText: 'Sí, regenerar',
      nzCancelText: 'Cancelar',
      nzOnOk: async () => {
        this.regenerando = true;
        try {
          await this.payrollService.regenerarRolPago(this.rol!.id!);
          await this.cargarRol(this.rol!.id!);
          this.message.success('Rol regenerado');
        } catch (error: any) {
          console.error('Error regenerando rol:', error);
          this.message.error(error?.message || 'Error al regenerar el rol');
        } finally {
          this.regenerando = false;
        }
      }
    });
  }

  async agregarEmpleadosFaltantes(): Promise<void> {
    if (!this.rol?.id) return;

    this.agregandoFaltantes = true;
    try {
      const agregados = await this.payrollService.agregarEmpleadosFaltantes(this.rol.id);
      await this.cargarRol(this.rol.id);
      if (agregados === 0) {
        this.message.info('No hay empleados nuevos para agregar — ya están todos.');
      } else {
        this.message.success(`Se agregaron ${agregados} empleado(s) nuevo(s) al rol.`);
      }
    } catch (error: any) {
      console.error('Error agregando empleados faltantes:', error);
      this.message.error(error?.message || 'Error al agregar los empleados nuevos');
    } finally {
      this.agregandoFaltantes = false;
    }
  }

  get esBorrador(): boolean {
    return this.rol?.estado === 'borrador';
  }

  get totalTrabajadores(): number {
    return this.rol?.lineas.length || 0;
  }

  get totalIngresos(): number {
    return this.rol?.lineas.reduce((sum, l) => sum + l.totalIngresos, 0) || 0;
  }

  get totalDescuentos(): number {
    return this.rol?.lineas.reduce((sum, l) => sum + l.totalDescuentos, 0) || 0;
  }

  get totalLiquido(): number {
    return this.rol?.lineas.reduce((sum, l) => sum + l.liquidoARecibir, 0) || 0;
  }

  // Fila compacta por defecto; el desglose completo se abre bajo demanda en
  // vez de mostrar 14 columnas siempre para todo el mundo a la vez.
  toggleExpand(id: string): void {
    if (this.expandedIds.has(id)) {
      this.expandedIds.delete(id);
    } else {
      this.expandedIds.add(id);
    }
  }

  isExpanded(id: string): boolean {
    return this.expandedIds.has(id);
  }

  async agregarBono(linea: LineaRolPago, concepto: string, montoStr: string): Promise<void> {
    await this.agregarItem(linea, 'bonosVarios', concepto, montoStr);
  }

  async agregarDescuento(linea: LineaRolPago, concepto: string, montoStr: string): Promise<void> {
    await this.agregarItem(linea, 'descuentosVarios', concepto, montoStr);
  }

  private async agregarItem(
    linea: LineaRolPago,
    campo: 'bonosVarios' | 'descuentosVarios',
    concepto: string,
    montoStr: string
  ): Promise<void> {
    const monto = parseFloat(montoStr);
    if (!concepto.trim() || !monto || monto <= 0) {
      this.message.warning('Completa el concepto y el monto');
      return;
    }

    const item: ConceptoMonto = { concepto: concepto.trim(), monto };
    const actualizada = { ...linea, [campo]: [...linea[campo], item] };
    await this.persistirLinea(actualizada);
  }

  async quitarBono(linea: LineaRolPago, index: number): Promise<void> {
    const actualizada = { ...linea, bonosVarios: linea.bonosVarios.filter((_, i) => i !== index) };
    await this.persistirLinea(actualizada);
  }

  async quitarDescuento(linea: LineaRolPago, index: number): Promise<void> {
    const actualizada = { ...linea, descuentosVarios: linea.descuentosVarios.filter((_, i) => i !== index) };
    await this.persistirLinea(actualizada);
  }

  async actualizarDiasTrabajados(linea: LineaRolPago, valor: string): Promise<void> {
    const actualizada = { ...linea, diasTrabajados: valor };
    await this.persistirLinea(actualizada);
  }

  private async persistirLinea(linea: LineaRolPago): Promise<void> {
    if (!this.rol?.id) return;
    const recalculada = this.payrollService.recalcularLinea(linea);
    const lineas = this.rol.lineas.map(l => l.payrollEmployeeId === linea.payrollEmployeeId ? recalculada : l);
    this.rol.lineas = lineas;

    this.guardando = true;
    try {
      await this.payrollService.actualizarLineasRolPago(this.rol.id, lineas);
    } catch (error) {
      console.error('Error guardando cambios del rol:', error);
      this.message.error('Error al guardar los cambios');
    } finally {
      this.guardando = false;
    }
  }

  emitirRol(): void {
    if (!this.rol?.id) return;

    this.modal.confirm({
      nzTitle: 'Emitir rol de pago',
      nzContent: 'Una vez emitido, el rol queda cerrado y los recibos individuales quedan disponibles para cada trabajador. ¿Continuar?',
      nzOkText: 'Sí, emitir',
      nzCancelText: 'Cancelar',
      nzOnOk: async () => {
        this.emitiendo = true;
        try {
          await this.payrollService.emitirRolPago(this.rol!.id!);
          this.rol!.estado = 'emitido';
          this.message.success('Rol emitido correctamente');
        } catch (error) {
          console.error('Error emitiendo rol:', error);
          this.message.error('Error al emitir el rol');
        } finally {
          this.emitiendo = false;
        }
      }
    });
  }

  async descargarTodosLosRecibos(): Promise<void> {
    if (!this.rol || this.rol.lineas.length === 0) return;

    this.generandoPdfs = true;
    try {
      const [logo, empleados] = await Promise.all([
        loadImageAsDataUrl(LOGO_URL),
        Promise.all(this.rol.lineas.map(l => this.payrollService.getPayrollEmployeeById(l.payrollEmployeeId)))
      ]);

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      this.rol.lineas.forEach((linea, i) => {
        const employee = empleados[i];
        if (!employee) return; // empleado eliminado después de generar el rol
        if (i > 0) pdf.addPage();
        dibujarRecibo(pdf, this.rol!, linea, employee, logo);
      });

      pdf.save(`Roles de Pago - ${this.meses[this.rol.mes - 1]} ${this.rol.anio}.pdf`);
    } catch (error) {
      console.error('Error generando los PDFs:', error);
      this.message.error('Error al generar los recibos');
    } finally {
      this.generandoPdfs = false;
    }
  }

  trackByEmployeeId(index: number, linea: LineaRolPago): string {
    return linea.payrollEmployeeId;
  }
}
