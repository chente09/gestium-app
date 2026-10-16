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
import { DIAS_VACACIONES_DESCONTABLES, etiquetaSaldo, saldoVacacionesAlDia } from '../../../services/payroll/vacaciones-saldo.util';

interface EmpleadoConSaldo extends PayrollEmployee {
  elegibleVacaciones: boolean;
  periodoVigente: { inicio: string; fin: string } | null;
  // Saldo real de hoy: el guardado más los aniversarios que faltaba sumar.
  saldoActual: number;
  aniversariosPorAcreditar: number;
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
        .map(e => {
          const saldo = saldoVacacionesAlDia(e);
          return {
            ...e,
            elegibleVacaciones: this.payrollService.esElegibleVacaciones(e),
            periodoVigente: e.fechaAfiliacionIESS ? this.payrollService.periodoVacacionesVigente(e.fechaAfiliacionIESS) : null,
            saldoActual: saldo.saldo,
            aniversariosPorAcreditar: saldo.aniversariosPorAcreditar
          };
        })
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

  // En vez de un texto largo repetido en cada fila, un tag corto + color +
  // tooltip con el detalle completo (la regla de rotulado vive en
  // etiquetaSaldo, compartida con la vista de detalle).
  saldoColor(e: EmpleadoConSaldo): string {
    return etiquetaSaldo(e.saldoActual, e.elegibleVacaciones).color;
  }

  saldoCorto(e: EmpleadoConSaldo): string {
    return etiquetaSaldo(e.saldoActual, e.elegibleVacaciones).texto;
  }

  saldoTooltip(e: EmpleadoConSaldo): string {
    const saldo = e.saldoActual;
    let texto: string;
    if (e.elegibleVacaciones) {
      texto = saldo < 0 ? `Debe ${Math.abs(saldo)} día(s) de este período` : `${saldo} día(s) disponibles este período`;
    } else {
      texto = saldo < 0 ? `Tomó ${Math.abs(saldo)} día(s) de adelanto antes de cumplir el año` : 'Aún no cumple el año — sin días disponibles todavía';
    }
    if (e.aniversariosPorAcreditar > 0) {
      texto += ` · Incluye +${e.aniversariosPorAcreditar * DIAS_VACACIONES_DESCONTABLES} por su aniversario de afiliación`;
    }
    return texto;
  }
}
