import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';

import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzMessageService } from 'ng-zorro-antd/message';

import { PayrollEmployee, PayrollService } from '../../../services/payroll/payroll.service';
import {
  DIAS_VACACIONES_DESCONTABLES,
  aniversariosAcreditadosAuto,
  diasCorridos,
  diasLaborables,
  etiquetaSaldo,
  proximoAniversario,
  saldoVacacionesAlDia
} from '../../../services/payroll/vacaciones-saldo.util';
import {
  ESTADOS_SOLICITUD,
  SolicitudPermiso,
  SolicitudesPermisoService,
  TIPOS_SOLICITUD,
  TipoSolicitud
} from '../../../services/solicitudesPermiso/solicitudes-permiso.service';
import { EfectoSaldo, efectoEnSaldo } from '../../../services/solicitudesPermiso/efecto-saldo.util';

interface FilaSolicitud {
  solicitud: SolicitudPermiso;
  tipoLabel: string;
  estado: { label: string; color: string };
  laborables: number;
  corridos: number;
  efecto: EfectoSaldo;
  // Aprobada, pide justificativo, no lo subió y ya pasó el plazo: se marca
  // vencida (y descuenta) la próxima vez que alguien abra la lista.
  plazoVencido: boolean;
}

@Component({
  selector: 'app-saldo-vacaciones-detalle',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    NzCardModule,
    NzTableModule,
    NzTagModule,
    NzIconModule,
    NzSelectModule,
    NzEmptyModule,
    NzStatisticModule,
    NzToolTipModule,
    NzBreadCrumbModule
  ],
  templateUrl: './saldo-vacaciones-detalle.component.html',
  styleUrl: './saldo-vacaciones-detalle.component.css'
})
export class SaldoVacacionesDetalleComponent implements OnInit {
  readonly diasPorAnio = DIAS_VACACIONES_DESCONTABLES;
  readonly tipos = (Object.keys(TIPOS_SOLICITUD) as TipoSolicitud[]).map(value => ({ value, label: TIPOS_SOLICITUD[value].label }));

  cargando = true;
  noEncontrado = false;
  empleado: PayrollEmployee | null = null;

  // Cómo se compone el saldo
  elegible = false;
  saldoGuardado = 0;
  saldoHoy = 0;
  aniversariosAuto: string[] = [];
  proximo: string | null = null;
  periodoVigente: { inicio: string; fin: string } | null = null;

  filas: FilaSolicitud[] = [];
  filtradas: FilaSolicitud[] = [];
  filtroTipo: TipoSolicitud | null = null;
  filtroAnio: number | null = null;
  anios: number[] = [];
  expandidas = new Set<string>();

  // Resumen
  diasDescontadosTotal = 0;
  diasDescontadosDesdeAniversario = 0;
  sinEfecto = 0;
  pendientes = 0;

  constructor(
    private route: ActivatedRoute,
    private payrollService: PayrollService,
    private solicitudesService: SolicitudesPermisoService,
    private message: NzMessageService
  ) { }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.noEncontrado = true; this.cargando = false; return; }

    try {
      const [empleado, solicitudes] = await Promise.all([
        this.payrollService.getPayrollEmployeeById(id),
        this.solicitudesService.getSolicitudesPorEmpleado(id)
      ]);
      if (!empleado) { this.noEncontrado = true; return; }

      this.empleado = empleado;
      this.armarSaldo(empleado);
      this.filas = solicitudes.map(s => this.aFila(s));
      this.anios = [...new Set(this.filas.map(f => Number(f.solicitud.fechaInicio.slice(0, 4))))].sort((a, b) => b - a);
      this.armarResumen();
      this.filtrar();
    } catch (error) {
      console.error('Error cargando el detalle del saldo:', error);
      this.message.error('No se pudo cargar el detalle de vacaciones.');
    } finally {
      this.cargando = false;
    }
  }

  private armarSaldo(e: PayrollEmployee): void {
    this.elegible = this.payrollService.esElegibleVacaciones(e);
    this.saldoGuardado = e.saldoVacacionesDisponible ?? 0;
    this.saldoHoy = saldoVacacionesAlDia(e).saldo;
    if (e.fechaAfiliacionIESS) {
      this.aniversariosAuto = aniversariosAcreditadosAuto(e.fechaAfiliacionIESS);
      this.proximo = proximoAniversario(e.fechaAfiliacionIESS);
      this.periodoVigente = this.payrollService.periodoVacacionesVigente(e.fechaAfiliacionIESS);
    }
  }

  private aFila(s: SolicitudPermiso): FilaSolicitud {
    return {
      solicitud: s,
      tipoLabel: TIPOS_SOLICITUD[s.tipo]?.label ?? s.tipo,
      estado: ESTADOS_SOLICITUD[s.estado] ?? { label: s.estado, color: 'default' },
      laborables: diasLaborables(s.fechaInicio, s.fechaFin),
      corridos: diasCorridos(s.fechaInicio, s.fechaFin),
      efecto: efectoEnSaldo(s, !!TIPOS_SOLICITUD[s.tipo]?.descuentaAlAprobar),
      plazoVencido: s.estado === 'aprobado' && this.solicitudesService.plazoVencido(s)
    };
  }

  // "Desde su último aniversario": el cierre del último ciclo es justo ese
  // aniversario. Quien todavía no cumple el año cuenta todo su historial.
  private armarResumen(): void {
    const ultimoAniversario = this.elegible ? this.periodoVigente?.fin ?? null : null;
    const descuentan = this.filas.filter(f => f.efecto.tipo === 'descuenta' || f.efecto.tipo === 'descontado_por_vencer');

    this.diasDescontadosTotal = descuentan.reduce((t, f) => t + f.efecto.dias, 0);
    this.diasDescontadosDesdeAniversario = descuentan
      .filter(f => !ultimoAniversario || f.solicitud.fechaInicio >= ultimoAniversario)
      .reduce((t, f) => t + f.efecto.dias, 0);
    this.sinEfecto = this.filas.filter(f => f.solicitud.estado === 'aprobado' && f.efecto.tipo === 'ninguno').length;
    this.pendientes = this.filas.filter(f => f.solicitud.estado === 'pendiente').length;
  }

  filtrar(): void {
    this.filtradas = this.filas.filter(f =>
      (!this.filtroTipo || f.solicitud.tipo === this.filtroTipo) &&
      (!this.filtroAnio || f.solicitud.fechaInicio.startsWith(String(this.filtroAnio)))
    );
  }

  alternarFila(id: string | undefined, abierta: boolean): void {
    if (!id) return;
    if (abierta) this.expandidas.add(id);
    else this.expandidas.delete(id);
  }

  get etiquetaDeSaldo(): { texto: string; color: string } {
    return etiquetaSaldo(this.saldoHoy, this.elegible);
  }

  trackByFila(_: number, f: FilaSolicitud): string | undefined {
    return f.solicitud.id;
  }
}
