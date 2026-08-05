import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, Subscription, takeUntil } from 'rxjs';

import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { RouterModule } from '@angular/router';

import { PayrollService, PayrollEmployee } from '../../../services/payroll/payroll.service';

const EMPLEADORES = [
  { nombre: 'MALDONADO VITERI GUILLERMO DAVID', ruc: '1711716819001' },
  { nombre: 'GESTIUM S.A.', ruc: '1793215493001' }
];

@Component({
  selector: 'app-payroll-employees',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    NzCardModule,
    NzTableModule,
    NzButtonModule,
    NzIconModule,
    NzTagModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzSwitchModule,
    NzDatePickerModule,
    NzBreadCrumbModule
  ],
  templateUrl: './payroll-employees.component.html',
  styleUrl: './payroll-employees.component.css'
})
export class PayrollEmployeesComponent implements OnInit, OnDestroy {
  employees: PayrollEmployee[] = [];
  loading = false;

  showModal = false;
  editingId: string | null = null;
  form: FormGroup;
  esPasante = false;

  readonly empleadores = EMPLEADORES;

  private destroy$ = new Subject<void>();
  private sub?: Subscription;

  constructor(
    private payrollService: PayrollService,
    private fb: FormBuilder,
    private message: NzMessageService
  ) {
    this.form = this.fb.group({
      nombreCompleto: ['', Validators.required],
      cedula: ['', Validators.required],
      fechaIngreso: ['', Validators.required],
      fechaAfiliacionIESS: [''],
      empleadorRuc: [EMPLEADORES[0].ruc, Validators.required],
      activo: [true]
    });
  }

  ngOnInit(): void {
    this.loading = true;
    this.sub = this.payrollService.getPayrollEmployees()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (employees) => {
          this.employees = employees;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error cargando empleados de nómina:', error);
          this.message.error('Error al cargar los empleados de nómina');
          this.loading = false;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openCreateModal(): void {
    this.editingId = null;
    this.esPasante = false;
    this.form.reset({ empleadorRuc: EMPLEADORES[0].ruc, activo: true });
    this.showModal = true;
  }

  openEditModal(employee: PayrollEmployee): void {
    this.editingId = employee.id!;
    this.esPasante = !employee.fechaAfiliacionIESS;
    this.form.reset({
      nombreCompleto: employee.nombreCompleto,
      cedula: employee.cedula,
      fechaIngreso: employee.fechaIngreso,
      fechaAfiliacionIESS: employee.fechaAfiliacionIESS || '',
      empleadorRuc: employee.empleadorRuc,
      activo: employee.activo
    });
    this.showModal = true;
  }

  onEsPasanteChange(value: boolean): void {
    this.esPasante = value;
    if (value) {
      this.form.patchValue({ fechaAfiliacionIESS: '' });
    }
  }

  closeModal(): void {
    this.showModal = false;
    this.editingId = null;
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.message.warning('Completa nombre, cédula, fecha de ingreso y empleador');
      return;
    }

    const value = this.form.value;
    const empleador = this.empleadores.find(e => e.ruc === value.empleadorRuc) || this.empleadores[0];

    const employee: Omit<PayrollEmployee, 'id'> = {
      nombreCompleto: value.nombreCompleto.trim(),
      cedula: value.cedula.trim(),
      fechaIngreso: value.fechaIngreso,
      fechaAfiliacionIESS: this.esPasante ? null : (value.fechaAfiliacionIESS || null),
      empleadorNombre: empleador.nombre,
      empleadorRuc: empleador.ruc,
      activo: value.activo
    };

    try {
      if (this.editingId) {
        await this.payrollService.updatePayrollEmployee(this.editingId, employee);
        this.message.success('Empleado actualizado');
      } else {
        await this.payrollService.createPayrollEmployee(employee);
        this.message.success('Empleado agregado');
      }
      this.closeModal();
    } catch (error) {
      console.error('Error guardando empleado de nómina:', error);
      this.message.error('Error al guardar el empleado');
    }
  }

  async toggleActivo(employee: PayrollEmployee, activo: boolean): Promise<void> {
    try {
      await this.payrollService.updatePayrollEmployee(employee.id!, { activo });
    } catch (error) {
      console.error('Error cambiando estado:', error);
      this.message.error('Error al cambiar el estado');
    }
  }

  trackById(index: number, employee: PayrollEmployee): string | undefined {
    return employee.id;
  }
}
