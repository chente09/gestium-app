import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { RouterModule } from '@angular/router';

import { PayrollService, PayrollEmployee } from '../../../services/payroll/payroll.service';
import { RegistersService } from '../../../services/registers/registers.service';
import { UsersService } from '../../../services/users/users.service';
import {
  SolicitudesPermisoService,
  SolicitudPermiso,
  TipoSolicitud,
  TIPOS_SOLICITUD,
  DIAS_VACACIONES_DESCONTABLES
} from '../../../services/solicitudesPermiso/solicitudes-permiso.service';

@Component({
  selector: 'app-mis-solicitudes',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzButtonModule,
    NzTagModule,
    NzIconModule,
    NzEmptyModule,
    NzAlertModule,
    NzBreadCrumbModule
  ],
  templateUrl: './mis-solicitudes.component.html',
  styleUrl: './mis-solicitudes.component.css'
})
export class MisSolicitudesComponent implements OnInit, OnDestroy {
  readonly diasVacacionesDescontables = DIAS_VACACIONES_DESCONTABLES;
  readonly tiposSolicitud = TIPOS_SOLICITUD;

  payrollEmployee: PayrollEmployee | null = null;
  elegibleVacaciones = false;
  cargandoPerfil = true;

  solicitudes: SolicitudPermiso[] = [];
  loading = false;

  form: FormGroup;
  creando = false;
  uploadingId: string | null = null;

  private destroy$ = new Subject<void>();
  private uid: string | null = null;
  private area: string | null = null;

  constructor(
    private payrollService: PayrollService,
    private registersService: RegistersService,
    private usersService: UsersService,
    private solicitudesService: SolicitudesPermisoService,
    private fb: FormBuilder,
    private message: NzMessageService
  ) {
    this.form = this.fb.group({
      tipo: ['medico', Validators.required],
      fechaInicio: ['', Validators.required],
      fechaFin: ['', Validators.required],
      motivo: ['', Validators.required]
    });
  }

  async ngOnInit(): Promise<void> {
    const user = this.usersService.getCurrentUser();
    if (!user) return;
    this.uid = user.uid;

    const register = this.registersService.currentRegister ?? await this.registersService.getRegisterByUid(user.uid);
    this.area = register?.areaAsignada ?? null;

    this.payrollEmployee = await this.payrollService.getPayrollEmployeeByUid(user.uid);
    this.elegibleVacaciones = this.payrollEmployee ? this.payrollService.esElegibleVacaciones(this.payrollEmployee) : false;
    this.cargandoPerfil = false;

    if (!this.elegibleVacaciones && this.form.get('tipo')?.value === 'vacaciones') {
      this.form.patchValue({ tipo: 'medico' });
    }

    if (!this.payrollEmployee) return;

    this.loading = true;
    this.solicitudesService.getMisSolicitudes(this.uid)
      .pipe(takeUntil(this.destroy$))
      .subscribe(solicitudes => {
        this.solicitudes = [...solicitudes].sort((a, b) => b.fechaSolicitud.localeCompare(a.fechaSolicitud));
        this.loading = false;
        this.solicitudes
          .filter(s => s.estado === 'aprobado')
          .forEach(s => this.solicitudesService.verificarYVencerSiCorresponde(s));
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  tiposParaSeleccionar(): { value: TipoSolicitud; label: string }[] {
    return (Object.keys(TIPOS_SOLICITUD) as TipoSolicitud[])
      .filter(tipo => tipo !== 'vacaciones' || this.elegibleVacaciones)
      .map(tipo => ({ value: tipo, label: TIPOS_SOLICITUD[tipo].label }));
  }

  async crearSolicitud(): Promise<void> {
    if (this.form.invalid || !this.payrollEmployee || !this.uid || !this.area) {
      this.message.warning('Completa el tipo, las fechas y el motivo.');
      return;
    }

    const value = this.form.value;
    if (value.fechaFin < value.fechaInicio) {
      this.message.warning('La fecha de fin no puede ser anterior a la fecha de inicio.');
      return;
    }

    this.creando = true;
    try {
      await this.solicitudesService.crearSolicitud({
        uid: this.uid,
        payrollEmployeeId: this.payrollEmployee.id!,
        nombreEmpleado: this.payrollEmployee.nombreCompleto,
        area: this.area,
        tipo: value.tipo,
        fechaInicio: value.fechaInicio,
        fechaFin: value.fechaFin,
        motivo: value.motivo.trim()
      });
      this.message.success('Solicitud enviada. Tu coordinador la va a revisar.');
      this.form.reset({ tipo: value.tipo, fechaInicio: '', fechaFin: '', motivo: '' });
    } catch (error) {
      console.error('Error creando solicitud:', error);
      this.message.error('No se pudo enviar la solicitud.');
    } finally {
      this.creando = false;
    }
  }

  async onJustificativoSelected(event: Event, solicitud: SolicitudPermiso): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !solicitud.id) return;

    this.uploadingId = solicitud.id;
    try {
      await this.solicitudesService.subirJustificativo(solicitud.id, file);
      this.message.success('Justificativo subido correctamente.');
    } catch (error) {
      console.error('Error subiendo justificativo:', error);
      this.message.error('No se pudo subir el justificativo.');
    } finally {
      this.uploadingId = null;
      input.value = '';
    }
  }

  diasRestantes(solicitud: SolicitudPermiso): number {
    return this.solicitudesService.diasRestantesJustificativo(solicitud);
  }

  tipoLabel(tipo: TipoSolicitud): string {
    return TIPOS_SOLICITUD[tipo].label;
  }

  estadoColor(estado: SolicitudPermiso['estado']): string {
    switch (estado) {
      case 'aprobado': return 'green';
      case 'rechazado': return 'red';
      case 'vencido_sin_justificativo': return 'volcano';
      default: return 'gold';
    }
  }

  estadoLabel(estado: SolicitudPermiso['estado']): string {
    switch (estado) {
      case 'aprobado': return 'Aprobado';
      case 'rechazado': return 'Rechazado';
      case 'vencido_sin_justificativo': return 'Vencido sin justificativo';
      default: return 'Pendiente';
    }
  }

  trackById(index: number, solicitud: SolicitudPermiso): string | undefined {
    return solicitud.id;
  }
}
