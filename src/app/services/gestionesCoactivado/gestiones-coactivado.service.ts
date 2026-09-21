import { Injectable } from '@angular/core';
import { Firestore, addDoc, collection, collectionData, deleteDoc, doc, getDocs, query, updateDoc, where } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RegistersService } from '../registers/registers.service';
import { UsersService } from '../users/users.service';
import { AreaActivitiesService, AreaActivity } from '../areaActivities/area-activities.service';
import { borrarEnLotes } from '../firestore-utils/batch-delete';

// Slug del área IESS: es donde viven la agenda y los recordatorios de esta
// bitácora (Register.areaAsignada y AreaActivity.area guardan el slug).
export const AREA_IESS = 'iess';

export type TipoGestion = 'llamada' | 'mensaje' | 'reunion' | 'otro';

// El orden acá es el orden en que aparecen los botones en la bitácora.
export const TIPOS_GESTION: Record<TipoGestion, string> = {
  llamada: 'Llamada',
  mensaje: 'Mensaje',
  reunion: 'Reunión',
  otro: 'Otro'
};

// Cualquiera del área IESS puede corregir el tipo y el texto de una gestión
// (queda sellado quién y cuándo la editó); solo admin puede borrarla. Quién
// la registró (`registradoPor`) y cuándo (`fecha`) nunca cambian: de ahí
// salen las métricas de gestión por integrante.
export interface GestionCoactivado {
  id?: string;
  coactivadoId: string; // cédula del coactivado
  coactivadoNombre: string;
  // Cartera del coactivado AL MOMENTO de la gestión: si luego se reasigna,
  // las métricas históricas por cartera no se reescriben. Las gestiones
  // anteriores a este campo no lo tienen.
  cartera?: string;
  tipo: TipoGestion;
  descripcion: string;
  fecha: Date;
  registradoPor: { uid: string; nombre: string };
  editadoPor?: { uid: string; nombre: string };
  fechaEdicion?: Date;
}

// Firestore devuelve Timestamps; la app trabaja con Date.
function aGestion(id: string, data: any): GestionCoactivado {
  const aFecha = (v: any) => (v?.toDate ? v.toDate() : v);
  return { ...data, id, fecha: aFecha(data.fecha), fechaEdicion: aFecha(data.fechaEdicion) } as GestionCoactivado;
}

@Injectable({
  providedIn: 'root'
})
export class GestionesCoactivadoService {
  private collectionName = 'gestiones_coactivado';

  constructor(
    private firestore: Firestore,
    private registersService: RegistersService,
    private usersService: UsersService,
    private areaActivitiesService: AreaActivitiesService
  ) { }

  // En tiempo real (a diferencia de la búsqueda): si Paula registra una
  // gestión mientras Vicente tiene abierta la ficha, la ve aparecer sola —
  // es justo el descoordinamiento que esta bitácora busca evitar. Acotado a
  // un solo coactivado, así que el costo de lecturas es bajo. Un solo where
  // (sin orderBy) para no necesitar índice compuesto; se ordena acá.
  getGestiones(coactivadoId: string): Observable<GestionCoactivado[]> {
    const ref = collection(this.firestore, this.collectionName);
    const q = query(ref, where('coactivadoId', '==', coactivadoId));

    return (collectionData(q, { idField: 'id' }) as Observable<any[]>).pipe(
      map(lista =>
        lista
          .map(g => aGestion(g.id, g))
          .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
      )
    );
  }

  // Para el reporte de gestión (solo admin en la UI): una sola consulta por
  // rango sobre `fecha` — un único campo, sin índice compuesto — y bajo
  // demanda (no en tiempo real), para que el costo de lecturas sea el de
  // las gestiones del período y nada más.
  async getGestionesPorRango(desde: Date, hasta: Date): Promise<GestionCoactivado[]> {
    const ref = collection(this.firestore, this.collectionName);
    const q = query(ref, where('fecha', '>=', desde), where('fecha', '<=', hasta));
    const snap = await getDocs(q);

    return snap.docs.map(d => aGestion(d.id, d.data()));
  }

  async registrarGestion(data: {
    coactivadoId: string;
    coactivadoNombre: string;
    cartera: string;
    tipo: TipoGestion;
    descripcion: string;
  }): Promise<string> {
    const user = this.usersService.getCurrentUser();
    const register = this.registersService.getCurrentRegister();
    if (!user || !register) throw new Error('🔒 Usuario no autenticado');

    const gestion: Omit<GestionCoactivado, 'id'> = {
      ...data,
      descripcion: data.descripcion.trim(),
      fecha: new Date(),
      registradoPor: { uid: user.uid, nombre: register.displayName || user.email || 'Usuario' }
    };

    const ref = collection(this.firestore, this.collectionName);
    const docRef = await addDoc(ref, gestion);
    return docRef.id;
  }

  // Solo tipo y texto se pueden corregir; quién y cuándo la editó se sellan
  // solos (las reglas de Firestore lo exigen). El recordatorio que esa
  // gestión haya creado en la agenda queda como está.
  async editarGestion(id: string, cambios: { tipo: TipoGestion; descripcion: string }): Promise<void> {
    const user = this.usersService.getCurrentUser();
    const register = this.registersService.getCurrentRegister();
    if (!user || !register) throw new Error('🔒 Usuario no autenticado');

    await updateDoc(doc(this.firestore, `${this.collectionName}/${id}`), {
      tipo: cambios.tipo,
      descripcion: cambios.descripcion.trim(),
      editadoPor: { uid: user.uid, nombre: register.displayName || user.email || 'Usuario' },
      fechaEdicion: new Date()
    });
  }

  // Solo admin (las reglas de Firestore lo exigen). Borra también el
  // recordatorio de la agenda que esa gestión haya creado — si no, quedaría
  // un seguimiento suelto apuntando a algo que ya no existe. Primero el
  // recordatorio y al final la gestión: si algo falla a la mitad, la gestión
  // sigue ahí y se puede reintentar.
  async eliminarGestion(id: string): Promise<void> {
    await this.areaActivitiesService.deleteActivitiesByGestion(AREA_IESS, id);
    await deleteDoc(doc(this.firestore, `${this.collectionName}/${id}`));
  }

  // ============================================
  // 🔔 Recordatorios (viven en la agenda del área IESS)
  // ============================================

  // Un recordatorio es una AreaActivity normal del área IESS ligada al
  // coactivado: aparece en la agenda compartida y se completa, pospone o
  // arrastra igual que cualquier otra actividad. Se crea DESPUÉS de guardar
  // la gestión, así un fallo acá nunca pierde el texto de la llamada.
  async crearRecordatorio(data: {
    coactivado: { cedula: string; nombre: string; cartera: string };
    gestionId: string;
    descripcion: string;
    fecha: Date;
    responsable: { uid: string; nombre: string };
  }): Promise<string> {
    // Mediodía: evita que un desfase de zona horaria lo mueva de día.
    const fechaLimite = new Date(data.fecha.getFullYear(), data.fecha.getMonth(), data.fecha.getDate(), 12, 0, 0);

    return this.areaActivitiesService.createActivity({
      titulo: `Seguimiento: ${data.coactivado.nombre}`.slice(0, 100),
      descripcion: data.descripcion.trim().slice(0, 500),
      fechaLimite,
      estado: 'pendiente',
      prioridad: 'media',
      responsable: data.responsable.uid,
      responsableNombre: data.responsable.nombre,
      etiquetas: [data.coactivado.cartera],
      coactivadoId: data.coactivado.cedula,
      coactivadoNombre: data.coactivado.nombre,
      gestionId: data.gestionId
    }, AREA_IESS);
  }

  // Recordatorios todavía abiertos del coactivado (los completados ya no
  // importan para saber a quién le toca dar seguimiento).
  getRecordatoriosPendientes(coactivadoId: string): Observable<AreaActivity[]> {
    return this.areaActivitiesService.getActivitiesByCoactivado(AREA_IESS, coactivadoId).pipe(
      map(lista => lista.filter(a => a.estado !== 'completada'))
    );
  }

  async completarRecordatorio(activityId: string): Promise<void> {
    await this.areaActivitiesService.completeActivity(activityId);
  }

  // ============================================
  // 🗑️ Eliminación (solo admin — lo exigen las reglas de Firestore)
  // ============================================

  // Borra las gestiones del coactivado y sus recordatorios de la agenda.
  // El coactivado en sí lo borra CoactivadosService.eliminar, al final.
  async eliminarPorCoactivado(coactivadoId: string): Promise<void> {
    const ref = collection(this.firestore, this.collectionName);
    const snap = await getDocs(query(ref, where('coactivadoId', '==', coactivadoId)));
    await borrarEnLotes(this.firestore, snap.docs.map(d => d.ref));

    await this.areaActivitiesService.deleteActivitiesByCoactivado(AREA_IESS, coactivadoId);
  }
}
