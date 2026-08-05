import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject, Subscription, takeUntil } from 'rxjs';

import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';

import { PayrollService, RolPago } from '../../../services/payroll/payroll.service';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

@Component({
  selector: 'app-payroll-roles',
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
    NzSelectModule,
    NzInputNumberModule,
    NzBreadCrumbModule,
    NzEmptyModule,
    NzPopconfirmModule
  ],
  templateUrl: './payroll-roles.component.html',
  styleUrl: './payroll-roles.component.css'
})
export class PayrollRolesComponent implements OnInit, OnDestroy {
  readonly meses = MESES;
  roles: RolPago[] = [];
  loading = false;
  generando = false;

  mesSeleccionado = new Date().getMonth() + 1;
  anioSeleccionado = new Date().getFullYear();

  sbuActual: number | null = null;
  sbuEditable: number | null = null;
  guardandoSbu = false;

  private destroy$ = new Subject<void>();
  private sub?: Subscription;

  constructor(
    private payrollService: PayrollService,
    private message: NzMessageService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loading = true;
    this.sub = this.payrollService.getRolesPago()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (roles) => {
          this.roles = roles;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error cargando roles de pago:', error);
          this.message.error('Error al cargar los roles de pago');
          this.loading = false;
        }
      });

    this.cargarSbu();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async cargarSbu(): Promise<void> {
    this.sbuActual = await this.payrollService.getSbuVigente(this.anioSeleccionado);
    this.sbuEditable = this.sbuActual;
  }

  async guardarSbu(): Promise<void> {
    if (!this.sbuEditable || this.sbuEditable <= 0) {
      this.message.warning('Ingresa un SBU válido');
      return;
    }
    this.guardandoSbu = true;
    try {
      await this.payrollService.setSbu(this.anioSeleccionado, this.sbuEditable);
      this.sbuActual = this.sbuEditable;
      this.message.success(`SBU ${this.anioSeleccionado} guardado`);
    } catch (error) {
      console.error('Error guardando SBU:', error);
      this.message.error('Error al guardar el SBU');
    } finally {
      this.guardandoSbu = false;
    }
  }

  async generarRol(): Promise<void> {
    const yaExiste = this.roles.some(r => r.mes === this.mesSeleccionado && r.anio === this.anioSeleccionado);
    if (yaExiste) {
      this.message.warning('Ya existe un rol generado para ese mes. Abrilo desde la lista para editarlo.');
      return;
    }

    this.generando = true;
    try {
      const id = await this.payrollService.generarRolPago(this.mesSeleccionado, this.anioSeleccionado, 'Sistema');
      this.message.success('Rol generado');
      this.router.navigate(['/payroll/roles', id]);
    } catch (error: any) {
      console.error('Error generando rol de pago:', error);
      this.message.error(error?.message || 'Error al generar el rol');
    } finally {
      this.generando = false;
    }
  }

  totalLiquido(rol: RolPago): number {
    return rol.lineas.reduce((sum, l) => sum + l.liquidoARecibir, 0);
  }

  async eliminarRol(rol: RolPago): Promise<void> {
    if (!rol.id) return;
    try {
      await this.payrollService.eliminarRolPago(rol.id);
      this.message.success('Rol eliminado');
    } catch (error: any) {
      console.error('Error eliminando rol:', error);
      this.message.error(error?.message || 'Error al eliminar el rol');
    }
  }

  trackById(index: number, rol: RolPago): string | undefined {
    return rol.id;
  }
}
