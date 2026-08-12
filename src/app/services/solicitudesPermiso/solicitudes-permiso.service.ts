import { Injectable } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  getDoc,
  query,
  updateDoc,
  where
} from '@angular/fire/firestore';
import { Storage, getDownloadURL, ref, uploadBytes } from '@angular/fire/storage';
import { Observable } from 'rxjs';
import { PayrollService } from '../payroll/payroll.service';
import { RegistersService } from '../registers/registers.service';

export type TipoSolicitud = 'vacaciones' | 'medico' | 'con_descuento_vacaciones';
export type EstadoSolicitud = 'pendiente' | 'aprobado' | 'rechazado' | 'vencido_sin_justificativo';

export const TIPOS_SOLICITUD: Record<TipoSolicitud, { label: string; requiereJustificativo: boolean; descuentaAlAprobar: boolean }> = {
  vacaciones: { label: 'Vacaciones', requiereJustificativo: false, descuentaAlAprobar: true },
  medico: { label: 'Permiso médico', requiereJustificativo: true, descuentaAlAprobar: false },
  con_descuento_vacaciones: { label: 'Permiso con descuento de vacaciones', requiereJustificativo: false, descuentaAlAprobar: true }
};

// Plazo para subir el justificativo una vez aprobado el permiso. Pasado
// este plazo sin justificativo, la solicitud queda "vencida" y sus días
// se descuentan del saldo de vacaciones (ver DIAS_VACACIONES_DESCONTABLES).
export const DIAS_PLAZO_JUSTIFICATIVO = 8;

// De los 15 días legales de vacaciones, 4 corresponden a fines de semana
// dentro del bloque y no se pueden gastar sueltos — el saldo que sí se
// puede descontar día a día (ej. por permisos no justificados) es 11.
export const DIAS_VACACIONES_DESCONTABLES = 11;

export interface SolicitudPermiso {
  id?: string;
  uid: string; // quien solicita
  payrollEmployeeId: string;
  nombreEmpleado: string;
  area: string; // areaAsignada al momento de solicitar, para que el coordinador filtre lo suyo
  tipo: TipoSolicitud;
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string; // YYYY-MM-DD
  motivo: string;
  estado: EstadoSolicitud;
  fechaSolicitud: string; // ISO
  aprobadoPor?: string;
  nombreAprobador?: string;
  fechaAprobacion?: string; // ISO — desde acá cuentan los DIAS_PLAZO_JUSTIFICATIVO
  motivoRechazo?: string;
  requiereJustificativo: boolean;
  justificativoUrl?: string;
  justificativoSubidoEn?: string; // ISO
  descontadoDeVacaciones?: boolean;
}

function diffDiasCalendario(fechaInicio: string, fechaFin: string): number {
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  const ms = fin.getTime() - inicio.getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1);
}

@Injectable({
  providedIn: 'root'
})
export class SolicitudesPermisoService {
  private collectionName = 'solicitudesPermiso';

  constructor(
    private firestore: Firestore,
    private storage: Storage,
    private payrollService: PayrollService,
    private registersService: RegistersService
  ) { }

  async crearSolicitud(data: {
    uid: string;
    payrollEmployeeId: string;
    nombreEmpleado: string;
    area: string;
    tipo: TipoSolicitud;
    fechaInicio: string;
    fechaFin: string;
    motivo: string;
  }): Promise<string> {
    const solicitud: Omit<SolicitudPermiso, 'id'> = {
      ...data,
      estado: 'pendiente',
      fechaSolicitud: new Date().toISOString(),
      requiereJustificativo: TIPOS_SOLICITUD[data.tipo].requiereJustificativo
    };

    const ref2 = collection(this.firestore, this.collectionName);
    const docRef = await addDoc(ref2, solicitud);
    return docRef.id;
  }

  // Sin listener en tiempo real: un solo where (sin orderBy en un campo
  // distinto) para no necesitar un índice compuesto — se ordena en el
  // componente, igual que en Itinerario/Historial.
  getMisSolicitudes(uid: string): Observable<SolicitudPermiso[]> {
    const ref2 = collection(this.firestore, this.collectionName);
    const q = query(ref2, where('uid', '==', uid));
    return collectionData(q, { idField: 'id' }) as Observable<SolicitudPermiso[]>;
  }

  getTodasLasSolicitudes(): Observable<SolicitudPermiso[]> {
    const ref2 = collection(this.firestore, this.collectionName);
    return collectionData(ref2, { idField: 'id' }) as Observable<SolicitudPermiso[]>;
  }

  async aprobarSolicitud(id: string, aprobador: { uid: string; nombre: string; email: string }): Promise<void> {
    const ref2 = doc(this.firestore, `${this.collectionName}/${id}`);
    await updateDoc(ref2, {
      estado: 'aprobado',
      aprobadoPor: aprobador.uid,
      nombreAprobador: aprobador.nombre,
      fechaAprobacion: new Date().toISOString()
    });

    const solicitud = await this.getSolicitudById(id);
    if (!solicitud) return;

    // Vacaciones y "con descuento de vacaciones" restan del saldo apenas se
    // aprueban; Médico en cambio solo descuenta si vence sin justificativo.
    if (TIPOS_SOLICITUD[solicitud.tipo].descuentaAlAprobar) {
      await this.descontarDiasDeVacaciones(solicitud);
    }

    // El envío del correo es un efecto secundario, no la aprobación en sí:
    // si falla (extensión mal configurada, sin permisos, etc.) no debe
    // hacer que la app reporte la aprobación como fallida. Se loguea aparte.
    try {
      await this.enviarAvisoAprobacion(solicitud, aprobador);
      console.log('[Permisos] Aviso de aprobación encolado en la colección mail.');
    } catch (error) {
      console.error('[Permisos] No se pudo encolar el aviso de aprobación:', error);
    }
  }

  private async descontarDiasDeVacaciones(solicitud: SolicitudPermiso): Promise<void> {
    const empleado = await this.payrollService.getPayrollEmployeeById(solicitud.payrollEmployeeId);
    if (!empleado?.id) return;

    const dias = diffDiasCalendario(solicitud.fechaInicio, solicitud.fechaFin);
    const saldoActual = empleado.saldoVacacionesDisponible ?? 0;
    const nuevoSaldo = Math.max(0, saldoActual - dias);
    await this.payrollService.updatePayrollEmployee(empleado.id, { saldoVacacionesDisponible: nuevoSaldo });
  }

  async eliminarSolicitud(id: string): Promise<void> {
    const ref2 = doc(this.firestore, `${this.collectionName}/${id}`);
    await deleteDoc(ref2);
  }

  // Escribe un doc en la colección `mail`, que despacha la extensión de
  // Firebase "Trigger Email" (firestore-send-email) — este servicio no
  // manda el correo directamente, solo dispara. Sin esa extensión
  // instalada, el doc queda en Firestore sin efecto (no rompe nada).
  private async enviarAvisoAprobacion(
    solicitud: SolicitudPermiso,
    aprobador: { nombre: string; email: string }
  ): Promise<void> {
    console.log('[Permisos] Preparando aviso de aprobación para', solicitud.id);
    const [empleado, gerentes, admins] = await Promise.all([
      this.registersService.getRegisterByUid(solicitud.uid),
      this.registersService.getUsersByRole('gerente'),
      this.registersService.getUsersByRole('admin')
    ]);

    const to = [...new Set([empleado?.email, aprobador.email].filter((e): e is string => !!e))];
    const cc = [...new Set(gerentes.map(g => g.email).filter(e => !!e && !to.includes(e)))];
    const bcc = [...new Set(admins.map(a => a.email).filter(e => !!e && !to.includes(e) && !cc.includes(e)))];

    const tipoLabel = TIPOS_SOLICITUD[solicitud.tipo].label;
    const plazoHtml = solicitud.requiereJustificativo
      ? `<p>Tiene <b>${DIAS_PLAZO_JUSTIFICATIVO} días</b> desde hoy para subir el justificativo en la app. Si no se sube a tiempo, los días se descuentan automáticamente del saldo de vacaciones.</p>`
      : '';

    const mailDoc: Record<string, unknown> = {
      to,
      message: {
        subject: `Solicitud de ${tipoLabel} aprobada — ${solicitud.nombreEmpleado}`,
        html: `
          <p>Se aprobó la siguiente solicitud en Gestium SLI:</p>
          <ul>
            <li><b>Empleado:</b> ${solicitud.nombreEmpleado}</li>
            <li><b>Tipo:</b> ${tipoLabel}</li>
            <li><b>Fechas:</b> ${solicitud.fechaInicio} al ${solicitud.fechaFin}</li>
            <li><b>Motivo:</b> ${solicitud.motivo}</li>
            <li><b>Aprobado por:</b> ${aprobador.nombre}</li>
          </ul>
          ${plazoHtml}
          <p>— Sistema Gestium SLI</p>
        `
      }
    };
    if (cc.length) mailDoc['cc'] = cc;
    if (bcc.length) mailDoc['bcc'] = bcc;

    const mailRef = collection(this.firestore, 'mail');
    await addDoc(mailRef, mailDoc);
  }

  async rechazarSolicitud(id: string, aprobador: { uid: string; nombre: string }, motivoRechazo: string): Promise<void> {
    const ref2 = doc(this.firestore, `${this.collectionName}/${id}`);
    await updateDoc(ref2, {
      estado: 'rechazado',
      aprobadoPor: aprobador.uid,
      nombreAprobador: aprobador.nombre,
      fechaAprobacion: new Date().toISOString(),
      motivoRechazo
    });
  }

  async subirJustificativo(id: string, file: File): Promise<string> {
    const path = `solicitudesPermiso/${id}/justificativo-${Date.now()}.pdf`;
    const fileRef = ref(this.storage, path);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);

    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);
    await updateDoc(docRef, {
      justificativoUrl: url,
      justificativoSubidoEn: new Date().toISOString()
    });
    return url;
  }

  // Plazo vencido = ya pasaron DIAS_PLAZO_JUSTIFICATIVO desde la aprobación
  // y todavía no hay justificativo.
  plazoVencido(solicitud: SolicitudPermiso): boolean {
    if (!solicitud.requiereJustificativo || !solicitud.fechaAprobacion || solicitud.justificativoUrl) {
      return false;
    }
    const limite = new Date(solicitud.fechaAprobacion);
    limite.setDate(limite.getDate() + DIAS_PLAZO_JUSTIFICATIVO);
    return new Date() > limite;
  }

  diasRestantesJustificativo(solicitud: SolicitudPermiso): number {
    if (!solicitud.fechaAprobacion) return DIAS_PLAZO_JUSTIFICATIVO;
    const limite = new Date(solicitud.fechaAprobacion);
    limite.setDate(limite.getDate() + DIAS_PLAZO_JUSTIFICATIVO);
    const restante = Math.ceil((limite.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(0, restante);
  }

  // No hay cron: esto se llama al listar solicitudes (Mis Solicitudes /
  // Por Aprobar). Si el plazo ya venció y sigue sin justificativo, recién
  // ahí se marca vencida y se descuenta del saldo de vacaciones — la
  // primera persona que abre la lista después del vencimiento dispara la
  // corrección. Idempotente: si ya está marcada, no vuelve a descontar.
  async verificarYVencerSiCorresponde(solicitud: SolicitudPermiso): Promise<void> {
    if (solicitud.estado !== 'aprobado' || !this.plazoVencido(solicitud)) return;

    const dias = diffDiasCalendario(solicitud.fechaInicio, solicitud.fechaFin);
    const empleado = await this.payrollService.getPayrollEmployeeById(solicitud.payrollEmployeeId);
    const saldoActual = empleado?.saldoVacacionesDisponible ?? 0;
    const nuevoSaldo = Math.max(0, saldoActual - dias);

    if (empleado?.id) {
      await this.payrollService.updatePayrollEmployee(empleado.id, { saldoVacacionesDisponible: nuevoSaldo });
    }

    const ref2 = doc(this.firestore, `${this.collectionName}/${solicitud.id}`);
    await updateDoc(ref2, {
      estado: 'vencido_sin_justificativo',
      descontadoDeVacaciones: true
    });
  }

  // Corrección manual de admin: reabre una solicitud vencida para que se
  // pueda subir el justificativo tarde (ej. trámite del IESS demorado).
  // No revierte el descuento de vacaciones ya aplicado — eso queda a
  // criterio del admin, ajustando el saldo a mano si corresponde.
  async reabrirParaJustificativoTardio(id: string): Promise<void> {
    const ref2 = doc(this.firestore, `${this.collectionName}/${id}`);
    await updateDoc(ref2, { estado: 'aprobado' });
  }

  async getSolicitudById(id: string): Promise<SolicitudPermiso | null> {
    const ref2 = doc(this.firestore, `${this.collectionName}/${id}`);
    const snap = await getDoc(ref2);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as SolicitudPermiso;
  }
}
