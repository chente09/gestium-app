import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzMessageService } from 'ng-zorro-antd/message';

import { PayrollService, PayrollEmployee } from '../../../services/payroll/payroll.service';

interface EmpleadoConSaldo extends PayrollEmployee {
  elegibleVacaciones: boolean;
  periodoVigente: { inicio: string; fin: string } | null;
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
    NzCollapseModule,
    NzToolTipModule,
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
        .map(e => ({
          ...e,
          elegibleVacaciones: this.payrollService.esElegibleVacaciones(e),
          periodoVigente: e.fechaAfiliacionIESS ? this.payrollService.periodoVacacionesVigente(e.fechaAfiliacionIESS) : null
        }))
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

  // Un mismo número negativo significa cosas distintas según si ya cumplió
  // el año o no (deuda real vs. adelanto antes de tener derecho). En vez de
  // un texto largo repetido en cada fila, un tag corto + color + tooltip
  // con el detalle completo — el color y la palabra ya distinguen los tres
  // casos sin necesitar una leyenda aparte.
  saldoColor(e: EmpleadoConSaldo): string {
    const saldo = e.saldoVacacionesDisponible ?? 0;
    if (saldo > 0) return 'green';
    if (saldo === 0) return 'default';
    return e.elegibleVacaciones ? 'red' : 'gold';
  }

  saldoCorto(e: EmpleadoConSaldo): string {
    const saldo = e.saldoVacacionesDisponible ?? 0;
    if (saldo === 0) return '0 días';
    if (saldo > 0) return `${saldo} días`;
    return e.elegibleVacaciones ? `Debe ${Math.abs(saldo)}` : `Adelanto ${Math.abs(saldo)}`;
  }

  saldoTooltip(e: EmpleadoConSaldo): string {
    const saldo = e.saldoVacacionesDisponible ?? 0;
    if (e.elegibleVacaciones) {
      return saldo < 0 ? `Debe ${Math.abs(saldo)} día(s) de este período` : `${saldo} día(s) disponibles este período`;
    }
    return saldo < 0 ? `Tomó ${Math.abs(saldo)} día(s) de adelanto antes de cumplir el año` : 'Aún no cumple el año — sin días disponibles todavía';
  }
}
