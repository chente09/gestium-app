import { Injectable } from '@angular/core';
import { Firestore, addDoc, collection, collectionData, doc, updateDoc, deleteDoc, query, where, orderBy } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { UserAreaService } from '../userArea/user-area.service';
import { UsersService } from '../users/users.service';

export interface AreaActivity {
  id?: string;
  titulo: string;
  descripcion?: string;
  fechaLimite: Date;
  fechaCreacion: Date;
  estado: 'pendiente' | 'en_progreso' | 'completada' | 'pospuesta';
  area: string;
  responsable: string; // UID del usuario responsable
  responsableNombre: string; // Nombre del responsable para mostrar
  creadoPor: string; // UID del usuario que creó la actividad
  creadoPorNombre: string; // Nombre del creador
  prioridad: 'baja' | 'media' | 'alta';
  notas?: string;
  fechaCompletada?: Date;
  etiquetas?: string[]; // Para categorizar actividades
}

@Injectable({
  providedIn: 'root'
})
export class AreaActivitiesService {
  private collectionName = 'area_activities';

  constructor(
    private firestore: Firestore,
    private userAreaService: UserAreaService,
    private usersService: UsersService
  ) {}

  // ➕ Crear nueva actividad
  async createActivity(activityData: Omit<AreaActivity, 'id' | 'fechaCreacion' | 'creadoPor' | 'creadoPorNombre' | 'area'>): Promise<string> {
    const user = this.usersService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const userArea = await this.userAreaService.getCurrentUserArea();
    if (!userArea) throw new Error('Usuario sin área asignada');

    const newActivity: Omit<AreaActivity, 'id'> = {
      ...activityData,
      area: userArea, // ✅ Se asigna automáticamente desde el usuario
      fechaCreacion: new Date(),
      creadoPor: user.uid,
      creadoPorNombre: user.displayName || user.email || 'Usuario'
    };

    const activitiesRef = collection(this.firestore, this.collectionName);
    const docRef = await addDoc(activitiesRef, newActivity);
    return docRef.id;
  }

  // 📋 Obtener actividades del área del usuario actual
  getCurrentUserAreaActivities(): Observable<AreaActivity[]> {
    return new Observable(observer => {
      this.userAreaService.getCurrentUserArea().then(userArea => {
        if (!userArea) {
          observer.next([]);
          return;
        }

        const activitiesRef = collection(this.firestore, this.collectionName);
        const q = query(
          activitiesRef,
          where('area', '==', userArea),
          orderBy('fechaLimite', 'asc')
        );

        const activities$ = collectionData(q, { idField: 'id' }) as Observable<AreaActivity[]>;
        activities$.subscribe(activities => observer.next(activities));
      });
    });
  }

  // 📅 Obtener actividades por área y rango de fechas
  getActivitiesByAreaAndDateRange(area: string, startDate: Date, endDate: Date): Observable<AreaActivity[]> {
    const activitiesRef = collection(this.firestore, this.collectionName);
    const q = query(
      activitiesRef,
      where('area', '==', area),
      where('fechaLimite', '>=', startDate),
      where('fechaLimite', '<=', endDate),
      orderBy('fechaLimite', 'asc')
    );

    return collectionData(q, { idField: 'id' }) as Observable<AreaActivity[]>;
  }

  // 📅 Obtener actividades de la semana actual
  getCurrentWeekActivities(): Observable<AreaActivity[]> {
    return new Observable(observer => {
      this.userAreaService.getCurrentUserArea().then(userArea => {
        if (!userArea) {
          observer.next([]);
          return;
        }

        const now = new Date();
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        
        // Normalizar fechas
        startOfWeek.setHours(0, 0, 0, 0);
        endOfWeek.setHours(23, 59, 59, 999);

        const activities$ = this.getActivitiesByAreaAndDateRange(userArea, startOfWeek, endOfWeek);
        activities$.subscribe(activities => observer.next(activities));
      });
    });
  }

  // ✏️ Actualizar actividad
  async updateActivity(activityId: string, updates: Partial<AreaActivity>): Promise<void> {
    const docRef = doc(this.firestore, `${this.collectionName}/${activityId}`);
    
    // Si se está completando la actividad, agregar fecha de completado
    if (updates.estado === 'completada' && !updates.fechaCompletada) {
      updates.fechaCompletada = new Date();
    }

    await updateDoc(docRef, updates);
  }

  // 📅 Posponer actividad (cambiar fecha límite)
  async postponeActivity(activityId: string, newDate: Date): Promise<void> {
    await this.updateActivity(activityId, {
      fechaLimite: newDate,
      estado: 'pospuesta'
    });
  }

  // ✅ Marcar actividad como completada
  async completeActivity(activityId: string, notas?: string): Promise<void> {
    const updates: Partial<AreaActivity> = {
      estado: 'completada',
      fechaCompletada: new Date()
    };

    if (notas) {
      updates.notas = notas;
    }

    await this.updateActivity(activityId, updates);
  }

  // 🔄 Cambiar estado de actividad
  async changeActivityStatus(activityId: string, newStatus: AreaActivity['estado']): Promise<void> {
    await this.updateActivity(activityId, { estado: newStatus });
  }

  // 🗑️ Eliminar actividad
  async deleteActivity(activityId: string): Promise<void> {
    const docRef = doc(this.firestore, `${this.collectionName}/${activityId}`);
    await deleteDoc(docRef);
  }

  // 👤 Asignar responsable a actividad
  async assignResponsible(activityId: string, responsableUid: string, responsableNombre: string): Promise<void> {
    await this.updateActivity(activityId, {
      responsable: responsableUid,
      responsableNombre: responsableNombre
    });
  }

  // 📊 Obtener estadísticas del área
  async getAreaStatistics(area: string): Promise<{
    total: number;
    pendientes: number;
    enProgreso: number;
    completadas: number;
    pospuestas: number;
  }> {
    // Esta implementación sería más compleja en un caso real
    // Por ahora, una implementación básica
    return {
      total: 0,
      pendientes: 0,
      enProgreso: 0,
      completadas: 0,
      pospuestas: 0
    };
  }

  // 🏷️ Obtener actividades por etiqueta
  getActivitiesByTag(tag: string): Observable<AreaActivity[]> {
    return new Observable(observer => {
      this.userAreaService.getCurrentUserArea().then(userArea => {
        if (!userArea) {
          observer.next([]);
          return;
        }

        const activitiesRef = collection(this.firestore, this.collectionName);
        const q = query(
          activitiesRef,
          where('area', '==', userArea),
          where('etiquetas', 'array-contains', tag)
        );

        const activities$ = collectionData(q, { idField: 'id' }) as Observable<AreaActivity[]>;
        activities$.subscribe(activities => observer.next(activities));
      });
    });
  }

  // 📈 Obtener actividades por prioridad
  getActivitiesByPriority(priority: 'baja' | 'media' | 'alta'): Observable<AreaActivity[]> {
    return new Observable(observer => {
      this.userAreaService.getCurrentUserArea().then(userArea => {
        if (!userArea) {
          observer.next([]);
          return;
        }

        const activitiesRef = collection(this.firestore, this.collectionName);
        const q = query(
          activitiesRef,
          where('area', '==', userArea),
          where('prioridad', '==', priority),
          orderBy('fechaLimite', 'asc')
        );

        const activities$ = collectionData(q, { idField: 'id' }) as Observable<AreaActivity[]>;
        activities$.subscribe(activities => observer.next(activities));
      });
    });
  }
}