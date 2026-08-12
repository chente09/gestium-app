import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzMessageService } from 'ng-zorro-antd/message';

import { PayrollService, PayrollEmployee } from '../../../services/payroll/payroll.service';

interface EmpleadoConSaldo extends PayrollEmployee {
  elegibleVacaciones: boolean;
}

@Component({
  selector: 'app-saldo-vacaciones',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    NzCardModule,
    NzTableModule,
    NzTagModule,
    NzIconModule,
    NzInputModule,
    NzBreadCrumbModule
  ],
  templateUrl: './saldo-vacaciones.component.html',
  styleUrl: './saldo-vacaciones.component.css'
})
export class SaldoVacacionesComponent implements OnInit {
  empleados: EmpleadoConSaldo[] = [];
  filtrados: EmpleadoConSaldo[] = [];
  loading = false;
  searchTerm = '';

  constructor(
    private payrollService: PayrollService,
    private message: NzMessageService
  ) { }

  async ngOnInit(): Promise<void> {
    this.loading = true;
    try {
      const activos = await this.payrollService.getActivePayrollEmployeesOnce();
      this.empleados = activos
        // Pasantes no tienen saldo de vacaciones — no aportan nada a esta vista.
        .filter(e => !this.payrollService.esPasante(e))
        .map(e => ({ ...e, elegibleVacaciones: this.payrollService.esElegibleVacaciones(e) }))
        .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
      this.filtrar();
    } catch (error) {
      console.error('Error cargando saldos de vacaciones:', error);
      this.message.error('Error al cargar el saldo de vacaciones.');
    } finally {
      this.loading = false;
    }
  }

  filtrar(): void {
    const term = this.searchTerm.trim().toLowerCase();
    this.filtrados = !term
      ? this.empleados
      : this.empleados.filter(e =>
          e.nombreCompleto.toLowerCase().includes(term) || e.cedula.includes(term)
        );
  }

  trackById(index: number, e: EmpleadoConSaldo): string | undefined {
    return e.id;
  }
}
