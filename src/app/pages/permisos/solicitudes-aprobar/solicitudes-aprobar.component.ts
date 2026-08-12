import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { NzCardModule } from 'ng-zorro-antd/card';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { RouterModule } from '@angular/router';

import { RegistersService } from '../../../services/registers/registers.service';
import { UsersService } from '../../../services/users/users.service';
import {
  SolicitudesPermisoService,
  SolicitudPermiso,
  TipoSolicitud,
  TIPOS_SOLICITUD,
  EstadoSolicitud
} from '../../../services/solicitudesPermiso/solicitudes-permiso.service';

@Component({
  selector: 'app-solicitudes-aprobar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    NzCardModule,
    NzSelectModule,
    NzButtonModule,
    NzTagModule,
    NzIconModule,
    NzEmptyModule,
    NzModalModule,
    NzInputModule,
    NzBreadCrumbModule,
    NzPopconfirmModule
  ],
  templateUrl: './solicitudes-aprobar.component.html',
  styleUrl: './solicitudes-aprobar.component.css'
})
export class SolicitudesAprobarComponent implements OnInit, OnDestroy {
  solicitudes: SolicitudPermiso[] = [];
  filtradas: SolicitudPermiso[] = [];
  loading = false;
  filtroEstado: EstadoSolicitud | 'todas' | 'certificados_pendientes' = 'pendiente';

  showRechazoModal = false;
  solicitudARechazar: SolicitudPermiso | null = null;
  motivoRechazoTexto = '';
  procesandoId: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private solicitudesService: SolicitudesPermisoService,
    public registersService: RegistersService,
    private usersService: UsersService,
    private message: NzMessageService
  ) { }

  ngOnInit(): void {
    this.loading = true;

    this.solicitudesService.getTodasLasSolicitudes().pipe(takeUntil(this.destroy$)).subscribe(solicitudes => {
      this.solicitudes = [...solicitudes].sort((a, b) => b.fechaSolicitud.localeCompare(a.fechaSolicitud));
      this.aplicarFiltro();
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

  aplicarFiltro(): void {
    if (this.filtroEstado === 'todas') {
      this.filtradas = this.solicitudes;
    } else if (this.filtroEstado === 'certificados_pendientes') {
      this.filtradas = this.solicitudes.filter(s => s.justificativoUrl && !s.justificativoValidado);
    } else {
      this.filtradas = this.solicitudes.filter(s => s.estado === this.filtroEstado);
    }
  }

  async validarCertificado(s: SolicitudPermiso): Promise<void> {
    if (!s.id) return;
    const user = this.usersService.getCurrentUser();
    if (!user) return;

    this.procesandoId = s.id;
    try {
      await this.solicitudesService.validarCertificado(s.id, {
        uid: user.uid,
        nombre: user.displayName || user.email || 'Desconocido'
      });
      this.message.success('Certificado validado.');
    } catch (error) {
      console.error('Error validando certificado:', error);
      this.message.error('No se pudo validar el certificado.');
    } finally {
      this.procesandoId = null;
    }
  }

  async aprobar(s: SolicitudPermiso): Promise<void> {
    if (!s.id) return;
    const user = this.usersService.getCurrentUser();
    if (!user) return;

    this.procesandoId = s.id;
    try {
      await this.solicitudesService.aprobarSolicitud(s.id, {
        uid: user.uid,
        nombre: user.displayName || user.email || 'Desconocido',
        email: user.email || ''
      });
      this.message.success('Solicitud aprobada.');
    } catch (error) {
      console.error('Error aprobando solicitud:', error);
      this.message.error('No se pudo aprobar la solicitud.');
    } finally {
      this.procesandoId = null;
    }
  }

  abrirRechazo(s: SolicitudPermiso): void {
    this.solicitudARechazar = s;
    this.motivoRechazoTexto = '';
    this.showRechazoModal = true;
  }

  cerrarRechazo(): void {
    this.showRechazoModal = false;
    this.solicitudARechazar = null;
    this.motivoRechazoTexto = '';
  }

  async confirmarRechazo(): Promise<void> {
    if (!this.solicitudARechazar?.id || !this.motivoRechazoTexto.trim()) return;
    const user = this.usersService.getCurrentUser();
    if (!user) return;

    this.procesandoId = this.solicitudARechazar.id;
    try {
      await this.solicitudesService.rechazarSolicitud(
        this.solicitudARechazar.id,
        { uid: user.uid, nombre: user.displayName || user.email || 'Desconocido', email: user.email || '' },
        this.motivoRechazoTexto.trim()
      );
      this.message.success('Solicitud rechazada.');
      this.cerrarRechazo();
    } catch (error) {
      console.error('Error rechazando solicitud:', error);
      this.message.error('No se pudo rechazar la solicitud.');
    } finally {
      this.procesandoId = null;
    }
  }

  async reabrir(s: SolicitudPermiso): Promise<void> {
    if (!s.id) return;
    this.procesandoId = s.id;
    try {
      await this.solicitudesService.reabrirParaJustificativoTardio(s.id);
      this.message.success('Solicitud reabierta para justificativo tardío.');
    } catch (error) {
      console.error('Error reabriendo solicitud:', error);
      this.message.error('No se pudo reabrir la solicitud.');
    } finally {
      this.procesandoId = null;
    }
  }

  async eliminar(s: SolicitudPermiso): Promise<void> {
    if (!s.id || !this.registersService.isCurrentUserAdmin()) return;
    this.procesandoId = s.id;
    try {
      await this.solicitudesService.eliminarSolicitud(s.id);
      this.message.success('Solicitud eliminada.');
    } catch (error) {
      console.error('Error eliminando solicitud:', error);
      this.message.error('No se pudo eliminar la solicitud.');
    } finally {
      this.procesandoId = null;
    }
  }

  diasRestantes(s: SolicitudPermiso): number {
    return this.solicitudesService.diasRestantesJustificativo(s);
  }

  tipoLabel(tipo: TipoSolicitud): string {
    return TIPOS_SOLICITUD[tipo].label;
  }

  estadoColor(estado: EstadoSolicitud): string {
    switch (estado) {
      case 'aprobado': return 'green';
      case 'rechazado': return 'red';
      case 'vencido_sin_justificativo': return 'volcano';
      default: return 'gold';
    }
  }

  estadoLabel(estado: EstadoSolicitud): string {
    switch (estado) {
      case 'aprobado': return 'Aprobado';
      case 'rechazado': return 'Rechazado';
      case 'vencido_sin_justificativo': return 'Vencido sin justificativo';
      default: return 'Pendiente';
    }
  }

  trackById(index: number, s: SolicitudPermiso): string | undefined {
    return s.id;
  }
}
